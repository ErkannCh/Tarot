<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
	advantages,
	proEnabled,
	refreshProFromSupabase,
} from "../stores/billingStore";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const router = useRouter();
const isPro = computed(() => proEnabled.value);
const isLoading = ref(false);
const portalLoading = ref(false);

onMounted(() => {
	refreshProFromSupabase();
});

async function startCheckout() {
	isLoading.value = true;
	const priceId = import.meta.env.VITE_STRIPE_PRICE_ID as string | undefined;
	if (!priceId) {
		alert("Paiement non configuré (VITE_STRIPE_PRICE_ID manquant).");
		isLoading.value = false;
		return;
		
	}
	const successUrl = `${window.location.origin}/app/abonnement/success`;
	const cancelUrl = `${window.location.origin}/app/abonnement`;
	const { data, error } = await supabase.functions.invoke(
		"create-checkout-session",
		{
			body: { priceId, successUrl, cancelUrl },
		}
	);
	if (error || !data?.url) {
		console.error("Checkout error", error || data);
		alert("Impossible de démarrer le paiement. Réessayez plus tard.");
		isLoading.value = false;
		return;
	}
	window.location.href = data.url as string;
	isLoading.value = false;
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
			<h1>Passer en Premium</h1>
			<p class="subtitle">Débloquez toutes les statistiques détaillées</p>
		</header>

		<div class="pricing card elev-2">
			<div class="price">
				<span class="amount">4,99€</span>
				<span class="period">abonnement annuel (4,99€ / an)</span>
			</div>
			<ul class="features">
				<li v-for="(adv, i) in advantages" :key="i">
					<i class="mdi mdi-check"></i>
					<span>{{ adv }}</span>
				</li>
			</ul>

			<div class="cta">
				<button
					v-if="!isPro && !isLoading"
					class="btn btn-primary"
					@click="startCheckout"
				>
					S’abonner pour 4,99€ / an
				</button>
				<button
					v-if="isLoading"
					class="btn btn-primary"
					disabled
				>
					Chargement...
				</button>
				<button
					v-if="isPro"
					class="btn btn-primary"
					:disabled="portalLoading"
					@click="openPortal"
				>
					{{ portalLoading ? "Ouverture…" : "Gérer mon abonnement" }}
				</button>
				<router-link
					v-if="isPro"
					class="btn btn-ghost"
					:to="{ name: 'stats' }"
				>
					Déjà Premium
				</router-link>
			</div>

			<p class="note muted">
				Le paiement est géré par Stripe Checkout. Après validation, vous
				serez redirigé ici et votre statut sera mis à jour
				automatiquement.
			</p>
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

.pricing {
	max-width: 720px;
	margin: 0 auto;
	padding: 18px;
}
.price {
	display: flex;
	align-items: baseline;
	gap: 12px;
}
.amount {
	font-weight: 900;
	font-size: clamp(2rem, 1.8vw + 1.6rem, 3rem);
}
.period {
	color: var(--muted);
}
.features {
	margin: 14px 0 10px;
	padding: 0;
	list-style: none;
	display: grid;
	grid-template-columns: 1fr;
	gap: 10px;
}
.features li {
	display: flex;
	gap: 8px;
	align-items: center;
}
.features i {
	color: var(--success);
}
.cta {
	margin-top: 12px;
	display: flex;
	gap: 8px;
}
.note {
	margin-top: 10px;
	font-size: 0.85rem;
}
</style>
