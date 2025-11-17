import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	// Avertissement en dev si les variables ne sont pas définies
	console.warn(
		"[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante(s)."
	);
}

export const supabase: SupabaseClient = createClient(
	supabaseUrl ?? "",
	supabaseAnonKey ?? "",
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	}
);

export async function signInWithProvider(provider: "google") {
	return supabase.auth.signInWithOAuth({
		provider,
		options: {
			redirectTo: `${window.location.origin}/`,
			// queryParams: { access_type: 'offline', prompt: 'consent' },
		},
	});
}

export async function signOut() {
	return supabase.auth.signOut();
}

export function getSession() {
	return supabase.auth.getSession();
}

export function onAuthChange(
	callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]
) {
	return supabase.auth.onAuthStateChange(callback);
}
