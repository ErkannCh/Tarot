<script setup lang="ts">
import {
	computed,
	reactive,
	ref,
	watch,
	onMounted,
	onBeforeUnmount,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	getSessionById,
	addGame,
	updateGame,
	type Session,
	type GameDetails,
	type Contract,
	type PetitAuBout,
	type Poignee,
	type Chelem,
	type Game,
} from "../stores/sessionStore";

import {
	LS_MISERY,
	LS_MISERY_ATOUT,
	LS_MISERY_TETE,
	LS_SCORE_CONFIG,
	readMiseryAtout,
	readMiseryTete,
	readScoreConfig,
	type ScoreConfig,
} from "../lib/settings";

const route = useRoute();
const router = useRouter();
const sessionId = route.params.id as string;
const session = getSessionById(sessionId) as Session | null;
const editingGameId = ref<string | null>(null);

const draftScores = reactive<Record<string, number>>({});
if (session) {
	for (const p of session.participants) draftScores[p] = 0;
}

const participants = computed(() => session?.participants ?? []);

// Settings (misère toggles + score configuration)
const miseryAtoutEnabled = ref(true);
const miseryTeteEnabled = ref(true);
const scoreCfg = ref<ScoreConfig>(readScoreConfig());

function refreshSettings() {
	miseryAtoutEnabled.value = readMiseryAtout();
	miseryTeteEnabled.value = readMiseryTete();
}

function onStorage(e: StorageEvent) {
	if (!e.key) return;
	if ([LS_MISERY, LS_MISERY_ATOUT, LS_MISERY_TETE].includes(e.key)) {
		refreshSettings();
	}
	if (e.key === LS_SCORE_CONFIG) {
		scoreCfg.value = readScoreConfig();
	}
}

onMounted(() => {
	refreshSettings();
	scoreCfg.value = readScoreConfig();
	const rawGameId = route.query.gameId;
	editingGameId.value = typeof rawGameId === "string" ? rawGameId : null;
	if (editingGameId.value && session) {
		const existing = session.games.find(
			(g) => g.id === editingGameId.value
		);
		if (existing) {
			loadFromGame(existing);
		} else {
			resetForm();
		}
	} else {
		resetForm();
	}
	window.addEventListener("storage", onStorage);
});

onBeforeUnmount(() => {
	window.removeEventListener("storage", onStorage);
});

// Form state
const contract = ref<Contract>("prise");
// Sélection des bouts détenus par le preneur
const boutsCards = ref<Array<"petit" | "21" | "excuse">>([]);
const boutsCount = computed(
	() => Math.min(3, Math.max(0, boutsCards.value.length)) as 0 | 1 | 2 | 3
);
const takerPoints = ref<number>(41);
const petitAuBout = ref<PetitAuBout>("none");
const poignee = ref<Poignee>("none");
const miseres = ref<string[]>([]);
const miseresTete = ref<string[]>([]);
const chelem = ref<Chelem>("none");
// Grand chelem supprimé des règles (FFT)
const taker = ref<string>(participants.value[0] ?? "");
const called = ref<string | null>(null);

const showCalled = computed(() => participants.value.length >= 5);
// À 5 joueurs, tous les participants sont éligibles, y compris le preneur
const calledOptions = computed(() => participants.value);

const contractLabelMap: Record<Contract, string> = {
	prise: "Prise",
	garde: "Garde",
	garde_sans: "Garde sans",
	garde_contre: "Garde contre",
};
const contractLabel = computed(() => contractLabelMap[contract.value]);

function formatSigned(n: number): string {
	if (n === 0) return "0";
	const sign = n > 0 ? "+" : "-";
	return `${sign}${Math.abs(n)}`;
}

watch(participants, (ps) => {
	if (!ps.length) return;
	if (!ps.includes(taker.value)) taker.value = ps[0] ?? "";
	if (called.value && !ps.includes(called.value)) called.value = null;
});

watch(takerPoints, (val) => {
	const n = Math.min(91, Math.max(0, Number(val ?? 0)));
	if (n !== val) {
		takerPoints.value = n;
	}
});

function resetForm() {
	contract.value = "prise";
	boutsCards.value = [];
	takerPoints.value = 41;
	petitAuBout.value = "none";
	poignee.value = "none";
	miseres.value = [];
	miseresTete.value = [];
	chelem.value = "none";
	// grand chelem supprimé
	taker.value = participants.value[0] ?? "";
	called.value = null;
	for (const p of participants.value) draftScores[p] = 0;
}

function loadFromGame(game: Game) {
	const d = game.details;
	if (!d) {
		resetForm();
		return;
	}
	contract.value = d.contract;
	boutsCards.value = Array.isArray(d.bouts_detail) ? [...d.bouts_detail] : [];
	takerPoints.value = d.takerPoints;
	petitAuBout.value = d.petitAuBout;
	poignee.value = d.poignee;
	miseres.value = Array.isArray(d.miseres) ? [...d.miseres] : [];
	miseresTete.value = Array.isArray(d.miseres_tete)
		? [...d.miseres_tete]
		: [];
	chelem.value = d.chelem ?? "none";
	taker.value = d.taker;
	called.value = d.called ?? null;
	for (const p of participants.value) {
		draftScores[p] = Number(game.scores[p] ?? 0);
	}
}

function toggleBout(k: "petit" | "21" | "excuse") {
	const s = new Set(boutsCards.value);
	if (s.has(k)) s.delete(k);
	else s.add(k);
	boutsCards.value = Array.from(s);
}

function scoreMultiplier(c: Contract): number {
	const m = scoreCfg.value.multipliers;
	return c === "prise"
		? m.prise
		: c === "garde"
		? m.garde
		: c === "garde_sans"
		? m.garde_sans
		: m.garde_contre;
}

function thresholdForBouts(n: 0 | 1 | 2 | 3): number {
	return n === 0 ? 56 : n === 1 ? 51 : n === 2 ? 41 : 36;
}

function computeTeamScore(): number {
	const target = thresholdForBouts(boutsCount.value);
	const mult = scoreMultiplier(contract.value);
	const diff = Math.abs(takerPoints.value - target);
	const sign = takerPoints.value >= target ? 1 : -1;
	let s = (scoreCfg.value.base + diff) * mult * sign;
	if (petitAuBout.value === "preneur")
		s += scoreCfg.value.petit_au_bout * mult;
	else if (petitAuBout.value === "defense")
		s -= scoreCfg.value.petit_au_bout * mult;
	const poigneeMap: Record<"simple" | "double" | "triple", number> =
		scoreCfg.value.poignee;
	if (poignee.value !== "none") {
		const [_side, lvl] = poignee.value.split("_") as [
			"taker" | "defense",
			"simple" | "double" | "triple"
		];
		const val = poigneeMap[lvl];
		s += _side === "taker" ? val : -val;
	}
	const chelemMap: Record<Chelem, number> = {
		none: 0,
		non_annonce_reussi: scoreCfg.value.chelem.non_annonce_reussi,
		annonce_reussi: scoreCfg.value.chelem.annonce_reussi,
		annonce_rate: scoreCfg.value.chelem.annonce_rate,
	};
	s += chelemMap[chelem.value] || 0;
	return s;
}

function computeSuggestedScores(): Record<string, number> {
	const result: Record<string, number> = {};
	const total = computeTeamScore();
	for (const p of participants.value) {
		if (p === taker.value) continue;
		const isCalled = showCalled.value && called.value && p === called.value;
		result[p] = isCalled ? total : -total;
	}
	const sumOthers = Object.values(result).reduce((a, b) => a + b, 0);
	result[taker.value] = -sumOthers;
	return result;
}

const suggested = computed(() => computeSuggestedScores());

const breakdown = computed(() => {
	const target = thresholdForBouts(boutsCount.value);
	const mult = scoreMultiplier(contract.value);
	const diff = Math.abs(takerPoints.value - target);
	const sign = takerPoints.value >= target ? 1 : -1;
	const basePart = scoreCfg.value.base;
	let poigneeVal = 0;
	if (poignee.value !== "none") {
		const [_side, lvl] = poignee.value.split("_") as [
			"taker" | "defense",
			"simple" | "double" | "triple"
		];
		poigneeVal =
			_side === "taker"
				? scoreCfg.value.poignee[lvl]
				: -scoreCfg.value.poignee[lvl];
	}
	const petitVal =
		petitAuBout.value === "preneur"
			? scoreCfg.value.petit_au_bout * mult
			: petitAuBout.value === "defense"
			? -scoreCfg.value.petit_au_bout * mult
			: 0;
	const resultBase = (basePart + diff) * mult * sign;
	const chelemMap: Record<string, number> = {
		none: 0,
		non_annonce_reussi: scoreCfg.value.chelem.non_annonce_reussi,
		annonce_reussi: scoreCfg.value.chelem.annonce_reussi,
		annonce_rate: scoreCfg.value.chelem.annonce_rate,
	};
	const chelemVal = chelemMap[chelem.value] ?? 0;
	const total = resultBase + petitVal + poigneeVal + chelemVal;
	return {
		target,
		mult,
		diff,
		sign,
		basePart,
		petitVal,
		poigneeVal,
		chelemVal,
		resultBase,
		total,
	};
});

const defensePoints = computed(() =>
	Math.max(0, 91 - Number(takerPoints.value ?? 0))
);
const defensePointsInput = computed({
	get() {
		return defensePoints.value;
	},
	set(val: number) {
		const n = Number(val ?? 0);
		const clamped = Math.min(91, Math.max(0, n));
		takerPoints.value = Math.max(0, 91 - clamped);
	},
});
const attackSucceeds = computed(() => (breakdown.value.sign ?? 0) > 0);
const attackScoreBase = computed(() => Number(breakdown.value.resultBase ?? 0));

async function saveGame() {
	if (!session) return;
	const suggestedScores = computeSuggestedScores();
	for (const p of participants.value) {
		draftScores[p] = Number(suggestedScores[p] ?? 0);
	}
	const details: GameDetails = {
		taker: taker.value,
		called: showCalled.value ? called.value ?? null : null,
		contract: contract.value,
		bouts: boutsCount.value,
		bouts_detail: boutsCards.value,
		takerPoints: takerPoints.value,
		petitAuBout: petitAuBout.value,
		poignee: poignee.value,
		miseres: miseryAtoutEnabled.value ? miseres.value : [],
		miseres_tete: miseryTeteEnabled.value ? miseresTete.value : [],
		chelem: chelem.value,
		// pas de grand chelem
	};
	if (editingGameId.value) {
		updateGame(
			session.id,
			editingGameId.value,
			{ ...draftScores },
			details
		);
	} else {
		await addGame(session.id, { ...draftScores }, undefined, details);
		resetForm();
	}
	router.push({ name: "session", params: { id: session.id } });
}

function cancel() {
	if (!session) {
		router.push({ name: "dashboard" });
		return;
	}
	router.push({ name: "session", params: { id: session.id } });
}
</script>

<template>
	<v-main class="bg-[var(--bg-color)]" style="min-height: 100vh">
		<section class="container add-game">
			<header class="add-game__header">
				<router-link
					class="btn btn-ghost"
					:to="{ name: 'session', params: { id: sessionId } }"
					>← Retour à la session</router-link
				>
			</header>

			<v-alert v-if="!session" type="error" variant="tonal">
				Session introuvable.
			</v-alert>

			<template v-else>
				<article class="card elev-2 add-game__hero">
					<div class="hero-grid">
						<section class="hero-panel">
							<header class="hero-panel__head">
								<h2>Paramètres clés</h2>
								<p class="muted">
									Sélectionnez le contrat, les bouts et le
									preneur.
								</p>
							</header>
							<v-row>
								<v-col cols="12">
									<div class="choice-group">
										<div class="choice-title">Contrat</div>
										<div class="choices">
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active:
														contract === 'prise',
												}"
												@click="contract = 'prise'"
											>
												Prise
											</button>
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active:
														contract === 'garde',
												}"
												@click="contract = 'garde'"
											>
												Garde
											</button>
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active:
														contract ===
														'garde_sans',
												}"
												@click="contract = 'garde_sans'"
											>
												Garde sans
											</button>
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active:
														contract ===
														'garde_contre',
												}"
												@click="
													contract = 'garde_contre'
												"
											>
												Garde contre
											</button>
										</div>
									</div>
								</v-col>
								<v-col cols="12">
									<div class="choice-group">
										<div class="choice-title">
											Bouts du preneur
										</div>
										<div class="choices">
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active: boutsCards.includes(
														'petit'
													),
												}"
												@click="toggleBout('petit')"
											>
												Petit
											</button>
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active: boutsCards.includes(
														'21'
													),
												}"
												@click="toggleBout('21')"
											>
												21
											</button>
											<button
												type="button"
												class="btn btn-choice"
												:class="{
													active: boutsCards.includes(
														'excuse'
													),
												}"
												@click="toggleBout('excuse')"
											>
												Excuse
											</button>
										</div>
										<div
											class="muted"
											style="margin-top: 6px"
										>
											Sélectionnés: {{ boutsCount }}
										</div>
									</div>
								</v-col>
								<v-col cols="12">
									<div class="choice-group">
										<div class="choice-title">Preneur</div>
										<div class="choices choices-wrap">
											<button
												v-for="p in participants"
												:key="p"
												type="button"
												class="btn btn-choice"
												:class="{ active: taker === p }"
												@click="taker = p"
											>
												{{ p }}
											</button>
										</div>
									</div>
								</v-col>
								<v-col cols="12" v-if="showCalled">
									<div class="choice-group">
										<div class="choice-title">Appelé</div>
										<div class="choices choices-wrap">
											<button
												v-for="p in calledOptions"
												:key="p"
												type="button"
												class="btn btn-choice"
												:class="{
													active: called === p,
												}"
												@click="called = p"
											>
												{{ p }}
											</button>
										</div>
									</div>
								</v-col>
							</v-row>
						</section>
						<section class="hero-panel">
							<header class="hero-panel__head">
								<h2>Points &amp; annonces</h2>
								<p class="muted">
									Réglez le score du preneur et les annonces
									spéciales.
								</p>
							</header>
							<v-row>
								<v-col cols="12">
									<div class="slider-head">
										<div class="slider-col left">
											<div class="label">Pts défense</div>
											<input
												class="value mini-input"
												type="number"
												v-model.number="defensePointsInput"
												min="0"
												max="91"
											/>
										</div>
										<div class="slider-col center">
											<div class="label">Score</div>
											<div
												class="value"
												:class="{
													'text-green-500': attackScoreBase > 0,
													'text-red-500': attackScoreBase < 0,
												}"
											>
												{{ attackScoreBase }}
											</div>
										</div>
										<div class="slider-col right">
											<div class="label">Pts Attaque</div>
											<input
												class="value mini-input"
												type="number"
												v-model.number="takerPoints"
												min="0"
												max="91"
											/>
										</div>
									</div>
									<v-slider
										v-model="takerPoints"
										:min="0"
										:max="91"
										step="1"
										show-ticks="always"
										tick-size="2"
										class="w-100 slider-full"
									/>
								</v-col>
								<v-col cols="12" md="6">
									<v-select
										label="Petit au bout"
										:items="[
											{ title: 'Aucun', value: 'none' },
											{
												title: 'Preneur',
												value: 'preneur',
											},
											{
												title: 'Défense',
												value: 'defense',
											},
										]"
										v-model="petitAuBout"
										variant="outlined"
										density="comfortable"
									/>
								</v-col>
								<v-col cols="12" md="6">
									<v-select
										label="Poignée"
										:items="[
											{ title: 'Aucune', value: 'none' },
											{
												title: 'Preneur — Simple',
												value: 'taker_simple',
											},
											{
												title: 'Preneur — Double',
												value: 'taker_double',
											},
											{
												title: 'Preneur — Triple',
												value: 'taker_triple',
											},
											{
												title: 'Défense — Simple',
												value: 'defense_simple',
											},
											{
												title: 'Défense — Double',
												value: 'defense_double',
											},
											{
												title: 'Défense — Triple',
												value: 'defense_triple',
											},
										]"
										v-model="poignee"
										variant="outlined"
										density="comfortable"
									/>
								</v-col>
								<v-col cols="12" md="6">
									<v-select
										label="Chelem"
										:items="[
											{ title: 'Aucun', value: 'none' },
											{
												title: 'Non annoncé (réussi)',
												value: 'non_annonce_reussi',
											},
											{
												title: 'Annoncé (réussi)',
												value: 'annonce_reussi',
											},
											{
												title: 'Annoncé (raté)',
												value: 'annonce_rate',
											},
										]"
										v-model="chelem"
										variant="outlined"
										density="comfortable"
									/>
								</v-col>
								<v-col cols="12" v-if="miseryAtoutEnabled">
									<v-combobox
										v-model="miseres"
										:items="participants"
										multiple
										chips
										label="Misère d'atouts (joueurs)"
										hint="Sélectionnez les joueurs concernés"
										persistent-hint
										variant="outlined"
										density="comfortable"
									/>
								</v-col>
								<v-col cols="12" v-if="miseryTeteEnabled">
									<v-combobox
										v-model="miseresTete"
										:items="participants"
										multiple
										chips
										label="Misère de tête (joueurs)"
										hint="Sélectionnez les joueurs concernés"
										persistent-hint
										variant="outlined"
										density="comfortable"
									/>
								</v-col>
							</v-row>
						</section>
					</div>
				</article>

				<article class="card elev-2 add-game__details">
					<div class="details-grid">
						<section class="detail-card">
							<header class="detail-card__head">
								<h3>Résumé du calcul</h3>
							</header>
							<div class="detail-metrics">
								<div class="metric">
									<span class="metric-label"
										>Seuil (bouts {{ boutsCount }})</span
									>
									<span class="metric-value">{{
										breakdown.target
									}}</span>
								</div>
								<div class="metric">
									<span class="metric-label">Base</span>
									<span class="metric-value">{{
										breakdown.basePart
									}}</span>
								</div>
								<div class="metric">
									<span class="metric-label">Écart</span>
									<span class="metric-value"
										>|{{ takerPoints }} −
										{{ breakdown.target }}| =
										{{ breakdown.diff }}</span
									>
								</div>
								<div class="metric">
									<span class="metric-label"
										>Multiplicateur</span
									>
									<span class="metric-value"
										>× {{ breakdown.mult }}</span
									>
								</div>
							</div>
							<div class="detail-metrics detail-metrics--inline">
								<div class="metric-pill">
									<span>Résultat base</span>
									<strong>{{ breakdown.resultBase }}</strong>
								</div>
								<div class="metric-pill">
									<span>Petit au bout</span>
									<strong>{{
										formatSigned(breakdown.petitVal)
									}}</strong>
								</div>
								<div class="metric-pill">
									<span>Poignée</span>
									<strong>{{
										formatSigned(breakdown.poigneeVal)
									}}</strong>
								</div>
								<div class="metric-pill">
									<span>Chelem</span>
									<strong>{{
										formatSigned(breakdown.chelemVal)
									}}</strong>
								</div>
							</div>
							<footer
								class="detail-total"
								:class="{
									'is-pos': breakdown.total >= 0,
									'is-neg': breakdown.total < 0,
								}"
							>
								<span>Total équipe</span>
								<strong>{{
									formatSigned(breakdown.total)
								}}</strong>
							</footer>
						</section>

						<section class="detail-card preview-card">
							<header class="detail-card__head">
								<h3>Prévisualisation des points</h3>
								<p class="muted">
									Récapitulatif final des points attribués aux
									joueurs
								</p>
							</header>
							<div class="table-wrap">
								<table class="preview-table">
									<thead>
										<tr>
											<th>Joueur</th>
											<th class="text-right">Points</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="p in participants" :key="p">
											<td>{{ p }}</td>
											<td
												class="text-right"
												:class="{
													'is-pos':
														(suggested[p] ?? 0) > 0,
													'is-neg':
														(suggested[p] ?? 0) < 0,
												}"
											>
												{{ suggested[p] ?? 0 }}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</section>
					</div>
					<div class="note-card">
						<span class="note-icon">💡</span>
						<span
							>Les points par joueur sont calculés automatiquement
							selon le contrat, les bouts et les annonces. Vous
							pourrez les modifier plus tard.</span
						>
					</div>
					<div class="actions">
						<v-btn variant="text" @click="cancel">Annuler</v-btn>
						<v-btn color="deep-purple-accent-2" @click="saveGame">
							{{ editingGameId ? "Mettre à jour" : "Ajouter" }}
						</v-btn>
					</div>
				</article>
			</template>
		</section>
	</v-main>
</template>

<style scoped>
.add-game {
	display: flex;
	flex-direction: column;
	gap: 18px;
	padding: 32px 24px 80px;
}
.add-game__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 12px;
}
.add-game__summary {
	display: grid;
	gap: 12px;
}
.pill-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.pill-grid--meta .pill {
	background: rgba(139, 92, 246, 0.18);
	border: 1px solid rgba(139, 92, 246, 0.3);
	color: var(--text-primary);
}

.add-game__hero {
	padding: 0;
}
.hero-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 12px;
	padding: 16px;
}

.hero-panel {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid var(--surface-border);
	border-radius: 16px;
	padding: 16px;
	box-shadow: var(--shadow-soft);
}
.hero-panel__head {
	margin-bottom: 12px;
}

.details-grid {
	display: grid;
	gap: 16px;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.detail-card {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid var(--surface-border);
	border-radius: 16px;
	padding: 18px;
	box-shadow: var(--shadow-soft);
	display: grid;
	gap: 14px;
}
.detail-card__head {
	display: flex-column;
}
.detail-card__badge {
	font-size: 0.8rem;
	padding: 4px 10px;
	border-radius: 999px;
	background: linear-gradient(180deg, var(--color3), var(--color4));
	color: #eefdf4;
	border: 1px solid transparent;
}
.detail-card__badge--soft {
	background: rgba(139, 92, 246, 0.16);
	color: var(--text-primary);
	border-color: rgba(139, 92, 246, 0.32);
}
.detail-metrics {
	display: grid;
	gap: 8px;
}
.detail-metrics--inline {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.metric {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 0;
	border-bottom: 1px solid var(--surface-border-subtle);
}
.metric:last-child {
	border-bottom: none;
}
.metric-label {
	font-size: 0.9rem;
	color: var(--text-secondary);
}
.metric-value {
	font-weight: 600;
}
.metric-value.is-pos {
	color: var(--success);
}
.metric-value.is-neg {
	color: var(--danger);
}
.metric-pill {
	background: var(--bg-elev-2);
	border: 1px solid var(--surface-border);
	border-radius: 12px;
	padding: 8px 12px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 140px;
}
.metric-pill span {
	font-size: 0.8rem;
	color: var(--text-secondary);
}
.metric-pill strong {
	font-size: 1rem;
}
.detail-total {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	border-radius: 14px;
	background: var(--surface-tint);
	border: 1px solid var(--surface-border);
	font-weight: 700;
}
.detail-total.is-pos strong {
	color: var(--success);
}
.detail-total.is-neg strong {
	color: var(--danger);
}

.table-wrap {
	overflow: auto;
	border-radius: 12px;
	border: 1px solid var(--surface-border-subtle);
	background: var(--bg-elev-1);
}
.preview-table {
	width: 100%;
	border-collapse: collapse;
}
.preview-table th,
.preview-table td {
	padding: 10px 12px;
	border-bottom: 1px solid var(--surface-border-subtle);
	text-align: left;
}
.preview-table th {
	font-size: 0.85rem;
	color: var(--text-secondary);
	font-weight: 600;
}
.preview-table td.text-right {
	text-align: right;
}
.preview-table tr:last-child td {
	border-bottom: none;
}

.note-card {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-top: 6px;
	padding: 12px 14px;
	border-radius: 14px;
	background: var(--surface-tint);
	border: 1px solid var(--surface-border);
	color: var(--text-secondary);
}
.note-icon {
	font-size: 1.1rem;
}

.choice-group {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin-bottom: 6px;
}
.choice-title {
	font-size: 0.9rem;
	color: var(--text-secondary);
}
.choices {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}
.choices-wrap {
	flex-wrap: wrap;
	overflow: visible;
}

.slider-head {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	align-items: end;
	column-gap: 12px;
	margin-bottom: 6px;
	width: 100%;
}
.slider-col {
	width: 100%;
}
.slider-col.left {
	text-align: left;
}
.slider-col.center {
	text-align: center;
}
.slider-col.right {
	text-align: right;
}
.slider-col .label {
	color: var(--text-secondary);
	font-size: 0.85rem;
}
.slider-col .value {
	font-weight: 800;
}
.slider-full {
	width: 100%;
}
.mini-input {
	max-width: 70px;
	text-align: right;
	background: transparent;
	border: 1px solid var(--surface-border-subtle);
	border-radius: 6px;
	padding: 2px 6px;
	color: inherit;
}

.config-card {
	display: grid;
	gap: 18px;
}
.config-section {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid var(--surface-border);
	border-radius: 16px;
	padding: 16px;
	box-shadow: var(--shadow-soft);
	display: grid;
	gap: 12px;
}
.section-head {
	display: flex;
	align-items: center;
	gap: 12px;
}
.section-icon {
	font-size: 1.4rem;
}
.fields {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 10px;
}
.field {
	display: grid;
	gap: 6px;
}
.field span {
	font-size: 0.9rem;
	color: var(--text-secondary);
}
.inp {
	width: 100%;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--bg-elev-1);
	color: var(--text-primary);
	border: 1px solid var(--surface-border-strong);
	outline: none;
	transition: border-color 120ms ease, box-shadow 120ms ease;
	text-align: right;
}
.inp:focus {
	border-color: var(--brand);
	box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.22);
}

.add-game__details {
	display: grid;
	gap: 18px;
}
.actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
}

.pill-soft {
	background: rgba(139, 92, 246, 0.14);
	border: 1px solid rgba(139, 92, 246, 0.28);
	color: #e9ddff;
}

@media (max-width: 640px) {
	.hero-actions {
		width: 100%;
		justify-content: stretch;
	}
	.hero-actions .btn,
	.hero-actions .btn-ghost {
		flex: 1;
	}
	.add-game__header {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
