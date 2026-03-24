"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Building, Calendar as CalendarIcon, Clock, FlaskConical, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type BookingLab = {
  id: string
  name: string
  member_role?: string | null
}

type BookingRecord = {
  id: string
  lab_id?: string | null
  labs?: BookingLab | null
  requester?: {
    id: string
    name: string
    email: string
  } | null
  booking_date: string
  time_slot: string
  status: "pending" | "approved" | "rejected"
}

type LabsResponse = {
  current_lab_id: string | null
  viewer_role: "student" | "faculty" | "lab_assistant" | "lab_manager"
  viewer_user_id: string
  labs: Array<BookingLab & { joined_at?: string | null }>
}

type TimeSlot = {
  id: string
  time: string
}

const timeSlots: TimeSlot[] = [
  { id: "08:00-10:00", time: "08:00 - 10:00" },
  { id: "10:00-12:00", time: "10:00 - 12:00" },
  { id: "12:00-14:00", time: "12:00 - 14:00" },
  { id: "14:00-16:00", time: "14:00 - 16:00" },
  { id: "16:00-18:00", time: "16:00 - 18:00" },
]

function isLabsResponse(payload: unknown): payload is LabsResponse {
  if (!payload || typeof payload !== "object") return false
  return Array.isArray((payload as LabsResponse).labs)
}

function toLocalDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function TimetablePage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedLabId, setSelectedLabId] = useState("")
  const [labs, setLabs] = useState<BookingLab[]>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null)
  const [isLoadingLabs, setIsLoadingLabs] = useState(true)
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? null
  const selectedDay = selectedDate ? toLocalDateOnly(selectedDate) : null

  const loadLabs = async () => {
    setIsLoadingLabs(true)

    try {
      const response = await fetch("/api/labs", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      const payload = (await response.json()) as { error?: string } | LabsResponse
      if (!response.ok || !isLabsResponse(payload)) {
        throw new Error(
          !isLabsResponse(payload) && payload && typeof payload === "object" && "error" in payload
            ? payload.error ?? "Unable to load labs"
            : "Unable to load labs",
        )
      }

      setLabs(payload.labs)
      setSelectedLabId((current) => current || payload.current_lab_id || payload.labs[0]?.id || "")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load labs")
    } finally {
      setIsLoadingLabs(false)
    }
  }

  const loadBookings = async (labId: string) => {
    if (!labId) {
      setBookings([])
      return
    }

    setIsLoadingBookings(true)

    try {
      const params = new URLSearchParams({ lab_id: labId })
      const response = await fetch(`/api/bookings?${params.toString()}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      const payload = (await response.json()) as { error?: string } | BookingRecord[]
      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error ?? "Unable to load timetable" : "Unable to load timetable",
        )
      }

      const nextBookings = Array.isArray(payload) ? payload.filter((booking) => booking.status !== "rejected") : []
      setBookings(nextBookings)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load timetable")
    } finally {
      setIsLoadingBookings(false)
    }
  }

  useEffect(() => {
    void loadLabs()
  }, [])

  useEffect(() => {
    if (!selectedLabId) return
    setActiveBookingId(null)
    void loadBookings(selectedLabId)
  }, [selectedLabId])

  const bookingsForDay = useMemo(() => {
    if (!selectedDay) return []
    return bookings.filter(
      (booking) => booking.lab_id === selectedLabId && booking.booking_date.slice(0, 10) === selectedDay,
    )
  }, [bookings, selectedDay, selectedLabId])

  const activeBooking =
    bookingsForDay.find((booking) => booking.id === activeBookingId) ??
    null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lab Timetable</h1>
        <p className="text-muted-foreground">
          Select a lab and date to see which slots are free, pending, or occupied.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Select Date</CardTitle>
            </div>
            <CardDescription>Choose a date to inspect lab availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="mx-auto"
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Timetable Details</CardTitle>
            <CardDescription>Pick a lab and click an occupied slot to inspect it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-card-foreground">Lab Room</Label>
              <Select
                value={selectedLabId}
                onValueChange={setSelectedLabId}
                disabled={isLoadingLabs || labs.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingLabs ? "Loading labs..." : "Choose a lab room"} />
                </SelectTrigger>
                <SelectContent>
                  {labs.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-card-foreground">Time Slots</Label>
              <div className="grid gap-2">
                {timeSlots.map((slot) => {
                  const slotBooking =
                    bookingsForDay.find((booking) => booking.time_slot === slot.id && booking.status === "approved") ??
                    bookingsForDay.find((booking) => booking.time_slot === slot.id && booking.status === "pending") ??
                    null

                  const toneClasses =
                    slotBooking?.status === "approved"
                      ? "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                      : slotBooking?.status === "pending"
                        ? "border-warning/20 bg-warning/10 text-warning-foreground hover:bg-warning/15"
                        : "border-border bg-card text-card-foreground hover:bg-accent"

                  return (
                    <Button
                      key={slot.id}
                      type="button"
                      variant="outline"
                      className={cn("justify-start", toneClasses)}
                      disabled={!selectedLabId}
                      onClick={() => setActiveBookingId(slotBooking?.id ?? null)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {slot.time}
                      {slotBooking ? (
                        <Badge
                          variant="outline"
                          className="ml-auto border-current text-current"
                        >
                          {slotBooking.status === "approved" ? "Occupied" : "Pending"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">
                          Free
                        </Badge>
                      )}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              {activeBooking ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <span className="font-medium text-card-foreground">
                      {activeBooking.labs?.name ?? selectedLab?.name ?? "Selected lab"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    {new Date(activeBooking.booking_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {activeBooking.time_slot}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    {activeBooking.requester?.name ?? "Unknown requester"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activeBooking.requester?.email ?? ""}
                  </div>
                  <Badge variant="outline">
                    {activeBooking.status === "approved" ? "Occupied" : "Awaiting approval"}
                  </Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-card-foreground">No slot selected</p>
                  <p className="text-sm text-muted-foreground">
                    Click an occupied or pending slot to see who is using it.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 py-4">
          <Building className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-card-foreground">
              {selectedLab?.name ?? (isLoadingLabs ? "Loading lab..." : "Choose a lab to begin")}
            </p>
            <p className="text-sm text-muted-foreground">
              {isLoadingBookings
                ? "Loading timetable..."
                : selectedDate
                  ? `Viewing ${selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`
                  : "Choose a date to begin"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
