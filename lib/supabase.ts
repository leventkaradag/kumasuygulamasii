import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/config";

const env = readSupabaseEnv();

if (!env) {
  console.warn(
    "Missing Supabase env variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)."
  );
}

export const supabase = createClient(
  env?.supabaseUrl ?? "",
  env?.supabasePublishableKey ?? ""
);
