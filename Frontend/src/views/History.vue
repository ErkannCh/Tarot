<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
	listRemoteSessionsIntoLocal,
	deleteSession,
} from "../stores/sessionStore";

const loading = ref(true);
const sessions = ref<
	Array<{
		localId: string;
		remoteId: string;
		participants: string[];
		createdAt: number;
	}>
>([]);

const confirmDialog = ref(false);
const toDelete = ref<{ localId: string; createdAt: number } | null>(null);

async function refresh() {
	loading.value = true;
	sessions.value = await listRemoteSessionsIntoLocal();
	loading.value = false;
}

onMounted(async () => {
	await refresh();
});

function askDelete(localId: string, createdAt: number) {
	toDelete.value = { localId, createdAt };
	confirmDialog.value = true;
}

async function confirmDelete() {
	if (!toDelete.value) {
		confirmDialog.value = false;
		return;
	}
	await deleteSession(toDelete.value.localId);
	confirmDialog.value = false;
	await refresh();
}
</script>

<template>
	<section class="container history">
		<header class="history__header">
			<h1>Vos parties passées</h1>
			<p class="subtitle">
				Retrouvez vos tables, participants et reprenez une session en un
				clic.
			</p>
		</header>

		<div v-if="loading" class="grid">
			<div class="skeleton" v-for="i in 6" :key="i"></div>
		</div>

		<div v-else>
			<div v-if="!sessions.length" class="empty card">
				<h3>Aucune session</h3>
				<p class="muted">
					Créez votre première table depuis le tableau de bord.
				</p>
			</div>

			<div v-else class="grid">
				<article
					v-for="s in sessions"
					:key="s.remoteId"
					class="card elev-2 item"
				>
					<div class="item__head">
						<div class="date">
							{{ new Date(s.createdAt).toLocaleString() }}
						</div>
					</div>
					<div class="divider"></div>
					<div class="chips">
						<span
							class="pill"
							v-for="p in s.participants"
							:key="p"
							>{{ p }}</span
						>
					</div>
					<div class="item__actions">
						<router-link
							class="btn btn-primary"
							:to="{ name: 'session', params: { id: s.localId } }"
						>
							Ouvrir
						</router-link>
						<button
							class="btn btn-danger"
							@click="askDelete(s.localId, s.createdAt)"
						>
							Supprimer
						</button>
					</div>
				</article>
			</div>
		</div>
	</section>

	<v-dialog v-model="confirmDialog" max-width="520">
		<v-card>
			<v-card-title class="text-h6 font-weight-bold"
				>Supprimer la session</v-card-title
			>
			<v-card-text>
				Êtes-vous sûr de vouloir supprimer cette session ({{
					toDelete
						? new Date(toDelete.createdAt).toLocaleString()
						: ""
				}}) ? Cette action retire cette session et ses parties de vos
				données locales. Les données distantes ne sont pas supprimées.
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="confirmDialog = false"
					>Annuler</v-btn
				>
				<v-btn color="red-darken-2" @click="confirmDelete"
					>Supprimer</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<style scoped>
.history__header {
	margin: 10px 0 18px;
}
.history__header h1 {
	font-size: clamp(1.6rem, 1.8vw + 1rem, 2.2rem);
	margin: 6px 0;
}
.subtitle {
	color: var(--text-secondary);
}

.grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16px;
}
@media (max-width: 1100px) {
	.grid {
		grid-template-columns: repeat(2, 1fr);
	}
}
@media (max-width: 700px) {
	.grid {
		grid-template-columns: 1fr;
	}
}

.item {
	padding: 16px;
}
.item__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.date {
	color: var(--muted);
	font-size: 0.9rem;
}
.chips {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	margin: 12px 0;
}
.item__actions {
	display: flex;
	gap: 10px;
	justify-content: flex-end;
}

.skeleton {
	height: 140px;
	border-radius: var(--radius-md);
	background: linear-gradient(
		90deg,
		rgba(255, 255, 255, 0.04),
		rgba(255, 255, 255, 0.08),
		rgba(255, 255, 255, 0.04)
	);
	animation: shimmer 1.2s infinite linear;
	background-size: 200% 100%;
}
@keyframes shimmer {
	0% {
		background-position: 0 0;
	}
	100% {
		background-position: 200% 0;
	}
}

.empty {
	text-align: center;
	padding: 28px;
}

@media (max-width: 480px) {
	.item__actions {
		flex-direction: column;
		align-items: stretch;
	}
	.item__actions .btn {
		width: 100%;
	}
}
</style>
