<script setup lang="ts">
import { ref } from "vue";
import { signInWithProvider } from "../lib/supabaseClient";

const loading = ref(false);
const errorMsg = ref<string | null>(null);

async function loginWithGoogle() {
	errorMsg.value = null;
	loading.value = true;
	try {
		const { error } = await signInWithProvider("google");
		if (error) throw error;
	} catch (err: any) {
		errorMsg.value = err?.message ?? "Échec de la connexion.";
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<section class="login-page">
		<!-- Decorative background -->
		<div class="hero-bg" aria-hidden="true">
			<div class="orb orb-1"></div>
			<div class="orb orb-2"></div>
			<div class="mesh"></div>
		</div>

		<div class="container login-container">
			<div class="brand-hero glow">
				<div class="logo">
					<img src="../assets/logo.png" alt="Logo Tarot Tracker" />
				</div>
				<h1 class="brand-title">Tarot Tracker</h1>
				<p class="tagline">Vos soirées, vos scores, vos statistiques — magnifiés.</p>
			</div>

			<article class="card elev-2 login-card glass">
				<header class="login-header">
					<h2>Connexion</h2>
					<p class="subtitle">
						Enregistrez vos parties et retrouvez vos performances.
					</p>
				</header>

				<div v-if="errorMsg" class="alert alert-error">
					<i class="mdi mdi-alert-circle"></i>
					<span>{{ errorMsg }}</span>
				</div>

				<button
					class="btn btn-primary login-btn"
					:disabled="loading"
					@click="loginWithGoogle"
				>
					<i class="mdi mdi-google"></i>
					<span>{{ loading ? 'Connexion…' : 'Se connecter avec Google' }}</span>
				</button>

				<p class="trust muted">
					<i class="mdi mdi-shield-check"></i>
					Authentification sécurisée via Google. Aucune donnée sensible n’est stockée côté client.
				</p>

				<div class="divider"></div>

				<p class="terms muted small">
					En vous connectant, vous acceptez nos conditions d'utilisation.
				</p>
			</article>
		</div>
	</section>
</template>

<style scoped>
.login-page {
	position: relative;
	min-height: 100vh;
	display: grid;
	place-items: center;
	overflow: hidden;
}
.hero-bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.hero-bg .orb {
	position: absolute;
	filter: blur(32px);
	opacity: 0.35;
	transform: translateZ(0);
}
.hero-bg .orb-1 {
	width: 520px;
	height: 520px;
	left: -120px;
	top: -120px;
	background: radial-gradient(circle at 30% 30%, var(--brand), transparent 65%);
}
.hero-bg .orb-2 {
	width: 600px;
	height: 600px;
	right: -200px;
	bottom: -180px;
	background: radial-gradient(circle at 60% 40%, var(--accent), transparent 60%);
}
.hero-bg .mesh {
	position: absolute;
	inset: -2px;
	background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
	background-size: 22px 22px;
	mask-image: radial-gradient(800px 800px at 50% 40%, black 35%, transparent 100%);
	opacity: 0.5;
}

.login-container {
	max-width: 560px;
	width: 100%;
	padding: 24px 12px;
}

.brand-hero {
	display: grid;
	justify-items: center;
	gap: 10px;
	margin-bottom: 10px;
}
.brand-hero .logo {
	width: 64px;
	height: 64px;
	border-radius: 14px;
	overflow: hidden;
	display: grid;
	place-items: center;
	background: linear-gradient(180deg, var(--brand), var(--brand-strong));
	box-shadow: 0 10px 26px rgba(109, 40, 217, 0.45);
	animation: float 6s ease-in-out infinite;
}
.brand-hero .logo img {
	width: 72%;
	height: 72%;
	object-fit: contain;
}
.brand-title {
	font-weight: 900;
	font-size: clamp(1.6rem, 1.2vw + 1.2rem, 2rem);
	background: linear-gradient(90deg, var(--brand), var(--accent));
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
	letter-spacing: 0.3px;
}
.tagline {
	color: var(--text-secondary);
	text-align: center;
}

.login-card {
	position: relative;
	padding: 22px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	border: 1px solid var(--surface-border);
}
.glass {
	backdrop-filter: saturate(140%) blur(8px);
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
		var(--bg-elev-1);
}

.login-header h2 {
	margin: 0;
	font-size: clamp(1.2rem, 1vw + 1rem, 1.6rem);
}
.subtitle {
	color: var(--text-secondary);
}

.alert {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--surface-border);
}
.alert-error {
	background: rgba(239, 68, 68, 0.12);
	border-color: rgba(239, 68, 68, 0.45);
	color: #fecaca;
}

.login-btn {
	width: 100%;
	justify-content: center;
}
.login-btn .mdi {
	font-size: 1.2rem;
}

.trust {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 0.9rem;
}
.terms {
	text-align: center;
}

@keyframes float {
	0% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-6px);
	}
	100% {
		transform: translateY(0);
	}
}

@media (max-width: 480px) {
	.login-card {
		padding: 16px;
	}
}
</style>
