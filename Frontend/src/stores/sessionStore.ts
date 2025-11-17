import { reactive } from "vue";
import { proEnabled } from "./billingStore";
import {
	createSessionRemote,
	addGameRemote,
	listSessionsRemote,
	getSessionRemoteFull,
	renameParticipantsRemote,
	deleteSessionRemote,
} from "../lib/db";

export type Contract = "prise" | "garde" | "garde_sans" | "garde_contre";
export type PetitAuBout = "none" | "preneur" | "defense";
export type Poignee =
	| "none"
	| "taker_simple"
	| "taker_double"
	| "taker_triple"
	| "defense_simple"
	| "defense_double"
	| "defense_triple";

export type Chelem =
	| "none"
	| "non_annonce_reussi"
	| "annonce_reussi"
	| "annonce_rate";

// Grand Chelem retiré (non utilisé par la FFT moderne)
export type GrandChelem = never;

export type GameDetails = {
	taker: string;
	called?: string | null;
	contract: Contract;
	bouts: 0 | 1 | 2 | 3;
	bouts_detail?: ("petit" | "21" | "excuse")[];
	takerPoints: number;
	petitAuBout: PetitAuBout;
	poignee: Poignee;
	miseres?: string[]; // misère d'atout (players)
	miseres_tete?: string[]; // misère de tête (players)
	chelem?: Chelem;
};

export type Game = {
	id: string;
	timestamp: number;
	scores: Record<string, number>; // key = participant name, value = points for this game
	note?: string;
	details?: GameDetails;
};

export type Session = {
	id: string;
	remoteId?: string;
	participants: string[];
	games: Game[];
	createdAt: number;
};

type StoreState = {
	sessions: Record<string, Session>;
};

const STORAGE_KEY = "tarot:sessions";

function load(): StoreState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { sessions: {} };
		const parsed = JSON.parse(raw) as StoreState;
		return parsed && typeof parsed === "object" ? parsed : { sessions: {} };
	} catch {
		return { sessions: {} };
	}
}

const state = reactive<StoreState>(load());

function persist() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {}
}

function uid(prefix = "s"): string {
	// small unique id: prefix + timestamp + random
	return `${prefix}_${Date.now().toString(36)}_${Math.random()
		.toString(36)
		.slice(2, 8)}`;
}

export async function createSession(participants: string[]): Promise<string> {
	// Free tier limit: max 5 sessions if not premium
	try {
		if (!proEnabled.value) {
			const sessionCount = Object.keys(state.sessions).length;
			if (sessionCount >= 5) {
				throw new Error("SESSION_LIMIT_REACHED");
			}
		}
	} catch (e) {
		throw e;
	}
	const id = uid("sess");
	const unique = Array.from(
		new Set(participants.map((p) => p.trim()).filter(Boolean))
	);
	const session: Session = {
		id,
		participants: unique,
		games: [],
		createdAt: Date.now(),
	};
	try {
		const remote = await createSessionRemote(unique);
		if (remote?.sessionId) {
			session.remoteId = remote.sessionId;
		}
	} catch (e) {
		// ignore remote failure
	}
	state.sessions[id] = session;
	persist();
	return id;
}

export function getSessionById(id: string): Session | null {
	return state.sessions[id] ?? null;
}

export function getLocalIdByRemoteId(remoteId: string): string | null {
	for (const [localId, s] of Object.entries(state.sessions)) {
		if (s.remoteId === remoteId) return localId;
	}
	return null;
}

export async function addGame(
	sessionId: string,
	scores: Record<string, number>,
	note?: string,
	details?: GameDetails
): Promise<Game | null> {
	const s = state.sessions[sessionId];
	if (!s) return null;
	const game: Game = {
		id: uid("g"),
		timestamp: Date.now(),
		scores,
		note,
		details,
	};
	s.games.push(game);
	persist();
	try {
		if (s.remoteId) {
			await addGameRemote(s.remoteId, details ?? null, scores);
		}
	} catch (e) {
		// ignore remote failure
	}
	return game;
}

// Helpers for consumers (Stats, Dashboard, etc.)
export function getAllSessions(): Session[] {
	return Object.values(state.sessions);
}

export function getKnownPlayers(): string[] {
	const set = new Set<string>();
	for (const s of Object.values(state.sessions)) {
		for (const p of s.participants) set.add(p);
	}
	return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function ensureLocalSessionFromRemote(
	remoteId: string
): Promise<string | null> {
	// Return existing mapping if present
	const existing = getLocalIdByRemoteId(remoteId);
	if (existing) return existing;

	const remote = await getSessionRemoteFull(remoteId);
	if (!remote) return null;

	const id = uid("sess");
	const session: Session = {
		id,
		remoteId,
		participants: remote.participants.map((p) => p.name),
		games: [],
		createdAt: Date.now(),
	};

	// Rebuild games with name-based scores
	const idToName = new Map(
		remote.participants.map((p) => [p.id, p.name] as const)
	);
	for (const g of remote.games) {
		const byName: Record<string, number> = {};
		for (const s of g.scores) {
			const name = idToName.get(s.participant_id);
			if (name) byName[name] = s.score;
		}
		session.games.push({
			id: uid("g"),
			timestamp: new Date(g.created_at).getTime(),
			scores: byName,
			note: undefined,
			details: g.details ?? undefined,
		});
	}

	state.sessions[id] = session;
	persist();
	return id;
}

export async function listRemoteSessionsIntoLocal(): Promise<
	Array<{
		localId: string;
		remoteId: string;
		participants: string[];
		createdAt: number;
	}>
> {
	const remote = await listSessionsRemote();
	const results: Array<{
		localId: string;
		remoteId: string;
		participants: string[];
		createdAt: number;
	}> = [];
	for (const r of remote) {
		const local =
			getLocalIdByRemoteId(r.id) ||
			(await ensureLocalSessionFromRemote(r.id));
		if (local) {
			results.push({
				localId: local,
				remoteId: r.id,
				participants: r.participants.map((p) => p.name),
				createdAt: new Date(r.created_at).getTime(),
			});
		}
	}
	return results.sort((a, b) => b.createdAt - a.createdAt);
}

export async function syncLocalUnsyncedSessions(): Promise<void> {
	// Push local sessions without remoteId to Supabase
	for (const s of Object.values(state.sessions)) {
		if (!s.remoteId) {
			try {
				const remote = await createSessionRemote(s.participants);
				if (remote?.sessionId) {
					s.remoteId = remote.sessionId;
					// push existing games
					for (const g of s.games) {
						await addGameRemote(
							s.remoteId,
							g.details ?? null,
							g.scores
						);
					}
				}
			} catch (e) {
				// stop on first failure silently
			}
		}
	}
	persist();
}

export async function renamePlayer(
	oldName: string,
	newName: string
): Promise<void> {
	if (!oldName || !newName || oldName === newName) return;
	for (const s of Object.values(state.sessions)) {
		// participants list
		if (s.participants.includes(oldName)) {
			const renamed = s.participants.map((p) =>
				p === oldName ? newName : p
			);
			s.participants = Array.from(new Set(renamed));
			// games
			for (const g of s.games) {
				if (g.scores[oldName] != null) {
					const val = g.scores[oldName];
					g.scores[newName] = (g.scores[newName] ?? 0) + val;
					delete g.scores[oldName];
				}
				if (g.details) {
					if (g.details.taker === oldName) g.details.taker = newName;
					if (g.details.called === oldName)
						g.details.called = newName;
					if (
						g.details.called &&
						g.details.called === g.details.taker
					)
						g.details.called = null;
					if (g.details.miseres?.length) {
						const set = new Set(
							g.details.miseres.map((n) =>
								n === oldName ? newName : n
							)
						);
						g.details.miseres = Array.from(set);
					}
					if (g.details.miseres_tete?.length) {
						const set2 = new Set(
							g.details.miseres_tete.map((n) =>
								n === oldName ? newName : n
							)
						);
						g.details.miseres_tete = Array.from(set2);
					}
				}
			}
		}
	}
	persist();
	try {
		await renameParticipantsRemote(oldName, newName);
	} catch {}
}

export async function deletePlayer(name: string): Promise<void> {
	if (!name) return;
	// Remove player from sessions and games
	for (const s of Object.values(state.sessions)) {
		if (s.participants.includes(name)) {
			s.participants = s.participants.filter((p) => p !== name);
			for (const g of s.games) {
				if (g.scores[name] != null) {
					delete g.scores[name];
				}
				if (g.details) {
					if (g.details.taker === name) g.details.taker = "";
					if (g.details.called === name) g.details.called = null;
					if (g.details.miseres?.length)
						g.details.miseres = g.details.miseres.filter(
							(n) => n !== name
						);
					if (g.details.miseres_tete?.length)
						g.details.miseres_tete = g.details.miseres_tete.filter(
							(n) => n !== name
						);
				}
			}
		}
	}
	persist();
	// Best-effort remote: set participants with this name to a tombstone label
	try {
		await renameParticipantsRemote(name, `[deleted] ${name}`);
	} catch {}
}

export function computeTotals(session: Session): Record<string, number> {
	const totals: Record<string, number> = {};
	session.participants.forEach((p) => (totals[p] = 0));
	for (const g of session.games) {
		for (const [p, pts] of Object.entries(g.scores)) {
			if (totals[p] == null) totals[p] = 0;
			totals[p] += Number(pts) || 0;
		}
	}
	return totals;
}

export function updateGame(
	sessionId: string,
	gameId: string,
	scores: Record<string, number>,
	details?: GameDetails
) {
	const s = state.sessions[sessionId];
	if (!s) return;
	const game = s.games.find((g) => g.id === gameId);
	if (!game) return;
	game.scores = { ...scores };
	if (details) {
		game.details = { ...details };
	}
	persist();
}

export function removeGame(sessionId: string, gameId: string) {
	const s = state.sessions[sessionId];
	if (!s) return;
	s.games = s.games.filter((g) => g.id !== gameId);
	persist();
}

export async function deleteSession(localId: string): Promise<void> {
	if (!localId) return;
	const s = state.sessions[localId];
	const remoteId = s?.remoteId;
	// Optimistic local removal (clone to ensure reactivité des clés)
	const next: Record<string, Session> = { ...state.sessions };
	delete next[localId];
	state.sessions = next;
	persist();
	// Remote delete if linked
	if (remoteId) {
		try {
			await deleteSessionRemote(remoteId);
		} catch {}
	}
}
