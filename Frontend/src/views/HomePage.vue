<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

function onLoginClick() {
	router.push({ name: "login" });
}
</script>

<template>
	<main class="min-h-screen page">
		<!-- Hero -->
		<section
			class="relative mx-auto w-full max-w-6xl px-5 pt-20 pb-10 text-center"
		>
			<div
				class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider badge-primary"
			>
				<span
					class="h-2 w-2 animate-pulse rounded-full dot-primary"
				></span>
				Suivi avancé du Tarot
			</div>
			<div class="flex items-center justify-center">
				<img src="../assets/logo.png" alt="Tarot Tracker Logo" class="h-16 w-16 mt-4" />
				<h1
					class="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
				>
					Tarot Tracker
				</h1>
			</div>

			<p
				class="mx-auto mt-4 max-w-3xl text-base text-slate-300 sm:text-lg"
			>
				Enregistrez vos parties, synchronisez vos sessions, explorez des
				statistiques sublimes: preneur/appelé/défense, contrats, bouts,
				petit au bout, heatmaps et courbes d’évolution.
			</p>
			<div class="mt-7 flex flex-wrap items-center justify-center gap-3">
				<button
					@click="onLoginClick"
					class="rounded-xl px-5 py-3 text-sm font-semibold transition hover:brightness-110 active:translate-y-px btn-primary"
				>
					Commencer
				</button>
				<a
					href="#features"
					class="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20"
					>Découvrir les fonctionnalités</a
				>
			</div>
			<!-- Hero preview cards -->
			<div
				class="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
			>
				<div
					class="rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
				>
					<h3 class="text-base font-semibold text-white">Saisie ultra-rapide</h3>
					<p class="mt-1 text-sm text-slate-300">
						Ajoutez preneur, appelé, contrat, bouts, petit au bout,
						poignée, chelem... et laissez le calcul s’occuper du
						score.
					</p>
				</div>
				<div
					class="rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
				>
					<h3 class="text-base font-semibold text-white">
						Stats de haut niveau
					</h3>
					<p class="mt-1 text-sm text-slate-300">
						KPIs, courbes, donuts, heatmaps (Contrat × Bouts, Joueur
						× Contrat), winrate preneur, répartition des rôles.
					</p>
				</div>
				<div
					class="rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
				>
					<h3 class="text-base font-semibold text-white">Cloud & local</h3>
					<p class="mt-1 text-sm text-slate-300">
						Sessions locales, synchro Supabase, renommage et
						anonymisation des joueurs en toute simplicité.
					</p>
				</div>
			</div>
		</section>

		<!-- Feature highlights with visuals -->
		<section id="features" class="mx-auto w-full max-w-6xl px-5 pb-6">
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<!-- Card: Stats Globales -->
				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<h3 class="text-lg font-bold text-white">
						Statistiques globales élégantes
					</h3>
					<p class="mt-2 text-slate-300 text-sm">
						Classement total, taux de réussite preneur, répartition
						des contrats, scatter prises vs moyenne — tout est clair
						et esthétique.
					</p>
					<ul
						class="mt-3 text-sm text-slate-300 list-disc pl-5 space-y-1"
					>
						<li>Classement par total de points</li>
						<li>Winrate preneur (%) par joueur</li>
						<li>Heatmap Joueur × Contrat</li>
					</ul>
				</div>
				<!-- Card: Stats Joueur -->
				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<h3 class="text-lg font-bold text-white">
						Profil joueur ultra-complet
					</h3>
					<p class="mt-2 text-slate-300 text-sm">
						Historique avec moyenne glissante, répartition
						contrats/bouts, victoire en attaque/défense, paires
						visualisées.
					</p>
					<ul
						class="mt-3 text-sm text-slate-300 list-disc pl-5 space-y-1"
					>
						<li>Courbe des points + moyenne (10)</li>
						<li>Donuts attaque/défense (win/lose)</li>
						<li>Heatmap Contrat × Bouts</li>
						<li>Paires: barres comparatives</li>
					</ul>
				</div>
			</div>
		</section>

		<!-- CTA -->
		<section class="mx-auto w-full max-w-4xl px-5 py-10 text-center">
			<div class="rounded-2xl p-8 cta-card">
				<h3 class="text-2xl font-extrabold text-white">
					Prêt à booster votre jeu de Tarot ?
				</h3>
				<p class="mt-2 text-white">
					Créez une session, invitez les joueurs, et laissez la magie
					des graphiques opérer.
				</p>
				<div class="mt-5">
					<button
						@click="onLoginClick"
						class="rounded-xl px-6 py-3 text-sm font-semibold transition hover:brightness-110 active:translate-y-px btn-primary"
					>
						Se connecter
					</button>
				</div>
			</div>
		</section>

		<!-- FAQ/Infos -->
		<section class="mx-auto w-full max-w-4xl px-5 pb-16">
			<h2 class="text-xl font-bold text-slate-100">
				Questions fréquentes
			</h2>
			<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
					<h4 class="font-semibold">
						Comment sont calculés les points ?
					</h4>
					<p class="mt-1 text-sm text-slate-300">
						Contrat × écart au seuil selon les bouts, petit au bout,
						poignées et chelem — tout est intégré automatiquement.
					</p>
				</div>
				<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
					<h4 class="font-semibold">
						Puis-je synchroniser mes sessions ?
					</h4>
					<p class="mt-1 text-sm text-slate-300">
						Oui, via Supabase: vos parties locales se synchronisent
						et vos joueurs peuvent être renommés/anonymisés.
					</p>
				</div>
				<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
					<h4 class="font-semibold">
						Quelles visualisations sont disponibles ?
					</h4>
					<p class="mt-1 text-sm text-slate-300">
						Courbes, donuts, barres, heatmaps et scatter — sur la
						vue globale et la vue joueur.
					</p>
				</div>
				<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
					<h4 class="font-semibold">Compatibilité</h4>
					<p class="mt-1 text-sm text-slate-300">
						Fonctionne sur mobile et desktop, avec un thème sombre
						raffiné.
					</p>
				</div>
			</div>
		</section>
	</main>
</template>

<style scoped>
.badge-primary {
	border: 1px solid var(--secondary_color2);
	background-color: var(--primary_color2);
	color: #ffffff;
}
.dot-primary {
	background-color: var(--third_color2);
}

.cta-card {
	border: 1px solid var(--secondary_color2);
	background-color: var(--primary_color2);
}
</style>
