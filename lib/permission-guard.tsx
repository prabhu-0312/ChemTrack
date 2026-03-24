"use client"

import React from "react"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export type UserRole = "student" | "faculty" | "lab_assistant" | "lab_manager"

interface PermissionGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  currentRole: UserRole
}

export function PermissionGuard({ children, allowedRoles, currentRole }: PermissionGuardProps) {
  const hasAccess = allowedRoles.includes(currentRole)

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">403 - Access Denied</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          You do not have permission to access this page. This area is restricted to{" "}
          {allowedRoles.map((role, i) => (
            <span key={role}>
              <span className="font-medium capitalize">{role}</span>
              {i < allowedRoles.length - 2 ? ", " : i === allowedRoles.length - 2 ? " and " : ""}
            </span>
          ))}{" "}
          users only.
        </p>
        <Button asChild>
          <Link href="/dashboard/search">Go to Chemical Search</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

export function useUserRole(): { role: UserRole; userName: string; isLoading: boolean } {
  const [role, setRoleState] = useState<UserRole>("student")
  const [userName, setUserName] = useState("Guest User")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadRole = async () => {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id

      if (!userId) {
        if (mounted) setIsLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", userId)
        .maybeSingle()

      if (!mounted || !profile) {
        if (mounted) setIsLoading(false)
        return
      }

      setRoleState(profile.role as UserRole)
      setUserName((profile.name as string) || data.session?.user.email || "User")
      setIsLoading(false)
    }

    void loadRole()

    return () => {
      mounted = false
    }
  }, [])

  return { role, userName, isLoading }
}

// Role permission mappings
export const rolePermissions: Record<UserRole, string[]> = {
  student: ["/dashboard/search", "/dashboard/safety-info", "/dashboard/booking", "/dashboard/timetable", "/dashboard/apparatus"],
  faculty: ["/dashboard/search", "/dashboard/safety-info", "/dashboard/booking", "/dashboard/timetable", "/dashboard/safety", "/dashboard/apparatus"],
  lab_assistant: ["/dashboard/search", "/dashboard/inventory", "/dashboard/booking", "/dashboard/timetable", "/dashboard/safety", "/dashboard/apparatus"],
  lab_manager: [
    "/dashboard",
    "/dashboard/search",
    "/dashboard/safety-info",
    "/dashboard/booking",
    "/dashboard/timetable",
    "/dashboard/apparatus",
    "/dashboard/inventory",
    "/dashboard/activity",
    "/dashboard/analytics",
    "/dashboard/admin/approvals",
    "/dashboard/safety",
    "/dashboard/users",
    "/dashboard/settings",
  ],
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const allowedRoutes = rolePermissions[role]
  return allowedRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))
}

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "lab_manager":
      return "/dashboard"
    case "faculty":
    case "lab_assistant":
      return "/dashboard/search"
    case "student":
      return "/dashboard/search"
    default:
      return "/dashboard/search"
  }
}
