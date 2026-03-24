import React from "react"
import Link from "next/link"

import { DashboardActionsMenu } from "@/components/DashboardActionsMenu"
import { requirePageAuth } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requirePageAuth()
  const canAccessInventory =
    auth.profile.role === "lab_manager" || auth.profile.role === "lab_assistant"
  const canAccessBooking =
    auth.profile.role === "lab_manager" ||
    auth.profile.role === "lab_assistant" ||
    auth.profile.role === "faculty" ||
    auth.profile.role === "student"
  const canAccessTimetable = canAccessBooking
  const canAccessApparatus = canAccessBooking
  const canAccessSafety =
    auth.profile.role === "lab_manager" ||
    auth.profile.role === "lab_assistant" ||
    auth.profile.role === "faculty"
  const canAccessApprovals = auth.profile.role === "lab_manager"
  const canAccessActivity = auth.profile.role === "lab_manager"
  const canAccessAnalytics = auth.profile.role === "lab_manager"

  const quickLinks = [
    { href: "/dashboard/search", label: "Search" },
    ...(canAccessInventory ? [{ href: "/dashboard/inventory", label: "Inventory" }] : []),
    ...(canAccessBooking ? [{ href: "/dashboard/booking", label: "Booking" }] : []),
    ...(canAccessTimetable ? [{ href: "/dashboard/timetable", label: "Timetable" }] : []),
    ...(canAccessApparatus ? [{ href: "/dashboard/apparatus", label: "Apparatus" }] : []),
    ...(canAccessSafety ? [{ href: "/dashboard/safety", label: "Incidents" }] : []),
    ...(canAccessActivity ? [{ href: "/dashboard/activity", label: "Activity" }] : []),
    ...(canAccessAnalytics ? [{ href: "/dashboard/analytics", label: "Analytics" }] : []),
    ...(canAccessApprovals ? [{ href: "/dashboard/admin/approvals", label: "Approvals" }] : []),
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-foreground">ChemTrack</p>
            <p className="text-sm text-muted-foreground">
              {auth.profile.name} | {auth.profile.role.replaceAll("_", " ")}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/dashboard/search">Search</Link>
              {canAccessInventory ? <Link href="/dashboard/inventory">Inventory</Link> : null}
              {canAccessBooking ? <Link href="/dashboard/booking">Booking</Link> : null}
              {canAccessTimetable ? <Link href="/dashboard/timetable">Timetable</Link> : null}
              {canAccessApparatus ? <Link href="/dashboard/apparatus">Apparatus</Link> : null}
              {canAccessSafety ? <Link href="/dashboard/safety">Incidents</Link> : null}
              {canAccessActivity ? <Link href="/dashboard/activity">Activity</Link> : null}
              {canAccessAnalytics ? <Link href="/dashboard/analytics">Analytics</Link> : null}
              {canAccessApprovals ? <Link href="/dashboard/admin/approvals">Approvals</Link> : null}
            </nav>
            <DashboardActionsMenu links={quickLinks} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
