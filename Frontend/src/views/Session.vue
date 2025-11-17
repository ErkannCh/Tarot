<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	getSessionById,
	computeTotals,
	removeGame,
	type Session,
} from "../stores/sessionStore";

const router = useRouter();
const route = useRoute();
const sessionId = route.params.id as string;
const session = getSessionById(sessionId) as Session | null;

const isLargeScreen = ref(true);

const handleResize = () => {
	if (typeof window !== "undefined") {
		isLargeScreen.value = window.innerWidth >= 770;
	}
};

onMounted(() => {
	handleResize();
	if (typeof window !== "undefined") {
		window.addEventListener("resize", handleResize);
	}
});

onBeforeUnmount(() => {
	if (typeof window !== "undefined") {
		window.removeEventListener("resize", handleResize);
	}
});

const participants = computed(() => session?.participants ?? []);
const totals = computed(() => (session ? computeTotals(session) : {}));

function cancel() {
	if (!session) {
		router.push({ name: "dashboard" });
		return;
	}
	router.push({ name: "session", params: { id: session.id } });
}

function editGame(gameId: string) {
	if (!session) return;
	router.push({
		name: "session-add-game",
		params: { id: session.id },
		query: { gameId },
	});
}

function deleteGame(gameId: string) {
	if (!session) return;
	// Confirmation simple pour éviter les suppressions accidentelles
	if (confirm("Supprimer cette partie ?")) {
		removeGame(session.id, gameId);
	}
}
</script>

<template>
	<v-main class="bg-[var(--bg-color)]" style="min-height: 100vh">
		<section class="container session">
			<v-alert v-if="!session" type="error" variant="tonal">
				Session introuvable.
			</v-alert>

			<template v-else>
				<div class="session-top mt-10">
					<div>
						<router-link
							v-if="isLargeScreen"
							class="btn btn-ghost"
							:to="{ name: 'dashboard' }"
						>
							← Retour au dashboard
						</router-link>
						<button v-else class="btn btn-ghost" @click="cancel">
							<i class="mdi mdi-arrow-left"></i>
						</button>
					</div>

					<div class="session__header">
						<div class="session__actions">
							<router-link
								v-if="isLargeScreen"
								class="btn btn-primary"
								:to="{
									name: 'session-add-game',
									params: { id: session.id },
								}"
							>
								Ajouter une partie
							</router-link>
							<button
								v-else
								class="btn btn-primary"
								@click="
									router.push({
										name: 'session-add-game',
										params: { id: session.id },
									})
								"
							>
								<i class="mdi mdi-plus"></i>
							</button>

							<router-link
								v-if="isLargeScreen"
								class="btn btn-ghost"
								:to="{
									name: 'session-stats',
									params: { id: session.id },
								}"
							>
								Statistiques
							</router-link>
							<button
								v-else
								class="btn btn-ghost"
								@click="
									router.push({
										name: 'session-stats',
										params: { id: session.id },
									})
								"
							>
								<i class="mdi mdi-chart-bar"></i>
							</button>
						</div>
					</div>
				</div>

				<div class="card elev-2 mb-6">
					<h3 class="muted mb-4">Scores</h3>
					<div class="grid-players">
						<div v-for="p in participants" :key="p" class="player">
							<div class="player__name muted">{{ p }}</div>
							<div
								class="player__score"
								:class="{
									'is-pos': (totals[p] ?? 0) > 0,
									'is-neg': (totals[p] ?? 0) < 0,
								}"
							>
								{{ totals[p] ?? 0 }}
							</div>
						</div>
					</div>
				</div>

				<div class="card elev-2">
					<h3 class="muted mb-3">Parties jouées</h3>
					<div v-if="!session.games.length" class="muted">
						Aucune partie pour le moment.
					</div>

					<!-- TABLEAU CLASSIQUE SUR GRAND ÉCRAN -->
					<div v-else-if="isLargeScreen" class="table-wrapper">
						<table class="table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Preneur</th>
									<th>Contrat</th>
									<th
										v-for="p in participants"
										:key="p"
										class="text-right"
									>
										{{ p }}
									</th>
									<th class="text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="g in session.games" :key="g.id">
									<td>
										{{
											new Date(
												g.timestamp
											).toLocaleString()
										}}
									</td>
									<td>{{ g.details?.taker || "-" }}</td>
									<td>
										{{
											g.details?.contract
												? g.details.contract
														.replace(/_/g, " ")
														.replace(
															/\b\w/g,
															(c: string) =>
																c.toUpperCase()
														)
												: "-"
										}}
									</td>
									<td
										v-for="p in participants"
										:key="p"
										class="text-right"
									>
										<span
											:class="{
												'is-pos':
													(g.scores[p] ?? 0) > 0,
												'is-neg':
													(g.scores[p] ?? 0) < 0,
											}"
										>
											{{ g.scores[p] ?? 0 }}
										</span>
									</td>
									<td class="text-right actions-cell">
										<button
											type="button"
											class="icon-btn"
											@click="editGame(g.id)"
										>
											<i class="mdi mdi-pencil"></i>
										</button>
										<button
											type="button"
											class="icon-btn icon-btn--danger"
											@click="deleteGame(g.id)"
										>
											<i class="mdi mdi-delete"></i>
										</button>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- VERSION CARTES SUR MOBILE -->
					<div v-else class="games-cards">
						<article
							v-for="g in session.games"
							:key="g.id"
							class="game-card"
						>
							<header class="game-card__header">
								<div class="game-card__date">
									{{ new Date(g.timestamp).toLocaleString() }}
								</div>
								<div class="game-card__contract">
									{{ g.details?.contract
										? g.details.contract
												.replace(/_/g, " ")
												.replace(/\b\w/g, (c: string) =>
													c.toUpperCase()
												)
										: "-" }}
								</div>
								<div class="game-card__actions">
									<button
										type="button"
										class="icon-btn"
										@click="editGame(g.id)"
									>
										<i class="mdi mdi-pencil"></i>
									</button>
									<button
										type="button"
										class="icon-btn icon-btn--danger"
										@click="deleteGame(g.id)"
									>
										<i class="mdi mdi-delete"></i>
									</button>
								</div>
							</header>
							<div class="game-card__body">
								<div class="game-card__taker">
									<span class="label">Preneur</span>
									<span class="value">{{
										g.details?.taker || "-"
									}}</span>
								</div>
								<ul class="game-card__scores">
									<li
										v-for="p in participants"
										:key="p"
										class="game-card__score-row"
									>
										<span class="label">{{ p }}</span>
										<span
											class="value"
											:class="{
												'is-pos':
													(g.scores[p] ?? 0) > 0,
												'is-neg':
													(g.scores[p] ?? 0) < 0,
											}"
										>
											{{ g.scores[p] ?? 0 }}
										</span>
									</li>
								</ul>
							</div>
						</article>
					</div>
				</div>
			</template>
		</section>
	</v-main>
</template>

<style scoped>
.session {
	max-width: 1200px;
	margin: 0 auto;
	padding: 1.25rem 1rem 3rem;
}

@media (min-width: 768px) {
	.session {
		padding: 2rem 1rem 3rem;
	}
}

.session-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	flex-wrap: wrap;
	margin-bottom: 20px;
}

.session__header {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12px;
}

.session__actions {
	display: flex;
	gap: 10px;
	flex-wrap: wrap;
}

.grid-players {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 12px;
}

.player {
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border-subtle);
	border-radius: var(--radius-md);
	padding: 14px;
	text-align: center;
}
.player__name {
	margin-bottom: 6px;
}
.player__score {
	font-weight: 800;
	font-size: 1.3rem;
}
.player__score.is-pos {
	color: var(--success);
}
.player__score.is-neg {
	color: var(--danger);
}
.is-pos {
	color: var(--success);
}
.is-neg {
	color: var(--danger);
}

/* TABLEAU (desktop) */
.table-wrapper {
	width: 100%;
	overflow-x: auto;
}
.table {
	width: 100%;
	border-collapse: collapse;
	min-width: 520px;
}
.table th,
.table td {
	padding: 10px 8px;
	border-bottom: 1px solid var(--surface-border);
	text-align: left;
	white-space: nowrap;
}
.table th {
	color: var(--text-secondary);
	font-weight: 600;
}
.table td.text-right,
.table th.text-right {
	text-align: right;
}

.actions-cell {
	white-space: nowrap;
}

.icon-btn {
	background: transparent;
	border: none;
	padding: 4px;
	margin-left: 4px;
	cursor: pointer;
	color: var(--text-secondary);
}

.icon-btn--danger {
	color: var(--danger);
}

/* CARTES (mobile) */
.games-cards {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.game-card {
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border-subtle);
	border-radius: var(--radius-md);
	padding: 0.75rem 0.85rem;
}
.game-card__header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
}
.game-card__date {
	font-size: 0.75rem;
	color: var(--text-secondary);
}
.game-card__contract {
	font-weight: 600;
}
.game-card__actions {
	display: flex;
	align-items: center;
	gap: 4px;
}
.game-card__taker {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.5rem;
	gap: 0.5rem;
}
.game-card .label {
	font-size: 0.75rem;
	color: var(--text-secondary);
}
.game-card .value {
	font-weight: 600;
}
.game-card__scores {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem 0.75rem;
}
.game-card__score-row {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	background: rgba(0, 0, 0, 0.03);
	border-radius: 9999px;
	padding: 0.25rem 0.6rem;
}
.game-card__score-row .value {
	min-width: 2.5rem;
	text-align: center;
}

@media (max-width: 600px) {
	.session {
		padding-inline: 0.75rem;
	}
}
</style>
