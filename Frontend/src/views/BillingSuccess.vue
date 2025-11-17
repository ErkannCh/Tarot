<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { proEnabled, refreshProFromSupabase } from "../stores/billingStore";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const isPro = computed(() => proEnabled.value);
const router = useRouter();
const portalLoading = ref(false);

onMounted(async () => {
	for (let i = 0; i < 5; i++) {
		const ok = await refreshProFromSupabase();
		if (ok) break;
		await new Promise((r) => setTimeout(r, 2000));
	}
});

function goStats() {
	router.push({ name: "stats" });
}

async function openPortal() {
	portalLoading.value = true;
	try {
		const returnUrl = `${window.location.origin}/app/abonnement`;
		const { data, error } = await supabase.functions.invoke(
			"create-portal-session",
			{
				body: { returnUrl },
			}
		);
		if (error || !data?.url) {
			console.error("Portal error", error || data);
			alert(
				"Impossible d’ouvrir le portail de facturation. Réessayez plus tard."
			);
			portalLoading.value = false;
			return;
		}
		window.location.href = data.url as string;
	} catch (e) {
		console.error("Portal exception", e);
		alert(
			"Impossible d’ouvrir le portail de facturation. Réessayez plus tard."
		);
	} finally {
		portalLoading.value = false;
	}
}
</script>

<template>
	<section class="container billing">
		<header class="billing__header">
			<h1>Paiement confirmé</h1>
			<p class="subtitle">Merci pour votre soutien !</p>
		</header>
		<div class="card elev-2 content">
			<p v-if="isPro">Votre accès Premium est actif.</p>
			<p v-else>Nous synchronisons votre statut…</p>
			<div class="cta">
				<button class="btn btn-primary" @click="goStats">
					Voir les statistiques
				</button>
				<button
					class="btn btn-ghost"
					:disabled="portalLoading"
					@click="openPortal"
				>
					{{ portalLoading ? "Ouverture…" : "Gérer l’abonnement" }}
				</button>
			</div>
		</div>
	</section>
</template>

<style scoped>
.billing__header {
	margin: 10px 0 18px;
}
.billing__header h1 {
	font-size: clamp(1.6rem, 1.8vw + 1rem, 2.2rem);
	margin: 6px 0;
}
.subtitle {
	color: var(--text-secondary);
}
.content {
	max-width: 720px;
	margin: 0 auto;
	padding: 18px;
}
.cta {
	margin-top: 12px;
	display: flex;
	gap: 8px;
}
</style>
