import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../views/HomePage.vue";
import Login from "../views/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import History from "../views/History.vue";
import Stats from "../views/Stats.vue";
import Billing from "../views/Billing.vue";
import BillingSuccess from "../views/BillingSuccess.vue";
import StatsPlayer from "../views/StatsPlayer.vue";
import AuthedLayout from "../layouts/AuthedLayout.vue";
import SessionPage from "../views/Session.vue";
import SessionStats from "../views/SessionStats.vue";
import { getSession } from "../lib/supabaseClient";

const routes = [
	{
		path: "/",
		name: "home",
		component: HomePage,
		meta: { redirectIfAuthed: true },
	},
	{
		path: "/login",
		name: "login",
		component: Login,
		meta: { redirectIfAuthed: true },
	},
	{ path: "/session/:id", name: "session", component: SessionPage },
	{
		path: "/session/:id/stats",
		name: "session-stats",
		component: SessionStats,
	},
	{
		path: "/session/:id/add-game",
		name: "session-add-game",
		component: () => import("../views/SessionAddGame.vue"),
	},
	{
		path: "/app",
		component: AuthedLayout,
		meta: { requiresAuth: true },
		children: [
			{ path: "dashboard", name: "dashboard", component: Dashboard },
			{ path: "historique", name: "history", component: History },
			{ path: "statistiques", name: "stats", component: Stats },
			{ path: "abonnement", name: "billing", component: Billing },
			{
				path: "abonnement/success",
				name: "billing-success",
				component: BillingSuccess,
			},
			{
				path: "statistiques/joueur/:name",
				name: "player-stats",
				component: StatsPlayer,
			},
			{
				path: "parametres",
				name: "settings",
				component: () => import("../views/Settings.vue"),
			},
			{
				path: "parametres/scores",
				name: "settings-scores",
				component: () => import("../views/ScoreSettings.vue"),
			},
			{ path: "", redirect: { name: "dashboard" } },
		],
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
	scrollBehavior() {
		return { top: 0 };
	},
});

router.beforeEach(async (to) => {
	const isLoggingOut = (globalThis as any).__loggingOut === true;
	const { data } = await getSession();
	const session = data.session;

	if (to.meta?.requiresAuth && (!session || isLoggingOut)) {
		return { name: "home" };
	}
	if (to.meta?.redirectIfAuthed && session && !isLoggingOut) {
		return { name: "dashboard" };
	}
	return true;
});

export default router;
