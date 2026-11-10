import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();
export const supabaseConfigured = Boolean(url && key);
export const supabasePartialConfig = Boolean(url || key) && !supabaseConfigured;
export const demoEnabled = process.env.NEXT_PUBLIC_AUTH_MODE === "demo";
export const cloudEnabled = !demoEnabled && supabaseConfigured;
let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!supabaseConfigured)
    throw new Error(
      "Completa la URL y la clave pública de Supabase en .env.local y reinicia la app.",
    );
  if (!client)
    client = createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  return client;
}
