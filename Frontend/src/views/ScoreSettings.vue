<script setup lang="ts">
import { ref, computed } from "vue";
import {
	readScoreConfig,
	writeScoreConfig,
	defaultScoreConfig,
	type ScoreConfig,
} from "../lib/settings";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";

const score = ref<ScoreConfig>(readScoreConfig());
const isPro = computed(() => proEnabled.value);

const summaryCards = computed(() => {
	const formatPoints = (n: number) => `${n > 0 ? "+" : ""}${n} pts`;
	return [
		{
			icon: "",
			label: "Base contrat",
			value: `${score.value.base} pts`,
			hint: "Points fixes ajoutés avant le différentiel",
		},
		{
			icon: "",
			label: "Petit au bout",
			value: `±${score.value.petit_au_bout} ×`,
			hint: "Multiplié par le multiplicateur du contrat",
		},
		{
			icon: "",
			label: "Multiplicateurs",
			value: `${score.value.multipliers.prise}× → ${score.value.multipliers.garde_contre}×`,
			hint: "De la prise à la garde contre",
		},
		{
			icon: "",
			label: "Chelem annoncé",
			value: `${formatPoints(
				score.value.chelem.annonce_reussi
			)} / ${formatPoints(score.value.chelem.annonce_rate)}`,
			hint: "Réussi / raté",
		},
	];
});

function saveScoreConfig() {
	const s = score.value;
	const toNum = (v: any, d = 0) => {
		const n = Number(v);
		return Number.isFinite(n) ? n : d;
	};
	s.base = toNum(s.base, 25);
	s.multipliers.prise = toNum(s.multipliers.prise, 1);
	s.multipliers.garde = toNum(s.multipliers.garde, 2);
	s.multipliers.garde_sans = toNum(s.multipliers.garde_sans, 4);
	s.multipliers.garde_contre = toNum(s.multipliers.garde_contre, 6);
	s.petit_au_bout = toNum(s.petit_au_bout, 10);
	s.poignee.simple = toNum(s.poignee.simple, 20);
	s.poignee.double = toNum(s.poignee.double, 30);
	s.poignee.triple = toNum(s.poignee.triple, 40);
	s.chelem.non_annonce_reussi = toNum(s.chelem.non_annonce_reussi, 200);
	s.chelem.annonce_reussi = toNum(s.chelem.annonce_reussi, 400);
	s.chelem.annonce_rate = toNum(s.chelem.annonce_rate, -200);
	writeScoreConfig({ ...s });
}

function resetScoreConfig() {
	score.value = defaultScoreConfig();
	writeScoreConfig(score.value);
}
</script>

<template>
	<v-main class="bg-grey-darken-4" style="min-height: 100vh">
		<section class="container score-settings" :class="{ locked: !isPro }">
			<article class="card elev-2 glow score-hero">
				<div class="hero-top">
					<router-link
						class="btn btn-ghost"
						:to="{ name: 'settings' }"
						>← Paramètres</router-link
					>
					<div class="hero-actions">
						<button class="btn btn-ghost" :disabled="!isPro" @click="resetScoreConfig">
							Réinitialiser
						</button>
						<button
							class="btn btn-primary"
							:disabled="!isPro"
							@click="saveScoreConfig"
						>
							Enregistrer
						</button>
					</div>
				</div>
				<div class="hero-body">
					<div class="hero-heading">
						<h1>Règles de score</h1>
						<p class="muted">
							Personnalisez les points clés du Tarot : bases,
							multiplicateurs, annonces et bonus.
						</p>
					</div>
					<div class="hero-summary">
						<div
							class="summary-card"
							v-for="card in summaryCards"
							:key="card.label"
						>
							<div class="summary-icon" v-if="false"></div>
							<div class="summary-meta">
								<span class="summary-label">{{
									card.label
								}}</span>
								<span class="summary-value">{{
									card.value
								}}</span>
								<small>{{ card.hint }}</small>
							</div>
						</div>
					</div>
				</div>
			</article>

			<article class="card elev-2">
				<div class="config-card">
					<section class="config-section section-contract">
						<header class="section-head">
							<div>
								<h3>Contrat &amp; petit au bout</h3>
								<p class="muted">
									Ajustez la base fixe et l'impact du dernier
									pli.
								</p>
							</div>
						</header>
						<div class="fields">
							<label class="field">
								<span>Base contrat</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.base"
									min="0"
								/>
							</label>
							<label class="field">
								<span>Petit au bout</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.petit_au_bout"
									min="0"
								/>
							</label>
						</div>
					</section>

					<section class="config-section section-multipliers">
						<header class="section-head">
							<div>
								<h3>Multiplicateurs de contrat</h3>
								<p class="muted">
									Définissez la montée en puissance des
									contrats.
								</p>
							</div>
						</header>
						<div class="fields">
							<label class="field">
								<span>Prise</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.multipliers.prise"
									min="1"
								/>
							</label>
							<label class="field">
								<span>Garde</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.multipliers.garde"
									min="1"
								/>
							</label>
							<label class="field">
								<span>Garde sans</span>
								<input
									class="inp"
									type="number"
									v-model.number="
										score.multipliers.garde_sans
									"
									min="1"
								/>
							</label>
							<label class="field">
								<span>Garde contre</span>
								<input
									class="inp"
									type="number"
									v-model.number="
										score.multipliers.garde_contre
									"
									min="1"
								/>
							</label>
						</div>
					</section>

					<section class="config-section section-poignees">
						<header class="section-head">
							<div>
								<h3>Poignées</h3>
								<p class="muted">
									Accordez des bonus progressifs selon la
									difficulté.
								</p>
							</div>
						</header>
						<div class="fields">
							<label class="field">
								<span>Simple</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.poignee.simple"
									min="0"
								/>
							</label>
							<label class="field">
								<span>Double</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.poignee.double"
									min="0"
								/>
							</label>
							<label class="field">
								<span>Triple</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.poignee.triple"
									min="0"
								/>
							</label>
						</div>
					</section>

					<section class="config-section section-chelems">
						<header class="section-head">
							<div>
								<h3>Chelems</h3>
								<p class="muted">
									Récompensez (ou sanctionnez) les exploits.
								</p>
							</div>
						</header>
						<div class="fields">
							<label class="field">
								<span>Non annoncé (réussi)</span>
								<input
									class="inp"
									type="number"
									v-model.number="
										score.chelem.non_annonce_reussi
									"
								/>
							</label>
							<label class="field">
								<span>Annoncé (réussi)</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.chelem.annonce_reussi"
								/>
							</label>
							<label class="field">
								<span>Annoncé (raté)</span>
								<input
									class="inp"
									type="number"
									v-model.number="score.chelem.annonce_rate"
								/>
							</label>
						</div>
					</section>
				</div>

				<p class="tip">
					Rappel : le bonus du petit au bout est multiplié par le
					contrat sélectionné.
				</p>
			</article>
		</section>
	</v-main>
</template>
<style scoped>
.score-settings {
	display: flex;
	flex-direction: column;
	gap: 18px;
	padding: 32px 24px 80px;
}
.score-hero {
	position: relative;
	overflow: hidden;
}
.score-hero::before {
	content: "";
	position: absolute;
	inset: -2px;
	border-radius: inherit;
	background: radial-gradient(
			900px 500px at -10% -10%,
			rgba(139, 92, 246, 0.18),
			transparent 60%
		),
		radial-gradient(
			820px 460px at 110% -10%,
			rgba(34, 211, 238, 0.14),
			transparent 55%
		);
	filter: blur(26px);
	opacity: 0.42;
	pointer-events: none;
}
.hero-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}
.hero-actions {
	display: flex;
	gap: 8px;
}
.hero-body {
	display: flex;
	flex-direction: column;
	gap: 18px;
	margin-top: 12px;
}
.hero-heading h1 {
	margin: 0;
	font-size: clamp(1.8rem, 2.4vw + 1rem, 3rem);
}
.hero-heading p {
	max-width: 520px;
}
.hero-summary {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
	gap: 12px;
}
.summary-card {
	background: rgba(15, 21, 45, 0.72);
	border: 1px solid rgba(185, 194, 232, 0.14);
	border-radius: 14px;
	padding: 14px;
	display: flex;
	gap: 12px;
	align-items: flex-start;
	position: relative;
	overflow: hidden;
}
.summary-card::after {
	content: "";
	position: absolute;
	inset: 0;
	background: radial-gradient(
		140% 100% at 100% 0,
		rgba(255, 255, 255, 0.08),
		transparent 60%
	);
	opacity: 0.5;
	pointer-events: none;
}
.summary-icon {
	font-size: 1.5rem;
}
.summary-meta {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.summary-label {
	font-size: 0.85rem;
	color: var(--text-secondary);
}
.summary-value {
	font-weight: 800;
	font-size: 1.2rem;
}
.summary-meta small {
	color: var(--muted);
}

.config-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.config-card > .config-section {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)), var(--bg-elev-1);
  border: 1px solid rgba(185, 194, 232, 0.12);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-soft);
  display: grid;
  gap: 12px;
  min-width: 0;
  width: 100%;
}

.config-card > .tip {
  grid-column: 1 / -1;
}

.section-head {
	display: grid;
	grid-template-columns: auto 1fr;
	align-items: start;
	gap: 12px;
}
.section-icon {
	font-size: 1.4rem;
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: rgba(139, 92, 246, 0.18);
	border: 1px solid rgba(185, 194, 232, 0.18);
}

/* === ICI : le vrai fix responsive du corps === */
.fields {
	/* au lieu d'un flex colonne fixe, on fait une grille qui se replie */
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 12px;
	align-items: start;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	width: 100%;
	/* on enlève le max-width qui cassait la responsivité */
	/* max-width: 240px; */
	min-width: 0; /* évite les débordements dans la grille */
}

.field span {
	font-size: 0.9rem;
	color: var(--text-secondary);
}
.inp {
	width: 100%;
	padding: 6px 10px;
	border-radius: 8px;
	background: var(--bg-elev-1);
	color: var(--text-primary);
	border: 1px solid rgba(185, 194, 232, 0.18);
	outline: none;
	transition: border-color 120ms ease, box-shadow 120ms ease;
	text-align: right;
}
.inp:focus {
	border-color: var(--brand);
	box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.22);
}
.tip {
	margin-top: 6px;
	color: var(--muted);
}

/* Lock state: désactive et floute le contenu si non‑Premium */
.locked .hero-actions .btn,
.locked .hero-actions .btn-ghost,
.locked .config-card,
.locked .tip {
  filter: blur(3px);
  pointer-events: none;
  user-select: none;
}

/* mobile */
@media (max-width: 640px) {
	.hero-actions {
		width: 100%;
		justify-content: stretch;
	}
	.hero-actions .btn,
	.hero-actions .btn-ghost {
		flex: 1;
	}

	/* sur petit écran on force les champs en 1 colonne */
	.fields {
		grid-template-columns: 1fr;
	}
	.config-section .fields {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 320px) {
	.score-settings {
		padding: 20px 12px 64px;
	}
	.section-icon {
		width: 36px;
		height: 36px;
	}
	.summary-card {
		padding: 10px;
	}
	.inp {
		padding: 6px 8px;
		font-size: 0.9rem;
	}
}

@media (max-width: 240px) {
	.hero-top {
		flex-direction: column;
		align-items: stretch;
	}
	.hero-actions {
		width: 100%;
	}
	.section-head {
		gap: 8px;
	}
}
</style>
