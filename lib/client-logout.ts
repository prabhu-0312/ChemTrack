"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

import { supabase } from "@/lib/supabase"

export async function logoutAndRedirect(router: AppRouterInstance) {
  await supabase.auth.signOut()

  await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  })

  router.replace("/login")
  router.refresh()
}
