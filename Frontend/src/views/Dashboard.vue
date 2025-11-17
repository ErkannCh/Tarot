<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getSession } from "../lib/supabaseClient";
import { useRouter } from "vue-router";
import {
	createSession,
	listRemoteSessionsIntoLocal,
	syncLocalUnsyncedSessions,
	getKnownPlayers,
	getAllSessions,
} from "../stores/sessionStore";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";

const router = useRouter();
const userEmail = ref<string>("");
const loadingSessions = ref(false);
const mySessions = ref<
	Array<{
		localId: string;
		remoteId: string;
		participants: string[];
		createdAt: number;
	}>
>([]);
const knownPlayers = ref<string[]>([]);
const knownItems = computed(() =>
	knownPlayers.value.map((p) => ({ title: p }))
);

onMounted(async () => {
	const { data } = await getSession();
	const session = data.session;
	userEmail.value = session?.user?.email ?? "";
	if (session) {
		// Optionally sync local unsynced sessions when user logs in
		await syncLocalUnsyncedSessions();
		loadingSessions.value = true;
		mySessions.value = await listRemoteSessionsIntoLocal();
		loadingSessions.value = false;
		knownPlayers.value = getKnownPlayers();
		try {
			await refreshProFromSupabase();
		} catch {}
	}
});

// (Déconnexion gérée par la topbar AuthedLayout)

// Dialog création session (déplacé depuis Home)
const dialog = ref(false);
// players: string (tapé) ou objet { title } quand sélectionné depuis la liste
const players = ref<any[]>(["", "", "", ""]);
const touched = ref<boolean[]>([false, false, false, false]);
const submitted = ref(false);
function markTouched(i: number) {
	touched.value[i] = true;
}

const trimmed = computed(() =>
	players.value.map((p) => {
		const v =
			typeof p === "object" && p !== null
				? p.title ?? p.value ?? ""
				: p ?? "";
		return String(v).trim();
	})
);
const hasEmpty = computed(() => trimmed.value.some((p) => !p));
const duplicates = computed(() => {
	const seen = new Set<string>();
	const dups = new Set<string>();
	for (const n of trimmed.value) {
		if (!n) continue;
		if (seen.has(n)) dups.add(n);
		else seen.add(n);
	}
	return dups;
});
const knownSet = computed(() => new Set(knownPlayers.value));
function isKnownButNotSelected(name: string, original: any) {
	if (!name) return false;
	const isKnown = knownSet.value.has(name);
	const selectedFromList =
		typeof original === "object" &&
		original !== null &&
		(original.title === name || original.value === name);
	return isKnown && !selectedFromList;
}

const invalidIndexes = computed(() => {
	const idx: number[] = [];
	const dups = duplicates.value;
	trimmed.value.forEach((name, i) => {
		if (
			dups.has(name) ||
			!name ||
			isKnownButNotSelected(name, players.value[i])
		)
			idx.push(i);
	});
	return idx;
});

function fieldHasError(i: number): boolean {
	const name = trimmed.value[i];
	const orig = players.value[i];
	// Duplicates: always show immediately
	if (name && duplicates.value.has(name)) return true;
	// Others: only after submit attempt
	if (!submitted.value) return false;
	if (!name) return true;
	if (isKnownButNotSelected(name, orig)) return true;
	return false;
}

function fieldMessages(i: number): string[] {
	const name = trimmed.value[i];
	const orig = players.value[i];
	if (name && duplicates.value.has(name)) return ["Nom en doublon"];
	if (!submitted.value) return [];
	if (!name) return ["Nom requis"];
	if (isKnownButNotSelected(name, orig))
		return [
			"Cette personne existe déjà, veuillez la sélectionner dans la liste",
		];
	return [];
}

function addPlayerField() {
	if (players.value.length < 5) {
		players.value.push("");
		touched.value.push(false);
	}
}
function removePlayerField(i: number) {
	if (players.value.length > 3) {
		players.value.splice(i, 1);
		touched.value.splice(i, 1);
	}
}

const canCreate = computed(() => {
	const nonEmpty = trimmed.value.filter(Boolean);
	const unique = new Set(nonEmpty);
	const validCount = nonEmpty.length;
	const noDup = unique.size === nonEmpty.length;
	const hasKnownTyped = trimmed.value.some((name, i) =>
		isKnownButNotSelected(name, players.value[i])
	);
	return validCount >= 3 && validCount <= 5 && noDup && !hasKnownTyped;
});

function resetDialog() {
	players.value = ["", "", "", ""];
	touched.value = [false, false, false, false];
}

function openCreate() {
	resetDialog();
	submitted.value = false;
	dialog.value = true;
}

const isPro = computed(() => proEnabled.value);
const totalSessions = computed(() => getAllSessions().length);
const FREE_SESSIONS_LIMIT = 5;
const limitReached = computed(
	() => !isPro.value && totalSessions.value >= FREE_SESSIONS_LIMIT
);

async function createNewSession() {
	submitted.value = true;
	// Focus errors, or proceed
	if (!canCreate.value) return;
	const names = trimmed.value.filter(Boolean);
	try {
		const id = await createSession(names);
		dialog.value = false;
		router.push({ name: "session", params: { id } });
	} catch (e: any) {
		if (e && e.message === "SESSION_LIMIT_REACHED") {
			dialog.value = false;
			router.push({ name: "billing" });
			return;
		}
		throw e;
	}
}
</script>

<template>
	<section class="hero container">
		<div class="hero__content glow">
			<h1>Votre table de Tarot, réinventée</h1>
			<p>
				Créez, suivez et reprenez vos parties avec une interface
				raffinée et des cartes lumineuses.
			</p>
			<div class="hero__cta">
				<button
					class="btn"
					:disabled="limitReached"
					:class="limitReached ? '' : 'btn-primary'"
					@click="openCreate"
				>
					Nouvelle session
				</button>
				<router-link class="btn btn-ghost" :to="{ name: 'stats' }"
					>Explorer</router-link
				>
			</div>
			<p v-if="limitReached" class="mt-4">
				Vous avez atteint la limite de sessions gratuites.
			</p>
		</div>
		<div class="hero__preview">
			<div class="list-counter mb-4 space-x-2">
				<span class="counter" v-if="!isPro" :class="limitReached ? 'counter--notok' : ''"
					>{{ totalSessions }} /
					{{ FREE_SESSIONS_LIMIT }} sessions</span
				>
				<span class="counter counter--ok" v-else
					>Premium actif</span
				>
				<router-link v-if="!isPro" :to="{ name: 'billing' }" class="counter counter--ok"> Passez Premium </router-link>
			</div>

			<div class="card elev-2 hero__card">
				<div class="hero__card-header">
					<span class="muted">Historique récent</span>
				</div>
				<div class="divider"></div>
				<div v-if="loadingSessions" class="hero__list">
					<div class="skeleton" v-for="i in 3" :key="i"></div>
				</div>
				<div v-else class="hero__list">
					<template v-if="!mySessions.length">
						<div class="muted">Aucune session pour le moment.</div>
					</template>
					<template v-else>
						<div
							class="list-item"
							v-for="s in mySessions.slice(0, 5)"
							:key="s.remoteId"
						>
							<div class="list-item__meta">
								<div class="date">
									{{ new Date(s.createdAt).toLocaleString() }}
								</div>
								<div class="chips">
									<span
										class="pill"
										v-for="p in s.participants"
										:key="p"
										>{{ p }}</span
									>
								</div>
							</div>
							<router-link
								class="btn btn-ghost"
								:to="{
									name: 'session',
									params: { id: s.localId },
								}"
								>Ouvrir</router-link
							>
						</div>
					</template>
				</div>
			</div>
		</div>
	</section>

	<!-- Dialog de création de session -->
	<v-dialog v-model="dialog" max-width="520">
		<v-card>
			<v-card-title class="text-h6 font-weight-bold"
				>Nouvelle session</v-card-title
			>
			<v-card-text>
				<v-alert
					v-if="limitReached"
					type="warning"
					variant="tonal"
					class="mb-3"
				>
					Limite gratuite atteinte ({{ totalSessions }} /
					{{ FREE_SESSIONS_LIMIT }} sessions).
					<router-link
						:to="{ name: 'billing' }"
						class="btn btn-primary ml-2"
						>Passer en Premium</router-link
					>
				</v-alert>
				<div class="text-body-2 text-medium-emphasis mb-2">
					Indiquez les participants (3 à 5 joueurs).
				</div>
				<v-alert
					v-if="duplicates.size"
					type="warning"
					variant="tonal"
					class="mb-3"
				>
					<div v-if="duplicates.size">
						Des doublons sont présents:
						{{ Array.from(duplicates).join(", ") }}
					</div>
				</v-alert>
				<div>
					<div
						v-for="(player, i) in players"
						:key="i"
						class="d-flex align-center mb-3"
					>
						<v-combobox
							v-model="players[i]"
							:items="knownItems"
							item-title="title"
							return-object
							label="Nom du participant"
							variant="outlined"
							density="comfortable"
							:error="fieldHasError(i)"
							:messages="fieldMessages(i)"
							class="flex-grow-1 mr-2"
							@focus="markTouched(i)"
							@update:model-value="markTouched(i)"
						/>
						<v-btn
							icon="mdi-close"
							variant="text"
							class="remove-btn"
							:disabled="players.length <= 3"
							@click="removePlayerField(i)"
						/>
					</div>
					<div class="d-flex">
						<v-btn
							variant="text"
							class="text-none"
							prepend-icon="mdi-account-plus"
							:disabled="players.length >= 5"
							@click="addPlayerField"
						>
							Ajouter un participant
						</v-btn>
					</div>
				</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="dialog = false">Annuler</v-btn>
				<v-btn
					color="deep-purple-accent-2"
					:disabled="limitReached || !canCreate"
					@click="createNewSession"
					>Créer</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<style scoped>
.container {
	max-width: 1200px;
	margin: 0 auto;
	padding: 32px 24px;
}
.mb-3 {
	margin-bottom: 12px;
}
.ga-2 {
	gap: 8px;
}
.text-none {
	text-transform: none;
}

/* Align the remove (close) button with the text fields */
.remove-btn {
	align-self: stretch;
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 40px;
}

/* Hero section */
.hero {
	display: grid;
	grid-template-columns: 1.1fr 1fr;
	gap: 28px;
	align-items: center;
	min-height: calc(100vh - (var(--topbar-h) + var(--topbar-vpad)) - 64px);
	overflow-x: hidden; /* avoid horizontal scroll due to children */
}
.hero__content h1 {
	font-size: clamp(2rem, 3.4vw + 1rem, 3.2rem);
	line-height: 1.1;
}
.hero__content p {
	color: var(--text-secondary);
	max-width: 58ch;
}
.hero__cta {
	display: flex;
	gap: 12px;
	margin-top: 16px;
}
.counter {
	align-self: center;
	color: var(--text-secondary);
	border: 1px solid rgba(185, 194, 232, 0.2);
	background: rgba(185, 194, 232, 0.06);
	border-radius: 999px;
	padding: 6px 10px;
	font-size: 0.85rem;
}
.counter--ok {
	color: var(--success);
	border-color: rgba(34, 197, 94, 0.3);
	background: rgba(34, 197, 94, 0.08);
}
.counter--notok {
	color: var(--error);
	border-color: rgba(239, 68, 68, 0.3);
	background: rgba(239, 68, 68, 0.08);
}

.hero__preview {
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 0;
}
.hero__card {
	width: 100%;
	max-width: 560px;
	padding: 18px;
}
.hero__card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.hero__list {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-top: 10px;
}

.list-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.1);
	border-radius: var(--radius-sm);
	padding: 12px;
}
.list-item__meta {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.date {
	color: var(--muted);
	font-size: 0.9rem;
}
.chips {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}

.skeleton {
	height: 58px;
	border-radius: var(--radius-sm);
	background: linear-gradient(
		90deg,
		rgba(255, 255, 255, 0.04),
		rgba(255, 255, 255, 0.08),
		rgba(255, 255, 255, 0.04)
	);
	animation: shimmer 1.2s infinite linear;
	background-size: 200% 100%;
}
@keyframes shimmer {
	0% {
		background-position: 0 0;
	}
	100% {
		background-position: 200% 0;
	}
}

@media (max-width: 980px) {
	.hero {
		grid-template-columns: 1fr;
	}
}
@media (max-width: 420px) {
	.hero__cta {
		flex-direction: column;
	}
	.hero__card {
		padding: 14px;
	}
}
</style>
