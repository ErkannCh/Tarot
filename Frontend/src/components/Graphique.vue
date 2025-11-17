<script setup lang="ts">
import { Line } from "vue-chartjs";
const props = defineProps<{
	data: number;
}>();
</script>

<template>
	<div class="chart chart--gradient">
		<Line
			:data="props.data"
			:options="{
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					y: {
						grid: { color: 'rgba(185,194,232,0.12)' },
					},
					x: { grid: { display: false } },
				},
			}"
		/>
	</div>
</template>

<style scoped>
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
</style>
