<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";
import { applyTheme, LS_THEME } from "../lib/theme";
import {
	readMiseryAtout,
	readMiseryTete,
	writeMiseryAtout,
	writeMiseryTete,
	readScoreConfig,
} from "../lib/settings";
import { getAllSessions } from "../stores/sessionStore";

// State persisted in localStorage
const miseryAtoutEnabled = ref(false);
const miseryTeteEnabled = ref(false);
const theme = ref<"dark" | "light">("dark");
const exportFormat = ref<"json" | "xlsx">("xlsx");
const exporting = ref(false);
const score = ref(readScoreConfig());
const isLargeScreen = ref<boolean>(window.innerWidth >= 640);
const isPro = ref<boolean>(proEnabled.value);

onMounted(() => {
	try {
		miseryAtoutEnabled.value = readMiseryAtout();
		miseryTeteEnabled.value = readMiseryTete();
		const t =
			(localStorage.getItem(LS_THEME) as "dark" | "light") || "dark";
		theme.value = t;
		applyTheme(t);
	} catch {}
	refreshProFromSupabase().finally(() => (isPro.value = proEnabled.value));
});

window.addEventListener("resize", () => {
	isLargeScreen.value = window.innerWidth >= 640;
});

watch(miseryAtoutEnabled, (v) => {
	writeMiseryAtout(v);
});
watch(miseryTeteEnabled, (v) => {
	writeMiseryTete(v);
});

watch(theme, (t) => {
	try {
		localStorage.setItem(LS_THEME, t);
	} catch {}
	applyTheme(t);
});

async function exportAllData() {
	if (!isPro.value) return;
	try {
		exporting.value = true;
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
			now.getDate()
		)}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(
			now.getSeconds()
		)}`;

		if (exportFormat.value === "json") {
			const bundle = {
				meta: { exportedAt: now.toISOString(), app: "Tarot" },
				settings: {
					theme:
						(localStorage.getItem(LS_THEME) as "dark" | "light") ||
						"dark",
					misery_atout: miseryAtoutEnabled.value,
					misery_tete: miseryTeteEnabled.value,
					score: score.value,
				},
				sessions: getAllSessions(),
			};
			const blob = new Blob([JSON.stringify(bundle, null, 2)], {
				type: "application/json",
			});
			downloadBlob(blob, `tarot-export-${stamp}.json`);
			return;
		}

		// Excel (.xlsx)
		const XLSX = await import("xlsx");
		const sessions = getAllSessions();
		const sessionsRows = sessions.map((s) => ({
			id: s.id,
			remoteId: s.remoteId ?? "",
			createdAt: new Date(s.createdAt).toISOString(),
			participants: s.participants.join(", "),
			games: s.games.length,
		}));
		const gamesRows: any[] = [];
		for (const s of sessions) {
			for (const g of s.games) {
				gamesRows.push({
					sessionId: s.id,
					gameId: g.id,
					timestamp: new Date(g.timestamp).toISOString(),
					scores: JSON.stringify(g.scores),
					note: g.note ?? "",
					taker: g.details?.taker ?? "",
					called: g.details?.called ?? "",
					contract: g.details?.contract ?? "",
					bouts: g.details?.bouts ?? "",
					bouts_detail: (g.details?.bouts_detail || []).join(", "),
					takerPoints: g.details?.takerPoints ?? "",
					petitAuBout: g.details?.petitAuBout ?? "",
					poignee: g.details?.poignee ?? "",
					chelem: g.details?.chelem ?? "",
					miseres_atout: (g.details?.miseres || []).join(", "),
					miseres_tete: (g.details?.miseres_tete || []).join(", "),
				});
			}
		}
		const wb = XLSX.utils.book_new();
		const wsSessions = XLSX.utils.json_to_sheet(sessionsRows);
		const wsGames = XLSX.utils.json_to_sheet(gamesRows);
		XLSX.utils.book_append_sheet(wb, wsSessions, "Sessions");
		XLSX.utils.book_append_sheet(wb, wsGames, "Games");
		const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
		const blob = new Blob([wbout], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		downloadBlob(blob, `tarot-export-${stamp}.xlsx`);
	} finally {
		exporting.value = false;
	}
}

function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Score config now edited on a dedicated page
</script>

<template>
	<div class="container settings" :class="{ locked: !isPro }">
		<section class="hero card elev-2 glow">
			<div class="hero__left">
				<h1>Paramètres</h1>
				<p>
					Personnalisez votre expérience de jeu et l'apparence de
					l'application.
				</p>
			</div>
			<div class="hero__right" v-if="isLargeScreen">
				<div class="preview" :data-theme="theme">
					<div class="preview__chip">Aperçu</div>
					<div class="preview__card"></div>
					<div class="preview__row">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				</div>
			</div>
		</section>

		<section class="grid">
			<div class="card setting">
				<div class="setting__header">
					<div>
						<h3>Misères</h3>
						<p class="muted">Activez/désactivez les variantes</p>
					</div>
					<div class="misery-toggles">
						<div class="toggle-item">
							<span class="lbl">Atout</span>
							<label class="switch">
								<input
									type="checkbox"
									v-model="miseryAtoutEnabled"
								/>
								<span class="slider"></span>
							</label>
						</div>
						<div class="toggle-item">
							<span class="lbl">Tête</span>
							<label class="switch">
								<input
									type="checkbox"
									v-model="miseryTeteEnabled"
								/>
								<span class="slider"></span>
							</label>
						</div>
					</div>
				</div>
				<p class="tip">
					Contrôlez la disponibilité des champs «misère d'atout» et
					«misère de tête» lors de l'ajout d'une partie.
				</p>
			</div>

			<div class="card setting">
				<div class="setting__header">
					<div>
						<h3>Thème</h3>
						<p class="muted">Choisir entre clair et sombre</p>
					</div>
					<div class="segmented">
						<button
							:class="{ active: theme === 'dark' }"
							@click="theme = 'dark'"
						>
							Sombre
						</button>
						<button
							:class="{ active: theme === 'light' }"
							@click="theme = 'light'"
						>
							Clair
						</button>
					</div>
				</div>
				<p class="tip">
					Le thème clair est idéal en plein jour, le sombre pour le
					confort nocturne.
				</p>
			</div>

			<div class="card setting">
				<div class="setting__header">
					<div>
						<h3>Règles de score</h3>
						<p class="muted">Base, multiplicateurs et annonces</p>
					</div>
                    <router-link
                        class="btn btn-primary"
                        :class="{ disabled: !isPro }"
                        :to="isPro ? { name: 'settings-scores' } : '/app/settings'"
                    >
                        Configurer
                    </router-link>
				</div>
				<p class="tip">
					Définissez les points de base, les coefficients des contrats
					et les annonces.
				</p>
			</div>

			<div class="card setting">
				<div class="setting__header">
					<div>
						<h3>Export des données</h3>
						<p class="muted">
							Téléchargez vos sessions et paramètres
						</p>
					</div>
					<div class="export-actions">
						<div class="segmented">
							<button
								:class="{ active: exportFormat === 'json' }"
								@click="isPro && (exportFormat = 'json')"
							>
								JSON
							</button>
							<button
								:class="{ active: exportFormat === 'xlsx' }"
								@click="isPro && (exportFormat = 'xlsx')"
							>
								Excel
							</button>
						</div>
						<button
							class="btn btn-primary"
							@click="exportAllData"
							:disabled="exporting || !isPro"
						>
							{{ exporting ? "Export…" : "Exporter" }}
						</button>
					</div>
				</div>
				<p class="tip">
					Inclut vos sessions locales (participants, parties, détails)
					et préférences (thème, misère).
				</p>
			</div>
		</section>
		<div v-if="!isPro" class="pro-banner">
			<strong>Premium</strong>
			<span class="muted">Accédez à toutes les fonctionnalités</span>
			<router-link class="btn btn-primary" :to="{ name: 'billing' }"
				>Voir l'offre</router-link
			>
		</div>
	</div>
</template>

<style scoped>
.hero {
	display: grid;
	grid-template-columns: 1.2fr 1fr;
	gap: 20px;
	overflow: hidden;
}
.hero__left {
	padding: 12px 6px;
}
.hero__right {
	display: grid;
	place-items: center;
}

@media (max-width: 640px) {
	.hero {
		grid-template-columns: 1fr; /* la colonne de gauche prend toute la largeur */
		text-align: center; /* optionnel : centrer le texte si tu veux */
	}

	.hero__left {
		padding: 12px;
		justify-self: center; /* centre horizontalement dans la grille */
		text-align: center; /* centrer le texte */
	}
}

.preview {
	width: 260px;
	height: 160px;
	border-radius: 16px;
	padding: 14px;
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border);
	box-shadow: var(--shadow-soft);
	position: relative;
	overflow: hidden;
}
.preview__chip {
	position: absolute;
	top: 10px;
	right: 10px;
	font-size: 12px;
	opacity: 0.7;
}
.preview__card {
	height: 70px;
	border-radius: 12px;
	background: var(--bg-elev-2);
	border: 1px solid var(--surface-border);
	box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
}
.preview__row {
	display: flex;
	gap: 8px;
	margin-top: 14px;
}
.dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: var(--accent);
	opacity: 0.8;
}
.preview[data-theme="light"] {
	background: linear-gradient(
		180deg,
		rgba(255, 255, 255, 0.7),
		rgba(242, 245, 255, 0.9)
	);
	border-color: rgba(26, 49, 122, 0.12);
	box-shadow: 0 18px 36px rgba(45, 70, 170, 0.16);
}
.preview[data-theme="light"] .preview__card {
	background: #f4f6ff;
	border-color: rgba(26, 49, 122, 0.16);
	box-shadow: inset 0 1px 2px rgba(26, 49, 122, 0.08);
}
.preview[data-theme="light"] .preview__chip {
	color: #42507b;
}
.preview[data-theme="dark"] {
	background: linear-gradient(
		180deg,
		rgba(14, 20, 42, 0.9),
		rgba(10, 14, 32, 0.95)
	);
	border-color: rgba(35, 56, 120, 0.35);
}

.setting {
	padding: 18px;
}
.setting__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.tip {
	margin-top: 10px;
	color: var(--text-secondary);
}

.export-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

.misery-toggles {
	display: flex;
	gap: 14px;
	align-items: center;
	flex-wrap: wrap;
}
.toggle-item {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}
.toggle-item .lbl {
	color: var(--text-secondary);
	font-size: 0.9rem;
}

/* Empêche les cartes et colonnes de bloquer la largeur minimale */
.grid,
.hero,
.card,
.setting,
.setting__header {
	min-width: 0;
}

/* Forcer les cartes à se comprimer normalement sur petits écrans */
.card.setting {
	width: 100%;
	box-sizing: border-box;
}

/* Autoriser le conteneur principal à descendre plus bas */
.container {
	min-width: 0;
	width: 100%;
	overflow-x: hidden;
}

/* Floutage des cartes Restreintes si non‑Premium (score + export) */
.settings.locked .grid .card.setting:nth-child(3),
.settings.locked .grid .card.setting:nth-child(4) {
	filter: blur(1.5px);
	pointer-events: none;
	user-select: none;
}
.btn.disabled {
	pointer-events: none;
	opacity: 0.6;
}

.pro-banner {
	margin-top: 20px;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid rgba(185, 194, 232, 0.16);
	background: rgba(185, 194, 232, 0.06);
	border-radius: 10px;
}

/* Si tu veux assurer une compatibilité jusque 200px de large */
@media (max-width: 360px) {
	.grid {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
}
</style>
