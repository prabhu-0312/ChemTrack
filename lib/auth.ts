import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ApprovalStatus, Profile, UserRole } from "@/types/profile"

export type LabMembership = {
  lab_id: string
  role: UserRole
  joined_at: string
}

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  user: User
  userId: string
  email: string | null
  profile: Profile
  memberships: LabMembership[]
  currentLabId: string | null
  currentMembership: LabMembership | null
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

  if (error) {
    throw error
  }

  return data as Profile | null
}

export function getRedirectPathForStatus(status: ApprovalStatus): string {
  if (status === "pending") return "/pending-approval"
  if (status === "rejected") return "/rejected"
  return "/dashboard"
}

async function getRequestedLabId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("current_lab_id")?.value?.trim() || null
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return null
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("lab_members")
    .select("lab_id, role, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })

  if (membershipsError) {
    throw membershipsError
  }

  const requestedLabId = await getRequestedLabId()
  const memberRows = (memberships ?? []) as LabMembership[]
  const currentMembership =
    memberRows.find((membership) => membership.lab_id === requestedLabId) ?? memberRows[0] ?? null

  return {
    supabase,
    user,
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    memberships: memberRows,
    currentLabId: currentMembership?.lab_id ?? null,
    currentMembership,
  }
}

export async function requirePageAuth(allowedRoles?: UserRole[]): Promise<AuthContext> {
  const auth = await getAuthContext()

  if (!auth) {
    redirect("/login")
  }

  if (auth.profile.status !== "approved") {
    redirect(getRedirectPathForStatus(auth.profile.status))
  }

  if (allowedRoles && !allowedRoles.includes(auth.profile.role)) {
    redirect("/dashboard")
  }

  return auth
}
