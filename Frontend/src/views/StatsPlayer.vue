<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Chart, registerables } from "chart.js";
import { Line, Doughnut } from "vue-chartjs";
Chart.register(...registerables);

import { getAllSessions } from "../stores/sessionStore";
import { proEnabled } from "../stores/billingStore";

import Camembert from "../components/Camembert.vue";
import Graphique from "../components/Graphique.vue";

const route = useRoute();
const player = computed(() => (route.params.name as string) || "");
const isPro = computed(() => proEnabled.value);

type Role = "taker" | "called" | "defense";
type NormalizedPlay = {
	sessionId: string;
	gameId: string;
	timestamp: number;
	role: Role;
	contract: string | null;
	bouts: number | null;
	boutsDetail: string[];
	petitAuBout: "none" | "preneur" | "defense";
	poignee: string | null;
	points: number;
	participants: string[];
	partner: string | null;
	taker: string | null;
	called: string | null;
};

const sessionsRaw = computed(() =>
	getAllSessions().filter((s) => s.participants.includes(player.value))
);

const plays = computed<NormalizedPlay[]>(() => {
	const list: NormalizedPlay[] = [];
	for (const s of sessionsRaw.value) {
		for (const g of s.games) {
			const points = Number(g.scores[player.value] ?? 0);
			const d = g.details;

			let role: Role = "defense";
			let contract: string | null = null;
			let bouts: number | null = null;
			let boutsDetail: string[] = [];
			let petitAuBout: "none" | "preneur" | "defense" = "none";
			let poignee: string | null = null;
			let taker: string | null = null;
			let called: string | null = null;
			let partner: string | null = null;

			if (d) {
				taker = d.taker || null;
				called = d.called ?? null;
				if (d.taker === player.value) role = "taker";
				else if (d.called === player.value) role = "called";
				else role = "defense";

				contract = d.contract ?? null;
				bouts = d.bouts ?? null;
				boutsDetail = Array.isArray(d.bouts_detail)
					? d.bouts_detail
					: [];
				petitAuBout = d.petitAuBout ?? "none";
				poignee = d.poignee ?? null;

				if (role === "taker" && called) partner = called;
				if (role === "called" && taker) partner = taker;
			}

			list.push({
				sessionId: s.id,
				gameId: g.id,
				timestamp: g.timestamp,
				role,
				contract,
				bouts,
				boutsDetail,
				petitAuBout,
				poignee,
				points,
				participants: s.participants,
				partner,
				taker,
				called,
			});
		}
	}
	return list.sort((a, b) => a.timestamp - b.timestamp);
});

const totalGames = computed(() => plays.value.length);
const totalPoints = computed(() =>
	plays.value.reduce((a, p) => a + (p.points || 0), 0)
);
const avgPoints = computed(() =>
	totalGames.value
		? Math.round((totalPoints.value / totalGames.value) * 10) / 10
		: 0
);
const roleCounts = computed(() => {
	const c = { taker: 0, called: 0, defense: 0 } as Record<Role, number> & {
		defense: number;
	};
	for (const p of plays.value) c[p.role]++;
	return c;
});

const kpiWinrateDoughnut = computed(() => {
	const wins = plays.value.filter((p) => p.points > 0).length;
	const total = totalGames.value;
	return (wins / total) * 100;
});
const kpiCalledDoughnut = computed(() => {
	const calledCount = plays.value.filter((p) => p.role === "called").length;
	return (calledCount / totalGames.value) * 100;
});
const kpiRatioDoughnut = computed(() => {
	const att = plays.value.filter((p) => p.role === "taker").length;
	const def = plays.value.filter((p) => p.role === "defense").length;
	if (def === 0) return att === 0 ? 0 : 100;
	return (att / def) * 100;
});

const playsAsTaker = computed(() =>
	plays.value.filter((p) => p.role === "taker")
);
const takerWinrate = computed(() => {
	const t = playsAsTaker.value.length;
	if (!t) return 0;
	const w = playsAsTaker.value.filter((p) => p.points > 0).length;
	return Math.round((w / t) * 1000) / 10;
});
const takerAvg = computed(() => {
	const arr = playsAsTaker.value;
	if (!arr.length) return 0;
	return (
		Math.round((arr.reduce((a, p) => a + p.points, 0) / arr.length) * 10) /
		10
	);
});
const takerContractStats = computed(() => {
	const map: Record<string, { w: number; t: number; sum: number }> = {
		prise: { w: 0, t: 0, sum: 0 },
		garde: { w: 0, t: 0, sum: 0 },
		garde_sans: { w: 0, t: 0, sum: 0 },
		garde_contre: { w: 0, t: 0, sum: 0 },
	};
	for (const p of playsAsTaker.value) {
		const c = p.contract ?? "";
		if (!map[c]) continue;
		const m = map[c];
		m.t++;
		m.sum += p.points;
		if (p.points > 0) m.w++;
	}
	return map;
});
const takerBoutsStats = computed(() => {
	const map: Record<number, { w: number; t: number; sum: number }> = {
		0: { w: 0, t: 0, sum: 0 },
		1: { w: 0, t: 0, sum: 0 },
		2: { w: 0, t: 0, sum: 0 },
		3: { w: 0, t: 0, sum: 0 },
	};
	for (const p of playsAsTaker.value) {
		if (p.bouts == null) continue;
		const b = p.bouts as 0 | 1 | 2 | 3;
		const m = map[b]!;
		m.t++;
		m.sum += p.points;
		if (p.points > 0) m.w++;
	}
	return map;
});
const takerHeatmap = computed(() => {
	const contracts = ["prise", "garde", "garde_sans", "garde_contre"];
	const map: Record<string, Record<number, { w: number; t: number }>> = {};
	for (const c of contracts) {
		map[c] = {
			0: { w: 0, t: 0 },
			1: { w: 0, t: 0 },
			2: { w: 0, t: 0 },
			3: { w: 0, t: 0 },
		};
	}
	for (const p of playsAsTaker.value) {
		const c = p.contract as string;
		if (!c || !map[c]) continue;
		const b = p.bouts ?? -1;
		if (![0, 1, 2, 3].includes(b)) continue;
		const bucket = map[c]![b as 0 | 1 | 2 | 3]!;
		bucket.t++;
		if (p.points > 0) bucket.w++;
	}
	return map;
});
const takerBoutsDetail = computed(() => {
	const map: Record<string, { t: number; w: number }> = {
		petit: { t: 0, w: 0 },
		"21": { t: 0, w: 0 },
		excuse: { t: 0, w: 0 },
	};
	for (const p of playsAsTaker.value) {
		for (const c of p.boutsDetail) {
			const m = map[c];
			if (!m) continue;
			m.t++;
			if (p.points > 0) m.w++;
		}
	}
	return map;
});
const petitAuBoutStats = computed(() => {
	const forTaker = playsAsTaker.value.filter(
		(p) => p.petitAuBout === "preneur"
	).length;
	const againstTaker = playsAsTaker.value.filter(
		(p) => p.petitAuBout === "defense"
	).length;
	return { forTaker, againstTaker };
});

// Defense
const playsAsDefense = computed(() =>
	plays.value.filter((p) => p.role === "defense")
);
const defenseWinrate = computed(() => {
	const t = playsAsDefense.value.length;
	if (!t) return 0;
	const w = playsAsDefense.value.filter((p) => p.points > 0).length;
	return Math.round((w / t) * 1000) / 10;
});
const defenseAvg = computed(() => {
	const arr = playsAsDefense.value;
	if (!arr.length) return 0;
	return (
		Math.round((arr.reduce((a, p) => a + p.points, 0) / arr.length) * 10) /
		10
	);
});
const defenseContractDist = computed(() => {
	const map: Record<string, number> = {
		prise: 0,
		garde: 0,
		garde_sans: 0,
		garde_contre: 0,
	};
	for (const p of playsAsDefense.value) {
		if (p.contract && map[p.contract] != null) map[p.contract]!;
	}
	return map;
});

// Partners
const partners = computed(() => {
	const set = new Set<string>();
	for (const p of plays.value) {
		for (const name of p.participants) {
			if (name !== player.value) set.add(name);
		}
	}
	return Array.from(set).sort((a, b) => a.localeCompare(b));
});
const partnersData = computed(() => {
	return partners.value.map((name) => {
		let calledT = 0,
			calledSum = 0;
		let defT = 0,
			defSum = 0;
		for (const p of plays.value) {
			if (p.role === "taker" && p.called === name) {
				calledT++;
				calledSum += p.points;
			}
			if (p.role === "called" && p.taker === name) {
				calledT++;
				calledSum += p.points;
			}
			if (
				p.role === "defense" &&
				p.participants.includes(name) &&
				![p.taker, p.called].includes(name)
			) {
				defT++;
				defSum += p.points;
			}
		}
		const calledAvg = calledT
			? Math.round((calledSum / calledT) * 10) / 10
			: 0;
		const defAvg = defT ? Math.round((defSum / defT) * 10) / 10 : 0;
		return {
			name,
			calledCount: calledT,
			calledAvg,
			defCount: defT,
			defAvg,
		};
	});
});

// Highlights & table
const topBestGames = computed(() =>
	[...plays.value].sort((a, b) => b.points - a.points).slice(0, 5)
);
const topWorstGames = computed(() =>
	[...plays.value].sort((a, b) => a.points - b.points).slice(0, 5)
);
function computeStreaks(arr: NormalizedPlay[]) {
	let bestPos = 0;
	let bestNeg = 0;
	let curPos = 0;
	let curNeg = 0;
	for (const p of arr) {
		if (p.points > 0) {
			curPos++;
			bestPos = Math.max(bestPos, curPos);
			curNeg = 0;
		} else if (p.points < 0) {
			curNeg++;
			bestNeg = Math.max(bestNeg, curNeg);
			curPos = 0;
		} else {
			curPos = 0;
			curNeg = 0;
		}
	}
	return { bestPos, bestNeg };
}
const streaks = computed(() => computeStreaks(plays.value));
const biggestPosStreak = computed(() => streaks.value.bestPos);
const biggestNegStreak = computed(() => streaks.value.bestNeg);
const fullTable = computed(() =>
	plays.value.map((p) => ({
		date: new Date(p.timestamp).toLocaleString(),
		role: p.role,
		contract: p.contract ?? "-",
		points: p.points,
	}))
);

// History chart
const recentSeriesInternalChart = computed(() => {
	const labels = plays.value.map((p) =>
		new Date(p.timestamp).toLocaleDateString()
	);
	const values = plays.value.map((p) => p.points);
	const rolling: number[] = [];
	for (let i = 0; i < values.length; i++) {
		const slice = values.slice(Math.max(0, i - 9), i + 1);
		const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
		rolling.push(Math.round(avg * 10) / 10);
	}
	return {
		labels,
		datasets: [
			{
				label: "Points",
				data: values,
				borderColor: "#8b5cf6",
				backgroundColor: "#8b5cf633",
				fill: true,
				tension: 0.35,
			},
			{
				label: "Moyenne glissante (10)",
				data: rolling,
				borderColor: "#22c55e",
				backgroundColor: "transparent",
				fill: false,
				tension: 0.25,
			},
		],
	};
});

// Visual helpers (from StatsPlayer)
const gaugeStyle = (rate: number, color = "#7c3aed") => {
	const clamped = Math.max(0, Math.min(100, Number(rate) || 0));
	return { "--gauge": String(clamped), "--gauge-color": color } as any;
};
const partnerBarStyle = (v: number) => {
	const max = 200;
	const value = Number(v) || 0;
	const mag = Math.min(Math.abs(value) / max, 1);
	const width = (mag * 50).toFixed(1) + "%";
	return value >= 0 ? { left: "50%", width } : { right: "50%", width };
};
</script>

<template>
	<div class="container flex flex-col space-y-6">
		<div class="border rounded-xl p-4 px-6">
			<div class="flex flex-col space-y-2">
				<h1 class="page-title">
					<span class="page-title__label">Profil joueur</span>
					<span class="page-title__name">{{ player }}</span>
				</h1>
				<p class="muted text-sm">
					Vue d’ensemble des performances, du style de jeu et des
					affinités.
				</p>
			</div>
		</div>

		<div class="card flex flex-col space-y-4">
			<div class="flex flex-col">
				<h3>Résumé général</h3>
				<p class="muted text-sm">
					Photographie globale de tes résultats.
				</p>
			</div>
			<div class="summary-grid">
				<div class="card background-card summary-main">
					<span class="kpi-title">TOTAL CUMULÉ</span>
					<span
						class="kpi-number"
						:class="{
							'is-pos': totalPoints > 0,
							'is-neg': totalPoints < 0,
						}"
						>{{ totalPoints }} pts</span
					>
					<div class="summary-main__row">
						<div class="card summary-main__card">
							<span>Moyenne / Parties</span>
							{{ avgPoints }}
						</div>
						<div class="card summary-main__card">
							<span>Nombre de parties</span>
							{{ totalGames }}
						</div>
					</div>
					<div class="summary-main__row">
						<div class="pill">
							<span class="text-gray-400">NOMBRE D'ATTAQUES</span>
							{{ roleCounts.taker }}
						</div>
						<div class="pill">
							<span class="text-gray-400"
								>NOMBRE DE DÉFENSES</span
							>
							{{ roleCounts.defense }}
						</div>
					</div>
				</div>

				<div class="summary-side">
					<div
						class="card background-card summary-side__item"
					>
						<div class="kpi-title">Taux de réussite</div>
						<Camembert
							:rate="kpiWinrateDoughnut"
							:size="1.75"
							type="Taux"
						/>
					</div>
					<div
						class="card background-card summary-side__item"
					>
						<div class="kpi-title">RATIO ATTAQUE/DÉFENSE</div>
						<Camembert
							:rate="kpiRatioDoughnut"
							:size="1.75"
							type="Taux"
						/>
					</div>
					<div
						class="card background-card summary-side__item"
					>
						<div class="kpi-title">NOMBRE DE FOIS APPELÉ</div>
						<Camembert
							:rate="kpiCalledDoughnut"
							:size="1.75"
							type="Taux"
						/>
					</div>
				</div>
			</div>
		</div>

		<div
			v-if="!isPro"
			class="flex items-center space-x-4 p-4 rounded-md border bg-gray-900"
		>
			<strong>Premium</strong>
			<span class="muted">Accédez à toutes les fonctionnalités</span>
			<router-link class="btn btn-primary" :to="{ name: 'billing' }"
				>Voir l'offre</router-link
			>
		</div>

		<div :class="{ locked: !isPro }">
			<div class="flex w-full space-x-6">
				<div class="card w-full space-y-4">
					<div class="flex flex-col">
						<h3>ATTAQUE</h3>
						<p class="muted text-sm">Qualité de l'attaque</p>
					</div>

					<div class="row-kpis row-kpis--compact">
						<div class="kpi-block kpi-block--soft">
							<div class="kpi-title">Taux de réussite</div>
							<Camembert
								:size="1"
								:type="'Taux'"
								:rate="takerWinrate"
							/>
						</div>
						<div class="kpi-block kpi-block--soft">
							<div class="kpi-title">Moyenne</div>
							<div
								class="kpi-number"
								:class="{
									'is-pos': takerAvg > 0,
									'is-neg': takerAvg < 0,
								}"
							>
								{{ takerAvg }} pts
							</div>
							<p class="muted text-xs">
								Score moyen par prise jouée.
							</p>
						</div>
						<div class="kpi-block kpi-block--ghost">
							<div class="kpi-title">Petit au bout</div>
							<div class="kpi-inline">
								<div class="kpi-inline__item">
									<span class="kpi-inline__label"
										>Pour toi</span
									>
									<span class="kpi-inline__value">{{
										petitAuBoutStats.forTaker
									}}</span>
								</div>
								<div class="kpi-inline__item">
									<span class="kpi-inline__label"
										>Contre toi</span
									>
									<span class="kpi-inline__value">{{
										petitAuBoutStats.againstTaker
									}}</span>
								</div>
							</div>
						</div>
					</div>

					<div class="card flex space-x-4 w-full">
						<h4 class="kpi-title">RÉUSSITES / CONTRATS</h4>
					</div>
					<div class="bar-grid bar-grid--fancy">
						<div
							v-for="(v, key) in takerContractStats"
							:key="key"
							class="bar-item"
						>
							<div class="bar-item__header">
								<div class="bar-label">{{ key }}</div>
								<div class="bar-pill">{{ v.t }} parties</div>
							</div>
							<div class="bar-progress-wrapper">
								<div class="bar-progress-bg"></div>
								<div
									class="bar-progress-fill"
									:style="{
										width:
											(v.t
												? Math.round((v.w / v.t) * 100)
												: 0) + '%',
									}"
								></div>
							</div>
							<div class="bar-meta">
								<span
									>Winrate :
									<strong
										>{{
											v.t
												? Math.round(
														(v.w / v.t) * 1000
												  ) / 10
												: 0
										}}%</strong
									></span
								>
								<span class="muted"
									>Moy :
									{{
										v.t
											? Math.round((v.sum / v.t) * 10) /
											  10
											: 0
									}}
									pts</span
								>
							</div>
						</div>
					</div>

					<div class="card flex space-x-4 w-full">
						<h4 class="kpi-title">RÉUSSITES / NOMBRE DE BOUTS</h4>
					</div>
					<div class="bar-grid">
						<div
							v-for="(v, b) in takerBoutsStats"
							:key="b"
							class="bar-item bar-item--compact"
						>
							<div class="bar-label">
								{{ b }} bout{{ Number(b) > 1 ? "s" : "" }}
							</div>
							<div class="bar-meta bar-meta--tight">
								<span
									>Winrate :
									<strong
										>{{
											v.t
												? Math.round(
														(v.w / v.t) * 1000
												  ) / 10
												: 0
										}}%</strong
									></span
								>
								<span class="muted">{{ v.t }} parties</span>
							</div>
						</div>
					</div>

					<div class="card flex space-x-4 w-full">
						<h4 class="kpi-title">HEATMAP CONTRATS x BOUTS</h4>
					</div>
					<div class="heatmap-wrapper">
						<div class="heatmap">
							<div class="heatmap-row heatmap-head">
								<div class="heatmap-cell"></div>
								<div
									class="heatmap-cell"
									v-for="b in [0, 1, 2, 3]"
									:key="b"
								>
									{{ b }} bout{{ b > 1 ? "s" : "" }}
								</div>
							</div>
							<div
								class="heatmap-row"
								v-for="(row, key) in takerHeatmap"
								:key="key"
							>
								<div class="heatmap-label">{{ key }}</div>
								<div
									v-for="(obj, index) in row"
									:key="key + '-' + index"
									class="heatmap-cell heatmap-cell--soft"
									:style="{
										'--heat': obj.t > 0 ? obj.w / obj.t : 0,
									}"
								>
									<span v-if="obj.t === 0" class="muted"
										>—</span
									>
									<span v-else
										>{{
											Math.round((obj.w / obj.t) * 100)
										}}%</span
									>
									<small class="heatmap-count"
										>n={{ obj.t }}</small
									>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="card w-full space-y-4">
					<div class="flex flex-col">
						<h3>DÉFENSE</h3>
						<p class="muted text-sm">Qualité de la défense</p>
					</div>
					<div class="row-kpis row-kpis--compact">
						<div class="kpi-block kpi-block--soft">
							<div class="kpi-title">Taux de réussite</div>
							<div class="kpi-circle">
								<div
									class="kpi-gauge"
									:style="
										gaugeStyle(defenseWinrate, '#0ea5e9')
									"
								>
									<span>{{ defenseWinrate }}%</span>
									<small>Taux</small>
								</div>
							</div>
						</div>
						<div class="kpi-block kpi-block--soft">
							<div class="kpi-title">Moyenne</div>
							<div
								class="kpi-number"
								:class="{
									'is-pos': defenseAvg > 0,
									'is-neg': defenseAvg < 0,
								}"
							>
								{{ defenseAvg }} pts
							</div>
							<p class="muted text-xs">
								Score moyen lorsque tu es en défense.
							</p>
						</div>
					</div>
					<div class="card flex space-x-4 w-full">
						<span class="kpi-title">CONTRATS DÉFENDUS</span>
					</div>
					<div class="bar-grid">
						<div
							v-for="(v, key) in defenseContractDist"
							:key="key"
							class="bar-item bar-item--compact"
						>
							<div class="bar-label">{{ key }}</div>
							<div class="bar-meta bar-meta--tight">
								<span class="muted">{{ v || 0 }} parties</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="card w-full flex flex-col space-y-4">
				<div class="flex flex-col">
					<h3>Partenaires</h3>
					<span class="muted text-sm"
						>Affinités en attaque et en défense</span
					>
				</div>

				<div v-if="partnersData.length" class="partner-grid">
					<div
						v-for="p in partnersData"
						:key="p.name"
						class="partner-card"
					>
						<div class="partner-card__head">
							<div class="partner-card__name">{{ p.name }}</div>
							<span class="partner-tag"
								>{{ p.calledCount + p.defCount }} parties</span
							>
						</div>
						<div class="partner-card__stats">
							<div class="partner-stat">
								<div class="partner-stat__label">
									Appelé / Preneur – {{ p.calledCount }}
								</div>
								<div class="partner-bar">
									<div class="partner-bar__zero"></div>
									<div
										class="partner-bar__fill"
										:class="{
											'is-pos': p.calledAvg > 0,
											'is-neg': p.calledAvg < 0,
										}"
										:style="partnerBarStyle(p.calledAvg)"
									></div>
								</div>
								<div
									class="partner-stat__value"
									:class="{
										'is-pos': p.calledAvg > 0,
										'is-neg': p.calledAvg < 0,
									}"
								>
									{{ p.calledAvg }} pts
								</div>
							</div>
							<div class="partner-stat">
								<div class="partner-stat__label">
									Défense – {{ p.defCount }}
								</div>
								<div class="partner-bar">
									<div class="partner-bar__zero"></div>
									<div
										class="partner-bar__fill"
										:class="{
											'is-pos': p.defAvg > 0,
											'is-neg': p.defAvg < 0,
										}"
										:style="partnerBarStyle(p.defAvg)"
									></div>
								</div>
								<div
									class="partner-stat__value"
									:class="{
										'is-pos': p.defAvg > 0,
										'is-neg': p.defAvg < 0,
									}"
								>
									{{ p.defAvg }} pts
								</div>
							</div>
						</div>
					</div>
				</div>
				<div v-else class="muted">Pas assez de données.</div>
			</div>

			<div class="card w-full flex flex-col space-y-4">
				<div class="flex flex-col">
					<h3>Moments remarquables</h3>
					<p class="muted text-sm">Parties marquantes et séries.</p>
				</div>
				<div class="remark-grid">
					<div class="remark-box">
						<div class="remark-title">Meilleures parties</div>
						<ul>
							<li
								v-for="g in topBestGames"
								:key="'best-' + g.gameId"
							>
								<span class="remark-score is-pos"
									>{{ g.points }} pts</span
								>
								<span class="muted remark-date">{{
									new Date(g.timestamp).toLocaleString()
								}}</span>
							</li>
						</ul>
					</div>
					<div class="remark-box">
						<div class="remark-title">Pires parties</div>
						<ul>
							<li
								v-for="g in topWorstGames"
								:key="'worst-' + g.gameId"
							>
								<span class="remark-score is-neg"
									>{{ g.points }} pts</span
								>
								<span class="muted remark-date">{{
									new Date(g.timestamp).toLocaleString()
								}}</span>
							</li>
						</ul>
					</div>
					<div class="remark-box remark-box--streak">
						<div class="remark-title">Série positive max</div>
						<div class="remark-value">
							{{ biggestPosStreak }}
							<span class="remark-unit">parties</span>
						</div>
					</div>
					<div class="remark-box remark-box--streak">
						<div class="remark-title">Série négative max</div>
						<div class="remark-value">
							{{ biggestNegStreak }}
							<span class="remark-unit">parties</span>
						</div>
					</div>
				</div>
			</div>

			<div class="card w-full flex flex-col space-y-4">
				<div class="flex flex-col">
					<h3>Historique global</h3>
					<p class="muted text-sm">
						Évolution de tes scores dans le temps.
					</p>
				</div>
				<Graphique :data="recentSeriesInternalChart" />
			</div>

			<div class="card w-full flex flex-col space-y-4">
				<div class="flex flex-col">
					<h3>Détail des parties</h3>
					<p class="muted text-sm">
						Liste de toutes les parties jouées
					</p>
				</div>
				<div class="table-wrapper" v-if="fullTable.length">
					<table class="table compact">
						<thead>
							<tr>
								<th>Date</th>
								<th>Rôle</th>
								<th>Contrat</th>
								<th class="text-right">Points</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(row, i) in fullTable" :key="i">
								<td>{{ row.date }}</td>
								<td class="table-role">
									<span
										class="role-pill"
										:class="'role-pill--' + row.role"
										>{{ row.role }}</span
									>
								</td>
								<td>{{ row.contract }}</td>
								<td
									class="text-right"
									:class="{
										'is-pos': row.points > 0,
										'is-neg': row.points < 0,
									}"
								>
									{{ row.points }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.is-pos {
	color: var(--success);
}
.is-neg {
	color: var(--danger);
}
.background-card {
	background: radial-gradient(
			circle at top left,
			rgba(139, 92, 246, 0.35),
			transparent 55%
		),
		radial-gradient(
			circle at bottom right,
			rgba(45, 212, 191, 0.25),
			transparent 55%
		),
		var(--bg-elev-1);
}

/* Premium lock: blur all sections under summary when not Pro */
.locked {
	filter: blur(8px);
	pointer-events: none;
	user-select: none;
}

/* Header title styles (from StatsPlayer) */
.page-title {
	display: flex;
	flex-direction: column;
	gap: 4px;
	line-height: 1.05;
}
.page-title__label {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.16em;
	color: var(--muted);
}
.page-title__name {
	font-size: 2.4rem;
	font-weight: 800;
	overflow-wrap: anywhere;
	background: linear-gradient(120deg, #a5b4fc, #e5e7ff, #67e8f9);
	-webkit-background-clip: text;
	color: transparent;
}

/* Hero total styles (from StatsPlayer) */
.hero-total__label {
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: var(--text-secondary);
	font-size: 0.75rem;
}
.hero-total__value {
	font-size: 2.1rem;
	font-weight: 800;
	word-break: break-word;
}

/* Résumé général responsive */
.summary-grid {
	display: grid;
	grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.1fr);
	gap: 20px;
	align-items: stretch;
}
.summary-main {
	display: flex;
	flex-direction: column;
}
.summary-main__row {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-top: 16px;
}
.summary-main__card {
	flex: 1 1 140px;
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.summary-side {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
}
.summary-side__item {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

@media (max-width: 960px) {
	.summary-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	.summary-side {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
}

/* Adopt StatsPlayer visual components (scoped) */
.row-kpis {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 14px;
	margin-bottom: 18px;
}
.row-kpis--compact {
	margin-bottom: 10px;
	gap: 12px;
}
.kpi-block {
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border);
	border-radius: var(--radius-md);
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.kpi-block--soft {
	background: radial-gradient(
			circle at top left,
			rgba(148, 163, 255, 0.16),
			transparent 60%
		),
		var(--bg-elev-1);
}
.kpi-block--ghost {
	background: radial-gradient(
			circle at top left,
			transparent,
			transparent 55%
		),
		var(--bg-elev-1);
}
.kpi-title {
	font-size: 0.75rem;
	color: var(--text-secondary);
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
.kpi-number {
	font-size: 1.7rem;
	font-weight: 800;
}
.kpi-circle {
	display: flex;
	justify-content: center;
}
.kpi-inline {
	display: flex;
	gap: 18px;
	font-size: 0.9rem;
}
.kpi-inline__item {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.kpi-inline__label {
	color: var(--muted);
}
.kpi-inline__value {
	font-weight: 600;
}
.kpi-gauge {
	--gauge: 0;
	--gauge-color: #7c3aed;
	width: 84px;
	height: 84px;
	border-radius: 50%;
	background: conic-gradient(
		var(--gauge-color) calc(var(--gauge) * 1%),
		rgba(255, 255, 255, 0.08) 0
	);
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	color: #fff;
	flex: 0 0 auto;
}
.kpi-gauge--thin {
	width: 74px;
	height: 74px;
}
.kpi-gauge::after {
	content: "";
	position: absolute;
	inset: 12px;
	border-radius: 50%;
	background: var(--bg-elev-1);
	box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.45);
}
.kpi-gauge span,
.kpi-gauge small {
	position: relative;
	z-index: 1;
}
.kpi-gauge small {
	font-size: 0.7rem;
	color: rgba(255, 255, 255, 0.9);
}

.tag {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	border-radius: 999px;
	font-size: 0.78rem;
	border: 1px solid rgba(148, 163, 255, 0.4);
	background: rgba(15, 23, 42, 0.6);
}
.tag--green {
	border-color: rgba(34, 197, 94, 0.5);
	background: rgba(22, 163, 74, 0.18);
	color: #bbf7d0;
}
.tag--blue {
	border-color: rgba(59, 130, 246, 0.55);
	background: rgba(30, 64, 175, 0.24);
	color: #bfdbfe;
}
.tag--outline {
	border-style: dashed;
	background: transparent;
}

.bar-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
	gap: 10px;
}
.bar-grid--fancy {
	gap: 12px;
}
.bar-item {
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border-subtle);
	border-radius: var(--radius-md);
	padding: 10px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.bar-item--compact {
	padding: 8px 10px;
}
.bar-item--chip {
	padding: 8px 10px;
}
.bar-item__header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
}
.bar-label {
	font-size: 0.85rem;
	color: var(--text-secondary);
	text-transform: capitalize;
}
.bar-pill {
	font-size: 0.78rem;
	padding: 4px 8px;
	border-radius: 999px;
	background: rgba(148, 163, 255, 0.15);
	color: #e5e7ff;
}
.bar-progress-wrapper {
	position: relative;
	height: 8px;
	border-radius: 999px;
	overflow: hidden;
	margin-top: 2px;
}
.bar-progress-bg {
	position: absolute;
	inset: 0;
	background: rgba(148, 163, 255, 0.15);
}
.bar-progress-fill {
	position: absolute;
	inset: 0;
	width: 0;
	background: linear-gradient(
		90deg,
		rgba(129, 140, 248, 1),
		rgba(45, 212, 191, 1)
	);
}
.bar-meta {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	font-size: 0.8rem;
}
.bar-meta--tight {
	margin-top: 2px;
}
.bar-chip {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
}
.bar-chip__label {
	font-weight: 600;
	font-size: 0.9rem;
	text-transform: capitalize;
}
.bar-chip__tag {
	font-size: 0.75rem;
	padding: 3px 8px;
	border-radius: 999px;
	border: 1px solid rgba(148, 163, 255, 0.4);
}

.heatmap-wrapper {
	width: 100%;
	overflow-x: auto;
}
.heatmap {
	min-width: 420px;
	border-collapse: collapse;
	border-radius: var(--radius-md);
	overflow: hidden;
}
.heatmap-row {
	display: grid;
	grid-template-columns: 120px repeat(4, minmax(0, 1fr));
}
.heatmap-head .heatmap-cell {
	background: rgba(15, 23, 42, 0.85);
	font-size: 0.8rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--muted);
}
.heatmap-cell,
.heatmap-label {
	padding: 8px;
	border: 1px solid rgba(185, 194, 232, 0.12);
	text-align: center;
	font-size: 0.86rem;
}
.heatmap-label {
	background: rgba(15, 23, 42, 0.9);
	text-align: left;
	text-transform: capitalize;
}
.heatmap-cell--soft {
	background: radial-gradient(
			circle at top left,
			rgba(34, 197, 94, calc(var(--heat, 0) * 0.35)),
			transparent 55%
		),
		rgba(15, 23, 42, 0.7);
}
.heatmap-count {
	display: block;
	font-size: 0.7rem;
	color: var(--muted);
}

.partner-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 14px;
}
.partner-card {
	border-radius: var(--radius-md);
	background: radial-gradient(
			circle at top,
			rgba(124, 58, 237, 0.18),
			transparent 55%
		),
		var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.2);
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.partner-card__head {
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.partner-card__name {
	font-weight: 700;
	font-size: 1.02rem;
}
.partner-tag {
	font-size: 0.78rem;
	padding: 4px 8px;
	border-radius: 999px;
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(148, 163, 255, 0.4);
}
.partner-card__stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 10px;
}
.partner-stat {
	display: grid;
	gap: 6px;
}
.partner-stat__label {
	font-size: 0.8rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--muted);
}
.partner-bar {
	position: relative;
	height: 10px;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 999px;
	overflow: hidden;
}
.partner-bar__zero {
	position: absolute;
	left: 50%;
	top: 0;
	bottom: 0;
	width: 1px;
	background: rgba(255, 255, 255, 0.18);
}
.partner-bar__fill {
	position: absolute;
	top: 0;
	bottom: 0;
	border-radius: 999px;
	background: linear-gradient(
		90deg,
		rgba(255, 255, 255, 0.35),
		rgba(255, 255, 255, 0)
	);
}
.partner-bar__fill.is-pos {
	background: linear-gradient(
		90deg,
		rgba(34, 197, 94, 0.7),
		rgba(34, 197, 94, 0.2)
	);
}
.partner-bar__fill.is-neg {
	background: linear-gradient(
		90deg,
		rgba(239, 68, 68, 0.7),
		rgba(239, 68, 68, 0.2)
	);
}
.partner-stat__value {
	font-weight: 700;
	font-size: 1rem;
}

.remark-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 14px;
}
.remark-box {
	background: var(--bg-elev-1);
	border: 1px solid var(--surface-border-subtle);
	border-radius: var(--radius-md);
	padding: 12px;
}
.remark-box--streak {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: flex-start;
}
.remark-title {
	font-weight: 700;
	margin-bottom: 6px;
}
.remark-value {
	font-size: 1.6rem;
	font-weight: 800;
}
.remark-unit {
	font-size: 0.85rem;
	color: var(--muted);
	margin-left: 4px;
}
.remark-box ul {
	list-style: none;
	padding: 0;
	margin: 0;
	font-size: 0.9rem;
}
.remark-box li + li {
	margin-top: 4px;
}
.remark-score {
	font-weight: 700;
	margin-right: 6px;
}
.remark-date {
	font-size: 0.8rem;
}

.chart {
	height: 260px;
	border-radius: var(--radius-md);
	overflow: hidden;
}
.chart--gradient {
	background: radial-gradient(
			circle at top,
			rgba(129, 140, 248, 0.1),
			transparent 50%
		),
		var(--bg-elev-1);
	border: 1px solid var(--surface-border-subtle);
}

.table-wrapper {
	width: 100%;
	overflow-x: auto;
}
.table {
	width: 100%;
	min-width: 460px;
	border-collapse: collapse;
}
.table th,
.table td {
	padding: 9px 8px;
	border-bottom: 1px solid rgba(185, 194, 232, 0.12);
	text-align: left;
}
.table th {
	color: var(--text-secondary);
	font-weight: 600;
	font-size: 0.8rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
.table td.text-right,
.table th.text-right {
	text-align: right;
}
.table-role {
	min-width: 80px;
}
.role-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border-radius: 999px;
	font-size: 0.78rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
.role-pill--taker {
	background: rgba(34, 197, 94, 0.18);
	color: #bbf7d0;
}
.role-pill--called {
	background: rgba(56, 189, 248, 0.2);
	color: #bae6fd;
}
.role-pill--defense {
	background: rgba(148, 163, 184, 0.18);
	color: #e2e8f0;
}
</style>
