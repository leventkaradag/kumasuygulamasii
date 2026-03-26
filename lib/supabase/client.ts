import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/supabase/config'

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv()

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
  )
}
