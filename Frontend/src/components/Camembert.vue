<script setup lang="ts">
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const props = defineProps<{
	rate: number;
	size?: number;
	color?: string;
	type?: string;
}>();

const subgaugeStyle = (height: number) => {
	return { height: height + 'px', width: height + 'px' } as any;
};

const gaugeStyle = (rate: number, color = "#7c3aed", height = 84) => {
	const clamped = Math.max(0, Math.min(100, Number(rate) || 0));
	return { "--gauge": String(clamped), "--gauge-color": color, height: height + 'px', width: height + 'px' } as any;
};
</script>

<template>
	<div class="kpi-circle">
		<div class="kpi-gauge" :style="gaugeStyle(rate, color, 84 * (size || 1))">
			<div class="kpi-subgauge" :style="subgaugeStyle(54 * (size || 1))">
				<span>{{ rate }} {{ type == "Taux" ? "%" : "" }}</span>
				<small>{{ type || "Taux" }}</small>
			</div>
		</div>
	</div>
</template>

<style scoped>

.kpi-circle {
	display: flex;
	justify-content: center;
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
.kpi-subgauge {
	width: 50px;
	height: 50px;
	border-radius: 50%;
	background-color: var(--bg-color);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}
</style>
