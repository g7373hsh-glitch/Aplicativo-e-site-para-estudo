import { createClient } from "@supabase/supabase-js";

// Supabase publishable keys are intended to be exposed in browser applications.
// Data access is protected by PostgreSQL RLS policies, never by hiding this key.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://bpjvbfjtbczpvkdpzrht.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_q1uD9OgnIAftgu4eM4fYKQ_ZmN4FX5y";

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
