<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import {
	getAllSessions,
	getKnownPlayers,
	listRemoteSessionsIntoLocal,
	syncLocalUnsyncedSessions,
	renamePlayer,
} from "../stores/sessionStore";
import { useRouter } from "vue-router";
import { deletePlayer } from "../stores/sessionStore";
import { getSession } from "../lib/supabaseClient";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";

type PlayerStats = {
	player: string;
	gamesPlayed: number;
	sessionsParticipated: number;
	totalPoints: number;
	avgPoints: number;
	asTaker: number;
	takerWins: number;
	takerAvg: number;
	contractCounts: Record<string, number>;
	boutsCounts: Record<number, number>;
	petitBoutFor: number;
	petitBoutAgainst: number;
};

const loading = ref(true);
const players = ref<string[]>([]);
const router = useRouter();
const renameDialog = ref(false);
const renameFrom = ref("");
const renameTo = ref("");
const deleteDialog = ref(false);
const deleteName = ref("");
const isLargeScreen = ref<boolean>(window.innerWidth >= 640);
const isPro = computed(() => proEnabled.value);

onMounted(async () => {
	const { data } = await getSession();
	if (data.session) {
		// Charge le statut Premium utilisateur
		await refreshProFromSupabase();
		await syncLocalUnsyncedSessions();
		await listRemoteSessionsIntoLocal();
	}
	players.value = getKnownPlayers();
	loading.value = false;
});

window.addEventListener("resize", () => {
	isLargeScreen.value = window.innerWidth >= 640;
});

const sessions = computed(() => getAllSessions());

function buildStats(): PlayerStats[] {
	const stats: Record<string, PlayerStats> = {};
	const add = (name: string) => {
		if (!stats[name])
			stats[name] = {
				player: name,
				gamesPlayed: 0,
				sessionsParticipated: 0,
				totalPoints: 0,
				avgPoints: 0,
				asTaker: 0,
				takerWins: 0,
				takerAvg: 0,
				contractCounts: {
					prise: 0,
					garde: 0,
					garde_sans: 0,
					garde_contre: 0,
				},
				boutsCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
				petitBoutFor: 0,
				petitBoutAgainst: 0,
			};
	};

	// sessions set per player to compute sessionsParticipated
	const perPlayerSessions = new Map<string, Set<string>>();

	for (const s of sessions.value) {
		for (const p of s.participants) {
			add(p);
			if (!perPlayerSessions.has(p)) perPlayerSessions.set(p, new Set());
			perPlayerSessions.get(p)!.add(s.id);
		}
		for (const g of s.games) {
			for (const [p, pts] of Object.entries(g.scores)) {
				add(p);
				const st = stats[p]!;
				st.gamesPlayed += 1;
				st.totalPoints += Number(pts) || 0;
			}
			const taker = g.details?.taker;
			const contract = g.details?.contract;
			const bouts = g.details?.bouts;
			if (taker) {
				add(taker);
				const st = stats[taker]!;
				st.asTaker += 1;
				const takerPts = Number(g.scores[taker] ?? 0);
				if (takerPts > 0) st.takerWins += 1;
				st.takerAvg += takerPts;
				if (contract)
					st.contractCounts[contract] =
						(st.contractCounts[contract] || 0) + 1;
				if (bouts != null)
					st.boutsCounts[bouts] = (st.boutsCounts[bouts] || 0) + 1;
				if (g.details?.petitAuBout === "preneur") st.petitBoutFor += 1;
				if (g.details?.petitAuBout === "defense")
					st.petitBoutAgainst += 1;
			}
		}
	}

	for (const [p, st] of Object.entries(stats)) {
		st.sessionsParticipated = perPlayerSessions.get(p)?.size || 0;
		st.avgPoints = st.gamesPlayed
			? Math.round((st.totalPoints / st.gamesPlayed) * 10) / 10
			: 0;
		st.takerAvg = st.asTaker
			? Math.round((st.takerAvg / st.asTaker) * 10) / 10
			: 0;
	}

	// sort by total points desc by default
	return Object.values(stats).sort((a, b) => b.totalPoints - a.totalPoints);
}

const stats = computed(() => buildStats());

function openRename(name: string) {
	renameFrom.value = name;
	renameTo.value = name;
	renameDialog.value = true;
}

async function confirmRename() {
	const from = renameFrom.value.trim();
	const to = renameTo.value.trim();
	if (!from || !to || from === to) {
		renameDialog.value = false;
		return;
	}
	await renamePlayer(from, to);
	players.value = getKnownPlayers();
	renameDialog.value = false;
}

function goToPlayer(name: string) {
	router.push({ name: "player-stats", params: { name } });
}

function openDelete(name: string) {
	deleteName.value = name;
	deleteDialog.value = true;
}

async function confirmDelete() {
	const name = deleteName.value;
	if (!name) {
		deleteDialog.value = false;
		return;
	}
	await deletePlayer(name);
	players.value = getKnownPlayers();
	deleteDialog.value = false;
}

function unlocked(idx: number): boolean {
	return isPro.value || idx === 0;
}
</script>

<template>
	<section class="container stats">
		<header class="stats__header">
			<h1>Analyse des joueurs</h1>
			<p class="subtitle">
				Scores, prises et réussites — tout en un clin d’œil.
			</p>
		</header>

		<div v-if="!sessions.length" class="empty card">
			<h3>Aucune session</h3>
			<p class="muted">
				Créez votre première table depuis le tableau de bord.
			</p>
		</div>

		<div v-if="loading" class="grid">
			<div class="skeleton" v-for="i in 6" :key="i"></div>
		</div>

		<div v-else class="grid">
			<div v-if="!isPro && sessions.length" class="pro-banner card elev-2">
				<strong>Premium</strong>
				<span class="muted"
					>Débloquez toutes les statistiques pour 4,99€ / an</span
				>
				<router-link class="btn btn-primary" :to="{ name: 'billing' }"
					>Voir l'offre</router-link
				>
			</div>
			<article
				v-for="(s, idx) in stats"
				:key="s.player"
				class="card elev-2 stat"
				:class="{ locked: !unlocked(idx) }"
			>
				<header class="stat__header">
					<div class="flex items-center">
						<h3>{{ s.player }}</h3>
						<v-btn
							icon
							variant="plain"
							@click="openRename(s.player)"
						>
							<i class="mdi mdi-pencil"></i>
						</v-btn>
					</div>
					<div class="actions">
						<button
							v-if="unlocked(idx)"
							class="btn btn-primary"
							@click="goToPlayer(s.player)"
						>
							Détails
						</button>
						<router-link
							v-else
							:to="{ name: 'billing' }"
							class="flex items-center premium-banner"
						>
							<span class="">Premium</span>
							<v-btn icon variant="plain">
								<i class="mdi mdi-lock-open-outline"></i>
							</v-btn>
						</router-link>

						<button
							v-if="isLargeScreen"
							class="btn btn-danger"
							@click="openDelete(s.player)"
						>
							Supprimer
						</button>
						<button
							v-else
							class="btn btn-danger"
							@click="openDelete(s.player)"
						>
							<i class="mdi mdi-delete"></i>
						</button>
					</div>
				</header>
				<div class="muted small">
					{{ s.sessionsParticipated }} sessions ·
					{{ s.gamesPlayed }} parties
				</div>
				<div class="metrics">
					<div class="kpi">
						<span class="kpi__label">Total</span>
						<span
							class="kpi__value"
							:class="{
								'is-pos': s.totalPoints > 0,
								'is-neg': s.totalPoints < 0,
							}"
							>{{ s.totalPoints }}</span
						>
					</div>
					<div class="kpi">
						<span class="kpi__label">Moy</span>
						<span
							class="kpi__value"
							:class="{
								'is-pos': s.avgPoints > 0,
								'is-neg': s.avgPoints < 0,
							}"
							>{{ s.avgPoints }}</span
						>
					</div>
					<div class="kpi">
						<span class="kpi__label">Preneur</span>
						<span class="kpi__value">{{ s.asTaker }}</span>
					</div>
					<div class="kpi">
						<span class="kpi__label">Réussites</span>
						<span class="kpi__value">{{ s.takerWins }}</span>
					</div>
					<div class="kpi">
						<span class="kpi__label">Moy preneur</span>
						<span
							class="kpi__value"
							:class="{
								'is-pos': s.takerAvg > 0,
								'is-neg': s.takerAvg < 0,
							}"
							>{{ s.takerAvg }}</span
						>
					</div>
				</div>

				<div class="divider"></div>

				<div class="section">
					<div class="section__title">Contrats (en preneur)</div>
					<div class="chips">
						<span
							class="pill pill-soft"
							v-for="(n, c) in s.contractCounts"
							:key="c"
						>
							<span class="pill-key">{{
								c === "garde_sans"
									? "Garde Sans"
									: c === "garde_contre"
									? "Garde Contre"
									: c === "garde"
									? "Garde"
									: c === "prise"
									? "Prise"
									: c
							}}</span>
							<span class="pill-val">{{ n }}</span>
						</span>
					</div>
				</div>

				<div class="section">
					<div class="section__title">
						Nombre de Bouts (en preneur)
					</div>
					<div class="chips">
						<span
							v-for="b in [0, 1, 2, 3]"
							:key="b"
							class="pill pill-soft"
						>
							<span class="pill-key">{{ b }}</span>
							<span class="pill-val">{{
								s.boutsCounts[b] || 0
							}}</span>
						</span>
					</div>
				</div>
			</article>
		</div>

		<v-dialog v-model="renameDialog" max-width="500">
			<v-card>
				<v-card-title class="text-h6 font-weight-bold"
					>Renommer un joueur</v-card-title
				>
				<v-card-text>
					<v-text-field
						v-model="renameFrom"
						label="Ancien nom"
						disabled
						variant="outlined"
						density="comfortable"
						class="mb-3"
					/>
					<v-text-field
						v-model="renameTo"
						label="Nouveau nom"
						variant="outlined"
						density="comfortable"
					/>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="renameDialog = false"
						>Annuler</v-btn
					>
					<v-btn color="deep-purple-accent-2" @click="confirmRename"
						>Renommer</v-btn
					>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog v-model="deleteDialog" max-width="480">
			<v-card>
				<v-card-title class="text-h6 font-weight-bold"
					>Supprimer un joueur</v-card-title
				>
				<v-card-text>
					Êtes-vous sûr de vouloir supprimer « {{ deleteName }} » ?
					Cette action supprime ce nom des participants et parties
					locales. Les enregistrements distants liés seront
					anonymisés.
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="deleteDialog = false"
						>Annuler</v-btn
					>
					<v-btn color="red-darken-2" @click="confirmDelete"
						>Supprimer</v-btn
					>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</section>
</template>

<style scoped>
.premium-banner {
	color: var(--third_color2);
}

.stats__header {
	margin: 10px 0 18px;
}
.stats__header h1 {
	font-size: clamp(1.6rem, 1.8vw + 1rem, 2.2rem);
	margin: 6px 0;
}
.subtitle {
	color: var(--text-secondary);
}

.grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16px;
}
/* Premium banner inside grid */
.pro-banner {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 12px 14px;
}
@media (max-width: 1290px) {
	.grid {
		grid-template-columns: repeat(2, 1fr);
	}
}
@media (max-width: 1030px) {
	.grid {
		grid-template-columns: 1fr;
	}
}

.stat {
	padding: 16px;
	position: relative;
}
.stat__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
}
.actions {
	display: flex;
	gap: 8px;
}
.small {
	font-size: 0.875rem;
}

.metrics {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 10px;
	margin: 12px 0;
}
.kpi {
	background: var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.1);
	border-radius: var(--radius-sm);
	padding: 10px;
	display: grid;
	gap: 4px;
}
.kpi__label {
	color: var(--muted);
	font-size: 0.8rem;
}
.kpi__value {
	font-weight: 800;
}
.is-pos {
	color: var(--success);
}
.is-neg {
	color: var(--danger);
}
.pill-soft {
	background: var(--bg-elev-1);
	border-color: rgba(185, 194, 232, 0.16);
}
.pill-key {
	color: var(--muted);
	margin-right: 6px;
}
.pill-val {
	font-weight: 700;
}

.section {
	margin-top: 10px;
}
.section__title {
	color: var(--text-secondary);
	margin-bottom: 6px;
}
.chips {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}

/* Responsive metrics grid */
@media (max-width: 1100px) {
	.metrics {
		grid-template-columns: repeat(3, 1fr);
	}
}
@media (max-width: 700px) {
	.metrics {
		grid-template-columns: repeat(2, 1fr);
	}
}
@media (max-width: 420px) {
	.metrics {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 310px) {
	.actions .btn.btn-ghost {
		padding-inline: 8px;
		font-size: 0.75rem;
	}
	.actions .btn.action-btn {
		padding-inline: 8px;
		font-size: 0.75rem;
	}
}

.skeleton {
	height: 160px;
	border-radius: var(--radius-md);
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

/* Lock state: blur non-essential content */
.locked .muted.small,
.locked .metrics,
.locked .section,
.locked .divider {
	filter: blur(4px);
	pointer-events: none;
	user-select: none;
}
</style>
