<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Chart, registerables } from "chart.js";
import { Bar, Doughnut, Line } from "vue-chartjs";
import {
	getSessionById,
	computeTotals,
	type Session,
} from "../stores/sessionStore";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";

Chart.register(...registerables);

const route = useRoute();
const router = useRouter();
const sessionId = route.params.id as string;
const session = computed(() => getSessionById(sessionId) as Session | null);
const isPro = computed(() => proEnabled.value);

const participants = computed(() => session.value?.participants ?? []);
const gamesSorted = computed(() =>
	session.value
		? [...session.value.games].sort((a, b) => a.timestamp - b.timestamp)
		: []
);
const totals = computed(() =>
	session.value ? computeTotals(session.value) : {}
);

const summaryStats = computed(() => {
	const games = gamesSorted.value.length;
	const totalsEntries = participants.value.map((name) => ({
		name,
		total: Number((totals.value as Record<string, number>)[name] ?? 0),
	}));
	const best = totalsEntries.reduce(
		(acc, cur) => (cur.total > (acc?.total ?? -Infinity) ? cur : acc),
		null as null | { name: string; total: number }
	);
	const worst = totalsEntries.reduce(
		(acc, cur) => (cur.total < (acc?.total ?? Infinity) ? cur : acc),
		null as null | { name: string; total: number }
	);
	const lastIdx = gamesSorted.value.length - 1;
	const lastGame = lastIdx >= 0 ? gamesSorted.value[lastIdx] : undefined;
	const spread = best && worst ? best.total - worst.total : 0;
	return {
		games,
		best,
		worst,
		lastDate: lastGame
			? new Date(lastGame.timestamp).toLocaleString()
			: "—",
		spread,
	};
});

const totalSum = computed(() =>
	Object.values(totals.value as Record<string, number>).reduce(
		(acc, val) => acc + Number(val ?? 0),
		0
	)
);

const takerSuccessRate = computed(() => {
	let win = 0;
	let total = 0;
	for (const g of gamesSorted.value) {
		const taker = g.details?.taker;
		if (!taker) continue;
		total += 1;
		if (Number(g.scores[taker] ?? 0) > 0) win += 1;
	}
	return total ? Math.round((win / total) * 1000) / 10 : 0;
});

const gaugeStyle = (rate: number, color = "#7c3aed") => {
	const value = Math.max(0, Math.min(100, Number(rate) || 0));
	return {
		"--gauge": String(value),
		"--gauge-color": color,
	};
};

const barColors = ["#7c3aed", "#22c55e", "#f97316", "#14b8a6", "#fb7185"];

const scoreBar = computed(() => {
	const labels = participants.value;
	const data = labels.map((name) => Number((totals.value as any)[name] ?? 0));
	return {
		labels,
		datasets: [
			{
				label: "Total",
				data,
				backgroundColor: labels.map(
					(_, i) => barColors[i % barColors.length] + "99"
				),
				borderColor: labels.map(
					(_, i) => barColors[i % barColors.length]
				),
				borderWidth: 2,
				borderRadius: 10,
			},
		],
	};
});

const contractCounts = computed(() => {
	const counts: Record<string, number> = {
		prise: 0,
		garde: 0,
		garde_sans: 0,
		garde_contre: 0,
	};
	for (const g of gamesSorted.value) {
		const c = g.details?.contract as keyof typeof counts | undefined;
		if (c && counts[c] != null) counts[c] += 1;
	}
	return counts;
});

const contractDonut = computed(() => {
	const labels = ["Prise", "Garde", "Sans", "Contre"];
	const keys: (keyof typeof contractCounts.value)[] = [
		"prise",
		"garde",
		"garde_sans",
		"garde_contre",
	];
	const colors = ["#60a5fa", "#f59e0b", "#34d399", "#f87171"];
	return {
		labels,
		datasets: [
			{
				data: keys.map((k) => contractCounts.value[k] || 0),
				backgroundColor: colors,
				borderWidth: 0,
			},
		],
	};
});

// Colonnes pour la heatmap des contrats
const contractCols = [
	{ key: "prise", label: "Prise" },
	{ key: "garde", label: "Garde" },
	{ key: "garde_sans", label: "Sans" },
	{ key: "garde_contre", label: "Contre" },
];

// Données pour heatmaps
const boutsHeatmap = computed(() => {
	const byP: Record<
		string,
		Record<0 | 1 | 2 | 3, { win: number; total: number }>
	> = {};
	for (const p of participants.value)
		byP[p] = {
			0: { win: 0, total: 0 },
			1: { win: 0, total: 0 },
			2: { win: 0, total: 0 },
			3: { win: 0, total: 0 },
		} as any;
	for (const g of gamesSorted.value) {
		const taker = g.details?.taker;
		const b = Number(g.details?.bouts) as 0 | 1 | 2 | 3;
		if (!taker || isNaN(b) || byP[taker]?.[b] == null) continue;
		const won = Number(g.scores[taker] ?? 0) > 0;
		byP[taker][b].total += 1;
		if (won) byP[taker][b].win += 1;
	}
	return participants.value.map((p) => ({
		key: p,
		label: p,
    cells: [0, 1, 2, 3].map((b) => {
            const s = byP[p]?.[b as 0 | 1 | 2 | 3] ?? { win: 0, total: 0 };
            const pct = s.total
                ? Math.round((s.win / s.total) * 1000) / 10
                : null;
            return { b, pct, total: s.total };
        }),
    }));
});

const contractsHeatmap = computed(() => {
	type CK = "prise" | "garde" | "garde_sans" | "garde_contre";
	const keys: CK[] = ["prise", "garde", "garde_sans", "garde_contre"];
    const counts: Record<string, Record<CK, number>> = {};
    const totals: Record<string, number> = {};
	for (const p of participants.value) {
		counts[p] = { prise: 0, garde: 0, garde_sans: 0, garde_contre: 0 };
		totals[p] = 0;
	}
	for (const g of gamesSorted.value) {
		const t = g.details?.taker;
		const c = g.details?.contract as CK | undefined;
		if (!t || !counts[t] || !c) continue;
        counts[t][c] = (counts[t][c] ?? 0) + 1;
        totals[t] = (totals[t] ?? 0) + 1;
	}
	return participants.value.map((p) => ({
		key: p,
		label: p,
		cells: keys.map((k, idx) => {
			const total = totals[p] || 0;
        const cnt = (counts[p] ? counts[p][k] : 0) || 0;
        const pct = total ? Math.round((cnt / total) * 1000) / 10 : null;
        return { b: idx, pct, total: cnt };
        }),
    }));
});

// Taux de réussite de l'attaque selon les bouts détenus (Petit / 21 / Excuse)
const takerWinRateByBout = computed(() => {
	type Key = "petit" | "21" | "excuse";
	const keys: Key[] = ["petit", "21", "excuse"];
	const stats: Record<Key, { win: number; total: number }> = {
		petit: { win: 0, total: 0 },
		"21": { win: 0, total: 0 },
		excuse: { win: 0, total: 0 },
	};
	for (const g of gamesSorted.value) {
		const taker = g.details?.taker;
		if (!taker) continue;
		const arr = (g.details?.bouts_detail as Key[] | undefined) || [];
		const won = Number(g.scores[taker] ?? 0) > 0;
		for (const k of keys) {
			if (arr.includes(k)) {
				stats[k].total += 1;
				if (won) stats[k].win += 1;
			}
		}
	}
    return keys.map((k) => ({
        key: k,
        label: k === "21" ? "21" : (k?.[0] ?? "").toUpperCase() + (k?.slice(1) ?? ""),
        win: stats[k].win,
        total: stats[k].total,
        rate: stats[k].total
            ? Math.round((stats[k].win / stats[k].total) * 1000) / 10
            : 0,
    }));
});

// Tableau de répartition des contrats avec pourcentage
const contractTable = computed(() => {
	const entries = Object.entries(contractCounts.value);
	const total = entries.reduce((s, [, v]) => s + (v || 0), 0) || 0;
	const labels: Record<string, string> = {
		prise: "Prise",
		garde: "Garde",
		garde_sans: "Garde sans",
		garde_contre: "Garde contre",
	};
	return entries
		.map(([k, v]) => ({
			key: k,
			label: labels[k] ?? k,
			count: v,
			pct: total ? Math.round((v / total) * 1000) / 10 : 0,
		}))
		.sort((a, b) => b.count - a.count);
});

const outcomeDonut = computed(() => {
	let wins = 0;
	let losses = 0;
	for (const g of gamesSorted.value) {
		const taker = g.details?.taker;
		if (!taker) continue;
		const v = Number(g.scores[taker] ?? 0);
		if (v > 0) wins += 1;
		else if (v < 0) losses += 1;
	}
	return {
		labels: ["Attaque gagnée", "Attaque perdue"],
		datasets: [
			{
				data: [wins, losses],
				backgroundColor: ["#22c55e", "#ef4444"],
				borderWidth: 0,
			},
		],
	};
});

const boutsBar = computed(() => {
	const buckets: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
	for (const g of gamesSorted.value) {
		const b = g.details?.bouts as 0 | 1 | 2 | 3 | undefined;
		if (b != null) buckets[b] = (buckets[b] ?? 0) + 1;
	}
	return {
		labels: ["0", "1", "2", "3"],
		datasets: [
			{
				label: "Occurrences",
				data: [0, 1, 2, 3].map((b) => buckets[b] ?? 0),
				backgroundColor: "#8b5cf6",
				borderRadius: 8,
			},
		],
	};
});

const cumulativeSeries = computed(() => {
	const labels = gamesSorted.value.map((_, idx) => `Partie ${idx + 1}`);
	const datasets = participants.value.map((name, idx) => {
		let sum = 0;
		const data: number[] = [];
		for (const g of gamesSorted.value) {
			sum += Number(g.scores[name] ?? 0);
			data.push(sum);
		}
		return {
			label: name,
			data,
			borderColor: barColors[idx % barColors.length],
			backgroundColor: barColors[idx % barColors.length] + "33",
			fill: false,
			tension: 0.25,
		};
	});
	return { labels, datasets };
});
const lastGameDate = computed(() => {
	const n = gamesSorted.value.length;
	const last = n > 0 ? gamesSorted.value[n - 1] : undefined;
	return last ? new Date(last.timestamp).toLocaleDateString() : "—";
});

// Distribution des cartes de bouts détenues par le preneur (Petit / 21 / Excuse)
const boutsCardsDonut = computed(() => {
	let petit = 0,
		v21 = 0,
		excuse = 0;
	for (const g of gamesSorted.value) {
		const arr =
			(g.details?.bouts_detail as
				| Array<"petit" | "21" | "excuse">
				| undefined) || [];
		for (const k of arr) {
			if (k === "petit") petit += 1;
			else if (k === "21") v21 += 1;
			else if (k === "excuse") excuse += 1;
		}
	}
	return {
		labels: ["Petit", "21", "Excuse"],
		datasets: [
			{
				data: [petit, v21, excuse],
				backgroundColor: ["#f59e0b", "#3b82f6", "#10b981"],
				borderWidth: 0,
			},
		],
	};
});

const myChronoScores = computed(() =>
	gamesSorted.value.map((g) => ({
		t: g.timestamp,
		v: participants.value.reduce(
			(acc, name) => acc + Number(g.scores[name] ?? 0),
			0
		),
	}))
);

function avgWindow(values: Array<{ v: number }>, start: number, end: number) {
	const n = end - start;
	if (n <= 0) return 0;
	let s = 0;
	for (let i = start; i < end && i < values.length; i++)
		s += Number(values[i]?.v ?? 0);
	return Math.round((s / n) * 10) / 10;
}

const rolling = computed(() => {
	const xs = myChronoScores.value;
	const n = xs.length;
	const last = n >= 10 ? avgWindow(xs, n - 10, n) : avgWindow(xs, 0, n);
	const prev =
		n >= 20
			? avgWindow(xs, n - 20, n - 10)
			: n >= 10
			? avgWindow(xs, 0, n - 10)
			: 0;
	const trend = last > prev ? "up" : last < prev ? "down" : "flat";
	return { lastWindow: last, prevWindow: prev, trend };
});

function goBack() {
	router.push({ name: "session", params: { id: sessionId } });
}
</script>

<template>
	<v-main class="bg-grey-darken-4" style="min-height: 100vh">
		<section class="container session-stats">
			<div class="header-row">
				<button class="btn btn-ghost" @click="goBack">
					← Retour à la session
				</button>
			</div>

			<v-alert v-if="!session" type="error" variant="tonal">
				Session introuvable.
			</v-alert>

			<template v-else>
				<article class="card elev-2 hero-card">
					<header class="hero-card__top">
						<div>
							<h3>{{ session.participants.join(" · ") }}</h3>
							<p class="muted">
								{{ summaryStats.games }} parties
							</p>
						</div>
					</header>
					<div class="hero-card__main">
						<div class="hero-total">
							<p class="hero-total__label">Écart max</p>
							<p class="hero-total__value is-pos">
								{{ summaryStats.spread }} pts
							</p>
							<div
								class="hero-total__trend"
								:class="'trend-' + rolling.trend"
							>
								<span
									>Moy (10 dernières) :
									{{ rolling.lastWindow }} pts</span
								>
							</div>
						</div>
						<div class="hero-gauges">
							<div class="gauge-card">
								<div class="gauge-card__title">Attaque</div>
								<div class="gauge-card__body">
									<div
										class="kpi-gauge"
										:style="
											gaugeStyle(
												takerSuccessRate,
												'#8b5cf6'
											)
										"
									>
										<div class="kpi-gauge__inner">
											<span>{{ takerSuccessRate }}%</span>
											<small>Réussites</small>
										</div>
									</div>
									<div class="gauge-card__stats">
										<span
											>{{ summaryStats.games }} parties
											jouées</span
										>
										<span
											>Réussites preneur :
											{{
												outcomeDonut.datasets?.[0]
													?.data?.[0] ?? 0
											}}</span
										>
										<span
											>Échecs preneur :
											{{
												outcomeDonut.datasets?.[0]
													?.data?.[1] ?? 0
											}}</span
										>
									</div>
								</div>
							</div>
							<div class="gauge-card">
								<div class="gauge-card__title">
									Participants
								</div>
								<div class="gauge-card__body">
									<div
										class="kpi-gauge"
										:style="
											gaugeStyle(
												(participants.length / 5) * 100,
												'#0ea5e9'
											)
										"
									>
										<div class="kpi-gauge__inner">
											<span>{{
												participants.length
											}}</span>
											<small>joueurs</small>
										</div>
									</div>
									<div class="gauge-card__stats">
										<span
											>Best:
											{{
												summaryStats.best?.name ?? "-"
											}}</span
										>
										<span
											>Pire:
											{{
												summaryStats.worst?.name ?? "-"
											}}</span
										>
										<span
											>Dernière : {{ lastGameDate }}</span
										>
									</div>
								</div>
							</div>
						</div>
					</div>
				</article>

				<div class="chart-grid">
					<article class="card elev-2">
						<header class="stat__header">
							<h3>Scores par joueur</h3>
						</header>
						<div class="chart">
							<Bar
								:data="scoreBar"
								:options="{
									responsive: true,
									maintainAspectRatio: false,
									plugins: { legend: { display: false } },
									scales: {
										y: {
											grid: {
												color: 'rgba(185,194,232,0.12)',
											},
										},
										x: { grid: { display: false } },
									},
								}"
							/>
						</div>
					</article>

					<article class="card elev-2">
						<header class="stat__header">
							<h3>Tendance</h3>
						</header>
						<div class="chart">
							<Line
								:data="cumulativeSeries"
								:options="{
									responsive: true,
									maintainAspectRatio: false,
									plugins: { legend: { position: 'bottom' } },
									scales: {
										y: {
											grid: {
												color: 'rgba(185,194,232,0.12)',
											},
										},
										x: {
											grid: {
												color: 'rgba(185,194,232,0.12)',
											},
										},
									},
								}"
							/>
						</div>
					</article>
				</div>
				<div v-if="!isPro" class="pro-banner">
					<strong>Premium</strong>
					<span class="muted"
						>Débloquez toutes les statistiques détaillées</span
					>
					<router-link
						class="btn btn-primary"
						:to="{ name: 'billing' }"
						>Voir l'offre</router-link
					>
				</div>
				<article class="card elev-2">
					<header class="stat__header">
						<h3>Bouts détenus par le preneur</h3>
						<p class="muted">
							Taux de réussite par participant et nombre de bouts
						</p>
					</header>

					<div class="heatmap" :class="{ locked: !isPro }">
						<div class="heatmap__row heatmap__row--head">
							<div class="heatmap__cell"></div>
							<div
								class="heatmap__cell"
								v-for="b in [0, 1, 2, 3]"
								:key="'h' + b"
							>
								{{ b }} bout{{ b > 1 ? "s" : "" }}
							</div>
						</div>
						<div
							class="heatmap__row"
							v-for="row in boutsHeatmap"
							:key="row.key"
						>
							<div class="heatmap__cell heatmap__cell--label">
								{{ row.label }}
							</div>
							<div
								class="heatmap__cell heatmap__cell--value"
								v-for="cell in row.cells"
								:key="row.key + '-' + cell.b"
								:style="{
									'--heat':
										cell.pct == null ? 0 : cell.pct / 100,
								}"
								:title="
									cell.pct == null
										? '—'
										: cell.pct + '% (n=' + cell.total + ')'
								"
							>
								<span v-if="cell.pct == null" class="muted"
									>—</span
								>
								<span v-else>{{ cell.pct }}%</span>
							</div>
						</div>
					</div>
				</article>

				<article class="card elev-2">
					<header class="stat__header">
						<h3>Répartition des contrats</h3>
						<p class="muted">Proportions par participant et type</p>
					</header>
					<div class="heatmap" :class="{ locked: !isPro }">
						<div class="heatmap__row heatmap__row--head">
							<div class="heatmap__cell"></div>
							<div
								class="heatmap__cell"
								v-for="c in contractCols"
								:key="'hc' + c.key"
							>
								{{ c.label }}
							</div>
						</div>
						<div
							class="heatmap__row"
							v-for="row in contractsHeatmap"
							:key="row.key"
						>
							<div class="heatmap__cell heatmap__cell--label">
								{{ row.label }}
							</div>
							<div
								class="heatmap__cell heatmap__cell--value"
								v-for="cell in row.cells"
								:key="row.key + '-' + cell.b"
								:style="{
									'--heat':
										cell.pct == null ? 0 : cell.pct / 100,
								}"
								:title="
									cell.pct == null
										? '—'
										: cell.pct + '% (n=' + cell.total + ')'
								"
							>
								<span v-if="cell.pct == null" class="muted"
									>—</span
								>
								<span v-else>{{ cell.pct }}%</span>
							</div>
						</div>
					</div>
				</article>
			</template>
		</section>
	</v-main>
</template>

<style scoped>
.session-stats {
	max-width: 1200px;
	margin: 0 auto;
	padding: 32px 24px 80px;
	display: flex;
	flex-direction: column;
	gap: 18px;
}
.header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 12px;
}
.hero-card {
	position: relative;
	overflow: hidden;
}
.hero-card::before {
	content: "";
	position: absolute;
	inset: -2px;
	border-radius: inherit;
	background: radial-gradient(
			800px 420px at -10% -10%,
			rgba(139, 92, 246, 0.18),
			transparent 60%
		),
		radial-gradient(
			700px 380px at 110% -10%,
			rgba(34, 211, 238, 0.14),
			transparent 55%
		);
	filter: blur(18px);
	opacity: 0.35;
	pointer-events: none;
}
.hero-card__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.hero-card__badges {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}
.hero-pill {
	background: rgba(185, 194, 232, 0.1);
	border: 1px solid rgba(185, 194, 232, 0.2);
}

.hero-card__main {
	margin-top: 10px;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}
@media (max-width: 860px) {
	.hero-card__main {
		grid-template-columns: 1fr;
	}
}

.hero-total {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.1);
	border-radius: var(--radius-md);
	padding: 16px;
}
.hero-total__label {
	color: var(--text-secondary);
	font-size: 0.9rem;
}
.hero-total__value {
	font-size: clamp(1.8rem, 2.6vw + 1rem, 2.6rem);
	font-weight: 900;
	letter-spacing: 0.4px;
	margin: 2px 0 6px;
	background: linear-gradient(180deg, #e6ebff, #9fb0ff);
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
.hero-total__value.is-pos {
	background: linear-gradient(180deg, #86efac, #22c55e);
	-webkit-background-clip: text;
	background-clip: text;
}
.hero-total__value.is-neg {
	background: linear-gradient(180deg, #fca5a5, #ef4444);
	-webkit-background-clip: text;
	background-clip: text;
}
.hero-total__trend {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	background: rgba(185, 194, 232, 0.08);
	border: 1px solid rgba(185, 194, 232, 0.16);
	padding: 6px 10px;
	border-radius: 999px;
	font-size: 0.875rem;
}
.hero-total__trend.trend-up {
	border-color: rgba(34, 197, 94, 0.35);
	box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1) inset;
}
.hero-total__trend.trend-down {
	border-color: rgba(239, 68, 68, 0.35);
	box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) inset;
}
.hero-trend-icon {
	opacity: 0.9;
}

.hero-gauges {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}
@media (max-width: 635px) {
	.hero-gauges {
		grid-template-columns: 1fr;
	}
}
.gauge-card {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.1);
	border-radius: var(--radius-md);
	padding: 14px;
	display: grid;
	gap: 8px;
}
.gauge-card__title {
	color: var(--text-secondary);
	font-weight: 700;
	font-size: 0.95rem;
}
.gauge-card__body {
	display: grid;
	grid-template-columns: auto 1fr;
	align-items: center;
	gap: 12px;
}
.gauge-card__stats {
	display: grid;
	gap: 4px;
	color: var(--muted);
	font-size: 0.9rem;
}

.kpi-gauge {
	--gauge: 0;
	--gauge-color: #8b5cf6;
	width: 90px;
	height: 90px;
	border-radius: 50%;
	display: block;
	background: conic-gradient(
		var(--gauge-color) calc(var(--gauge) * 1%),
		rgba(185, 194, 232, 0.14) 0
	);
	position: relative;
}
.kpi-gauge::after {
	content: "";
	position: absolute;
	inset: 8px;
	border-radius: 50%;
	background: var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.16);
	box-shadow: inset 0 8px 24px rgba(0, 0, 0, 0.18);
}
.kpi-gauge__inner {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	display: grid;
	place-items: center;
	z-index: 1;
	text-align: center;
}
.kpi-gauge__inner span {
	font-weight: 900;
	font-size: 1.2rem;
	line-height: 1;
}
.kpi-gauge__inner small {
	color: var(--text-secondary);
	margin-top: 2px;
	line-height: 1;
}

.hero-card__charts {
	margin-top: 14px;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12px;
}
@media (max-width: 980px) {
	.hero-card__charts {
		grid-template-columns: 1fr;
	}
}
.mini-chart-box {
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.02),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.1);
	border-radius: var(--radius-md);
	padding: 10px;
	display: grid;
	gap: 8px;
}
.mini-chart-box__title {
	color: var(--text-secondary);
	font-weight: 700;
	font-size: 0.95rem;
}
.mini-chart-box__body {
	height: 200px;
}

.hero-card__badges .pill {
	font-size: 0.85rem;
}
.chart-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
	gap: 16px;
}
.chart {
	height: 280px;
}
@media (max-width: 700px) {
	.chart {
		height: 220px;
	}
}
.stat__header {
	margin: 10px 0 6px;
}
.stat__header h3 {
	color: var(--text-secondary);
}

.pro-banner {
	margin: 6px 0 8px;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid rgba(185, 194, 232, 0.16);
	background: rgba(185, 194, 232, 0.06);
	border-radius: 10px;
}

.table-wrap {
	overflow: auto;
	border-radius: 12px;
	background: var(--bg-elev-1);
}

/* Floutage des tableaux premium-only (bouts et répartitions) */
.heatmap.locked {
	filter: blur(8px);
	pointer-events: none;
	user-select: none;
}
.stat-table {
	width: 100%;
	border-collapse: collapse;
}
.stat-table th,
.stat-table td {
	padding: 10px 12px;
	text-align: left;
}
.stat-table th {
	font-size: 0.85rem;
	color: var(--text-secondary);
	font-weight: 600;
}
.stat-table .text-right {
	text-align: right;
}
.stat-table tr:last-child td {
	border-bottom: none;
}
</style>
