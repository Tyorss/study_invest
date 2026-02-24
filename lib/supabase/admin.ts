import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/env";

export function getAdminSupabase() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
