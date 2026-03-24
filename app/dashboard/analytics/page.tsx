"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BarChart3, CalendarClock, ShieldAlert, UsersRound, Wrench } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

type Lab = {
  id: string
  name: string
}

type LabsResponse = {
  current_lab_id: string | null
  labs: Lab[]
}

type AnalyticsResponse = {
  period_days: number
  lab_id: string
  lab_bookings: {
    total: number
    approved: number
    pending: number
    rejected: number
  }
  apparatus_bookings: {
    total: number
    approved: number
    pending: number
  }
  incidents: {
    total: number
    open: number
    resolved: number
    critical: number
  }
  maintenance: {
    total: number
    scheduled: number
    in_progress: number
    completed: number
  }
  attendance: {
    total_entries: number
    unique_people: number
  }
}

function percentage(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export default function AnalyticsPage() {
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLabId, setSelectedLabId] = useState("")
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadLabs = async () => {
    const response = await fetch("/api/labs", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | LabsResponse
    if (!response.ok || !payload || typeof payload !== "object" || !Array.isArray((payload as LabsResponse).labs)) {
      const message =
        "error" in (payload as Record<string, unknown>) &&
        typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : "Unable to load labs"
      throw new Error(message)
    }

    const data = payload as LabsResponse
    setLabs(data.labs)
    return data.current_lab_id || data.labs[0]?.id || ""
  }

  const loadAnalytics = async (labId: string) => {
    const response = await fetch(`/api/analytics?lab_id=${encodeURIComponent(labId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const payload = (await response.json()) as { error?: string } | AnalyticsResponse
    if (!response.ok) {
      throw new Error("error" in payload ? payload.error ?? "Unable to load analytics" : "Unable to load analytics")
    }

    setAnalytics(payload as AnalyticsResponse)
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const initialLabId = await loadLabs()
        setSelectedLabId(initialLabId)
        if (initialLabId) {
          await loadAnalytics(initialLabId)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load analytics")
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const handleLabChange = async (value: string) => {
    setSelectedLabId(value)
    setIsLoading(true)
    try {
      await loadAnalytics(value)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load analytics")
    } finally {
      setIsLoading(false)
    }
  }

  const summary = useMemo(() => {
    if (!analytics) return null

    return {
      bookingApprovalRate: percentage(analytics.lab_bookings.approved, analytics.lab_bookings.total),
      apparatusApprovalRate: percentage(
        analytics.apparatus_bookings.approved,
        analytics.apparatus_bookings.total,
      ),
      incidentResolutionRate: percentage(analytics.incidents.resolved, analytics.incidents.total),
      maintenanceCompletionRate: percentage(
        analytics.maintenance.completed,
        analytics.maintenance.total,
      ),
    }
  }, [analytics])

  if (isLoading && !analytics) {
    return <div className="text-muted-foreground">Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Review the last {analytics?.period_days ?? 30} days of booking, safety, maintenance, and attendance signals.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Lab Scope</CardTitle>
          <CardDescription>Select a lab to inspect its recent operational metrics.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>Lab</Label>
          <Select value={selectedLabId} onValueChange={(value) => void handleLabChange(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a lab" />
            </SelectTrigger>
            <SelectContent>
              {labs.map((lab) => (
                <SelectItem key={lab.id} value={lab.id}>
                  {lab.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{analytics?.lab_bookings.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Lab Booking Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{analytics?.apparatus_bookings.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Apparatus Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{analytics?.incidents.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Incidents Logged</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <UsersRound className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{analytics?.attendance.unique_people ?? 0}</p>
              <p className="text-sm text-muted-foreground">Unique Lab Visitors</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Approval Health</CardTitle>
            <CardDescription>How request handling is trending for this lab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lab booking approval rate</span>
                <span className="font-medium text-card-foreground">{summary?.bookingApprovalRate ?? 0}%</span>
              </div>
              <Progress value={summary?.bookingApprovalRate ?? 0} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Apparatus booking approval rate</span>
                <span className="font-medium text-card-foreground">{summary?.apparatusApprovalRate ?? 0}%</span>
              </div>
              <Progress value={summary?.apparatusApprovalRate ?? 0} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Pending Lab Bookings</p>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.lab_bookings.pending ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Approved Lab Bookings</p>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.lab_bookings.approved ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Pending Apparatus</p>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.apparatus_bookings.pending ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Safety and Maintenance</CardTitle>
            <CardDescription>Operational readiness for the selected lab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Incident resolution rate</span>
                <span className="font-medium text-card-foreground">{summary?.incidentResolutionRate ?? 0}%</span>
              </div>
              <Progress value={summary?.incidentResolutionRate ?? 0} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Maintenance completion rate</span>
                <span className="font-medium text-card-foreground">{summary?.maintenanceCompletionRate ?? 0}%</span>
              </div>
              <Progress value={summary?.maintenanceCompletionRate ?? 0} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Open Incidents</p>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.incidents.open ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Critical Incidents</p>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.incidents.critical ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Maintenance Tasks</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-card-foreground">{analytics?.maintenance.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Attendance Snapshot</CardTitle>
          <CardDescription>Use this to compare traffic with incidents, bookings, and equipment requests.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-5">
            <p className="text-sm text-muted-foreground">Attendance Entries</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{analytics?.attendance.total_entries ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Total check-ins and check-outs recorded in the last {analytics?.period_days ?? 30} days.
            </p>
          </div>
          <div className="rounded-lg border border-border p-5">
            <p className="text-sm text-muted-foreground">Unique People</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{analytics?.attendance.unique_people ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Distinct users seen in the same period for this lab.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
