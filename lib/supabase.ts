import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL")
if (!supabaseAnonKey) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")

const browserSupabaseUrl: string = supabaseUrl
const browserSupabaseAnonKey: string = supabaseAnonKey

let browserClient: SupabaseClient | undefined

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(browserSupabaseUrl, browserSupabaseAnonKey)
  }

  return browserClient
}

export const supabase = createBrowserSupabaseClient()
