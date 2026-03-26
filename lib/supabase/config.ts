type SupabaseEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabasePublishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    return null
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  }
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv()

  if (!env) {
    throw new Error(
      "Missing Supabase env variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)."
    )
  }

  return env
}
