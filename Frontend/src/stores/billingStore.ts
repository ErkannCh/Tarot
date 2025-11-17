import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";

export const proEnabled = ref<boolean>(false);

export async function refreshProFromSupabase(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      proEnabled.value = false;
      return false;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", uid)
      .single();
    // PGRST116: no rows found
    if (error && (error as any).code !== "PGRST116") {
      console.warn("[Premium] load failed", error);
      proEnabled.value = false;
      return false;
    }
    // If profile does not exist yet, create it with default is_premium = false
    if ((error as any)?.code === "PGRST116") {
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert({ id: uid, is_premium: false }, { onConflict: "id" });
      if (upsertErr) {
        console.warn("[Premium] auto-create profile failed", upsertErr);
      }
      proEnabled.value = false;
      return false;
    }
    proEnabled.value = Boolean((data as any)?.is_premium);
    return proEnabled.value;
  } catch (e) {
    proEnabled.value = false;
    return false;
  }
}

// Dev helper: crée/maj le profil avec is_premium = enabled.
// À désactiver en prod: préférer un webhook Stripe / Edge Function.
export async function setProDev(enabled: boolean): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return false;
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: uid, is_premium: enabled }, { onConflict: "id" });
  if (error) {
    console.warn("[Premium] upsert failed", error);
    return false;
  }
  proEnabled.value = enabled;
  return true;
}

export const advantages: string[] = [
  "Débloquez toutes les statistiques détaillées (joueurs et sessions)",
  "Aucune limite de sessions enregistrées",
  "Accès aux tableaux et graphiques avancés (répartitions, bouts, tendances)",
  "Accès aux exports CSV et JSON",
  "Configuration des scores personnalisée",
  "Soutenez le développement de Tarot Tracker",
];
