<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import { getSession, onAuthChange, signOut } from "../lib/supabaseClient";
import { refreshProFromSupabase } from "../stores/billingStore";
import { useRouter } from "vue-router";

const router = useRouter();
const isLargeScreen = ref<boolean>(window.innerWidth >= 640);
const userEmail = ref<string>("");
const userName = ref<string>("");
const userAvatar = ref<string>("");
let unsub: { data: { subscription: { unsubscribe: () => void } } } | null =
	null;

async function populateUser() {
	const { data } = await getSession();
	const session = data.session;
	const user = session?.user;
	userEmail.value = user?.email ?? "";
	const meta = (user?.user_metadata ?? {}) as Record<string, any>;
	userName.value = meta.full_name || meta.name || "";
	userAvatar.value = meta.avatar_url || meta.picture || "";
}

onMounted(async () => {
	await populateUser();
	try { await refreshProFromSupabase(); } catch {}
	unsub = onAuthChange(async (event, session) => {
		await populateUser();
		try { await refreshProFromSupabase(); } catch {}
		if (event === "SIGNED_OUT" || !session) {
			try {
				await router.replace({ name: "home" });
			} catch {}
		}
	}) as any;
});

onBeforeUnmount(() => {
	try {
		unsub?.data.subscription.unsubscribe();
	} catch {}
});

window.addEventListener("resize", () => {
	isLargeScreen.value = window.innerWidth >= 640;
});

async function logout() {
	window.location.replace("/");
	// Marqueur global pour le guard router
	(globalThis as any).__loggingOut = true;
	// Tente une déconnexion globale côté Supabase
	try {
		await signOut();
	} catch {}
	// Purge locale des tokens Supabase
	try {
		Object.keys(localStorage).forEach((k) => {
			if (k.startsWith("sb-")) localStorage.removeItem(k);
		});
	} catch {}
	// Redirection immédiate vers l'accueil (bypass router/gardes)
}
</script>

<template>
	<header class="topbar">
		<router-link class="brand glow" to="/app/dashboard">
			<img class="logo" src="../assets/logo.png" alt="Logo" />
			<span class="brand__text">Tarot Tracker</span>
		</router-link>

		<nav class="nav">
			<router-link class="nav__link" :to="{ name: 'dashboard' }">
				<i class="mdi mdi-home"></i>
				<span>Accueil</span>
			</router-link>
			<router-link class="nav__link" :to="{ name: 'history' }">
				<i class="mdi mdi-history"></i>
				<span>Historique</span>
			</router-link>
			<router-link class="nav__link" :to="{ name: 'stats' }">
				<i class="mdi mdi-chart-line"></i>
				<span>Statistiques</span>
			</router-link>
			<router-link class="nav__link" :to="{ name: 'billing' }">
				<i class="mdi mdi-star"></i>
				<span>Premium</span>
			</router-link>
			<router-link class="nav__link" :to="{ name: 'settings' }">
				<i class="mdi mdi-cog"></i>
				<span>Paramètres</span>
			</router-link>
		</nav>

		<div class="account">
			<span class="account__name">{{ userName || userEmail }}</span>
			<div v-if="isLargeScreen" class="avatar" :title="userName || userEmail">
				<img v-if="userAvatar" :src="userAvatar" alt="avatar" />
				<span v-else>{{
					(userName || userEmail || "U").charAt(0).toUpperCase()
				}}</span>
			</div>
			<!-- Si ecran grand text sinon logo -->
			<button v-if="isLargeScreen" class="btn btn-ghost" @click="logout">Déconnexion</button>
			<button v-else class="btn btn-ghost w-2 h-10" @click="logout">
				<i class="mdi mdi-logout"></i>
			</button>
		</div>
	</header>

	<main>
		<router-view />
	</main>
</template>

<style scoped>
.topbar {
	position: sticky;
	top: 0;
	z-index: 50;
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	grid-template-areas: "brand nav account";
	align-items: center;
	gap: 16px;
	padding: 10px 20px;
	background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.04),
			rgba(255, 255, 255, 0)
		),
		var(--bg-elev-2);
	border-bottom: 1px solid rgba(185, 194, 232, 0.12);
	box-shadow: var(--shadow-soft);
}
.brand {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	text-decoration: none;
	grid-area: brand;
}
.brand__text {
	font-weight: 800;
	letter-spacing: 0.3px;
	color: var(--text-primary);
}
.logo {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 45px;
	height: 45px;
	border-radius: 8px;
	background: linear-gradient(180deg, var(--brand), var(--brand-strong));
	color: #fff;
	box-shadow: 0 6px 16px rgba(109, 40, 217, 0.45);
}

.nav {
	display: inline-flex;
	gap: 8px;
	justify-content: center;
	flex-wrap: wrap;
	grid-area: nav;
}
.nav__link {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border-radius: 10px;
	color: var(--text-secondary);
	text-decoration: none;
	border: 1px solid transparent;
	transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.nav__link.router-link-active {
	color: var(--text-primary);
	border-color: rgba(185, 194, 232, 0.16);
	background: rgba(185, 194, 232, 0.06);
}
.nav__link:hover {
	color: var(--text-primary);
	background: rgba(185, 194, 232, 0.08);
}

.account {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	justify-self: end;
	grid-area: account;
}
.account__name {
	color: var(--text-secondary);
	display: none;
}
.avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	overflow: hidden;
	display: grid;
	place-items: center;
	background: var(--bg-elev-1);
	border: 1px solid rgba(185, 194, 232, 0.18);
	color: var(--text-primary);
	font-weight: 700;
}
.avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

@media (min-width: 640px) {
	.account__name {
		display: inline;
	}
}

/* Responsive topbar layout */
@media (max-width: 1200px) {
	.topbar {
		grid-template-columns: 1fr auto;
		grid-template-areas:
			"brand account"
			"nav nav";
		row-gap: 10px;
	}
	.nav {
		justify-content: space-between;
	}
}

@media (max-width: 560px) {
	.nav__link span {
		display: none;
	}
	.nav__link {
		padding: 8px;
	}
	.brand__text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 60vw;
	}
}

main {
	min-height: calc(100vh - (var(--topbar-h) + var(--topbar-vpad)));
	overflow-x: hidden; /* guard against child overflow */
}

/* Prevent grid children from forcing overflow */
.topbar > * {
	min-width: 0;
}
</style>
