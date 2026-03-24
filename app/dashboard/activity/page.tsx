"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, ClipboardList, FlaskConical, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Lab = {
  id: string
  name: string
}

type Actor = {
  id: string
  name: string
  email: string
  role: string
}

type BookingRow = {
  id: string
  lab_id: string | null
  user_id: string | null
  booking_date: string
  time_slot: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
  actor?: Actor | null
}

type UsageRow = {
  id: string
  lab_id: string | null
  user_id: string | null
  action: string
  quantity_change: number
  notes: string | null
  created_at: string
  actor?: Actor | null
}

type ActivityResponse = {
  lab: Lab | null
  labs: Lab[]
  since: string
  compatibility_mode?: "current" | "legacy-no-transaction-lab"
  bookings: BookingRow[]
  usage: UsageRow[]
}

export default function ActivityPage() {
  const [selectedLabId, setSelectedLabId] = useState("")
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadActivity = async (labId?: string) => {
    setIsLoading(true)

    try {
      const params = new URLSearchParams()
      if (labId) {
        params.set("lab_id", labId)
      }

      const response = await fetch(
        `/api/activity/weekly${params.toString() ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      )

      const payload = (await response.json()) as { error?: string } | ActivityResponse
      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error ?? "Unable to load weekly activity" : "Unable to load weekly activity",
        )
      }

      const activity = payload as ActivityResponse
      setData(activity)
      setSelectedLabId((current) => current || activity.lab?.id || activity.labs[0]?.id || "")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load weekly activity")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadActivity()
  }, [])

  useEffect(() => {
    if (!selectedLabId) return
    if (data?.lab?.id === selectedLabId) return
    void loadActivity(selectedLabId)
  }, [selectedLabId, data?.lab?.id])

  const timeline = useMemo(() => {
    if (!data) return []

    return [
      ...data.bookings.map((booking) => ({
        id: booking.id,
        kind: "booking" as const,
        created_at: booking.created_at,
        title: `${booking.actor?.name ?? "Unknown"} requested ${booking.time_slot ?? "a slot"}`,
        subtitle: `${new Date(booking.booking_date).toLocaleDateString()} | ${booking.status}`,
        badge: booking.status,
      })),
      ...data.usage.map((usage) => ({
        id: usage.id,
        kind: "usage" as const,
        created_at: usage.created_at,
        title: `${usage.actor?.name ?? "Unknown"} performed ${usage.action}`,
        subtitle: `${usage.quantity_change} units${usage.notes ? ` | ${usage.notes}` : ""}`,
        badge: usage.action,
      })),
    ].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  }, [data])

  if (isLoading && !data) {
    return <div className="text-muted-foreground">Loading weekly activity...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Weekly Lab Activity</h1>
        <p className="text-muted-foreground">
          Review the last 7 days of bookings and lab usage to trace incidents or missing items.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Lab Scope</CardTitle>
          <CardDescription>Select a lab to inspect its weekly activity timeline.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>Lab</Label>
          <Select value={selectedLabId} onValueChange={setSelectedLabId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a lab" />
            </SelectTrigger>
            <SelectContent>
              {(data?.labs ?? []).map((lab) => (
                <SelectItem key={lab.id} value={lab.id}>
                  {lab.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{data?.bookings.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Bookings Logged</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FlaskConical className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{data?.usage.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Usage Events</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{timeline.length}</p>
              <p className="text-sm text-muted-foreground">Timeline Entries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">7-Day Timeline</CardTitle>
          <CardDescription>
            {data?.lab?.name ?? "Selected lab"} from {data ? new Date(data.since).toLocaleDateString() : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.compatibility_mode === "legacy-no-transaction-lab" ? (
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-sm text-warning-foreground">
              Usage events are running in legacy compatibility mode because `inventory_transactions.lab_id` is not in your database yet.
            </div>
          ) : null}
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded for this lab in the last 7 days.</p>
          ) : (
            timeline.map((entry) => (
              <div key={`${entry.kind}-${entry.id}`} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <p className="font-medium text-card-foreground">{entry.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Recorded {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">{entry.badge}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
