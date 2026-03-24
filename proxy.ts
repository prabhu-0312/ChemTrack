import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { createMiddlewareSupabaseClient } from "@/lib/supabase-middleware"

const AUTH_ROUTES = new Set(["/login", "/signup"])
const ROLE_GUARDS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard/admin/approvals", roles: ["lab_manager"] },
  { prefix: "/dashboard/approvals", roles: ["lab_manager"] },
  { prefix: "/dashboard/activity", roles: ["lab_manager"] },
  { prefix: "/dashboard/analytics", roles: ["lab_manager"] },
  { prefix: "/dashboard/users", roles: ["lab_manager"] },
  { prefix: "/dashboard/settings", roles: ["lab_manager"] },
  { prefix: "/dashboard/safety", roles: ["faculty", "lab_assistant", "lab_manager"] },
  { prefix: "/dashboard/inventory", roles: ["lab_assistant", "lab_manager"] },
  { prefix: "/dashboard/booking", roles: ["student", "faculty", "lab_assistant", "lab_manager"] },
  { prefix: "/dashboard/timetable", roles: ["student", "faculty", "lab_assistant", "lab_manager"] },
  { prefix: "/dashboard/apparatus", roles: ["student", "faculty", "lab_assistant", "lab_manager"] },
]

function getRedirectPathForStatus(status: string): string {
  if (status === "pending") return "/pending-approval"
  if (status === "rejected") return "/rejected"
  return "/dashboard"
}

function getDefaultDashboardPath(role: string): string {
  if (role === "lab_manager" || role === "lab_assistant") return "/dashboard/inventory"
  if (role === "faculty") return "/dashboard/booking"
  return "/dashboard/search"
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareSupabaseClient(request)
  const pathname = request.nextUrl.pathname

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isDashboardRoute = pathname.startsWith("/dashboard")
  const isPendingRoute = pathname === "/pending-approval"
  const isRejectedRoute = pathname === "/rejected"
  const isAuthRoute = AUTH_ROUTES.has(pathname)

  if (!user) {
    if (isDashboardRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("next", pathname)
      return NextResponse.redirect(url)
    }

    return response
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    if (isDashboardRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    return response
  }

  const { data: memberships } = await supabase
    .from("lab_members")
    .select("lab_id, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })

  const preferredLabId = request.cookies.get("current_lab_id")?.value ?? null
  const fallbackLabId =
    memberships?.find((membership) => membership.lab_id === preferredLabId)?.lab_id ??
    memberships?.[0]?.lab_id ??
    null

  if (fallbackLabId && fallbackLabId !== preferredLabId) {
    response.cookies.set("current_lab_id", fallbackLabId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  const redirectPath = getRedirectPathForStatus(profile.status)

  if (profile.status !== "approved") {
    if (isPendingRoute || isRejectedRoute) {
      return response
    }

    const url = request.nextUrl.clone()
    url.pathname = redirectPath
    return NextResponse.redirect(url)
  }

  if (isPendingRoute || isRejectedRoute || isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  if (pathname === "/dashboard") {
    const url = request.nextUrl.clone()
    url.pathname = getDefaultDashboardPath(profile.role)
    return NextResponse.redirect(url)
  }

  const guard = ROLE_GUARDS.find((item) => pathname.startsWith(item.prefix))
  if (guard && !guard.roles.includes(profile.role)) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
