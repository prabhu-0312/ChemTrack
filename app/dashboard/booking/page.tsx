"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  Building,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
} from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
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

function isLabsResponse(payload: unknown): payload is LabsResponse {
  if (!payload || typeof payload !== "object") return false
  return Array.isArray((payload as LabsResponse).labs)
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

function toLocalDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedLabId, setSelectedLabId] = useState("")
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [purpose, setPurpose] = useState("")
  const [labs, setLabs] = useState<BookingLab[]>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [isLoadingLabs, setIsLoadingLabs] = useState(true)
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewerRole, setViewerRole] = useState<LabsResponse["viewer_role"] | null>(null)
  const [viewerUserId, setViewerUserId] = useState("")

  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? null
  const isReadOnlyViewer = viewerRole === "student"
  const ownRequests = bookings.filter((booking) => booking.requester?.id === viewerUserId)

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
      setViewerRole(payload.viewer_role)
      setViewerUserId(payload.viewer_user_id)
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
          "error" in payload ? payload.error ?? "Unable to load bookings" : "Unable to load bookings",
        )
      }

      setBookings(Array.isArray(payload) ? payload : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load bookings")
    } finally {
      setIsLoadingBookings(false)
    }
  }

  useEffect(() => {
    void loadLabs()
  }, [])

  useEffect(() => {
    if (!selectedLabId) return
    void loadBookings(selectedLabId)
  }, [selectedLabId])

  const availabilityStatus = useMemo<"idle" | "available" | "conflict">(() => {
    if (!selectedDate || !selectedLabId || !selectedTimeSlot) {
      return "idle"
    }

    const selectedDay = toLocalDateOnly(selectedDate)
    const hasConflict = bookings.some((booking) => {
      if (booking.lab_id !== selectedLabId) return false
      if (booking.status !== "approved") return false
      return booking.time_slot === selectedTimeSlot && booking.booking_date.slice(0, 10) === selectedDay
    })

    return hasConflict ? "conflict" : "available"
  }, [bookings, selectedDate, selectedLabId, selectedTimeSlot])

  const canSubmit =
    Boolean(selectedDate) &&
    Boolean(selectedLabId) &&
    Boolean(selectedTimeSlot) &&
    Boolean(purpose.trim()) &&
    availabilityStatus === "available" &&
    !isReadOnlyViewer &&
    !isSubmitting

  const handleSubmit = async () => {
    if (!selectedDate || !selectedLabId || !selectedTimeSlot || !purpose.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          lab_id: selectedLabId,
          booking_date: toLocalDateOnly(selectedDate),
          time_slot: selectedTimeSlot,
          purpose: purpose.trim(),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create booking")
      }

      toast.success("Booking request submitted")
      setSelectedTimeSlot("")
      setPurpose("")
      setSelectedDate(undefined)
      await loadBookings(selectedLabId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create booking")
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelBooking = async (bookingId: string) => {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    })

    const payload = (await response.json()) as { error?: string; success?: boolean }
    if (!response.ok) {
      toast.error(payload.error ?? "Unable to cancel booking request")
      return
    }

    toast.success("Booking request cancelled")
    await loadBookings(selectedLabId)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Book Lab</h1>
        <p className="text-muted-foreground">
          {isReadOnlyViewer
            ? "View the timetable for your selected lab."
            : "Send a lab booking request and track its approval status."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Select Date</CardTitle>
            </div>
            <CardDescription>Choose your preferred booking date</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
              className="mx-auto"
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              {isReadOnlyViewer ? "Lab Timetable" : "Booking Details"}
            </CardTitle>
            <CardDescription>
              {isReadOnlyViewer
                ? "Students can view availability but cannot submit requests."
                : "Pick a real lab, date, and slot before submitting."}
            </CardDescription>
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
              <Label className="text-card-foreground">Time Slot</Label>
              <div className="grid gap-2">
                {timeSlots.map((slot) => {
                  const isConflict =
                    Boolean(selectedDate) &&
                    Boolean(selectedLabId) &&
                    bookings.some(
                      (booking) =>
                        booking.lab_id === selectedLabId &&
                        booking.time_slot === slot.id &&
                        booking.status === "approved" &&
                        booking.booking_date.slice(0, 10) === toLocalDateOnly(selectedDate as Date),
                    )

                  const hasPendingRequest =
                    Boolean(selectedDate) &&
                    Boolean(selectedLabId) &&
                    bookings.some(
                      (booking) =>
                        booking.lab_id === selectedLabId &&
                        booking.time_slot === slot.id &&
                        booking.status === "pending" &&
                        booking.booking_date.slice(0, 10) === toLocalDateOnly(selectedDate as Date),
                    )

                  return (
                    <Button
                      key={slot.id}
                      type="button"
                      variant={selectedTimeSlot === slot.id ? "default" : "outline"}
                      className={cn("justify-start", isConflict && "opacity-50")}
                      disabled={isConflict || !selectedLabId}
                      onClick={() => setSelectedTimeSlot(slot.id)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {slot.time}
                      {isConflict ? (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Booked
                        </Badge>
                      ) : hasPendingRequest ? (
                        <Badge variant="outline" className="ml-auto text-xs">
                          Pending
                        </Badge>
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            </div>

            {!isReadOnlyViewer ? (
              <div className="space-y-2">
                <Label className="text-card-foreground">Purpose</Label>
                <Textarea
                  placeholder="Describe the purpose of your booking..."
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            ) : null}

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                {availabilityStatus === "idle" ? (
                  <>
                    <div className="h-4 w-4 rounded-full bg-muted" />
                    <span className="text-sm text-muted-foreground">Select lab, date, and time slot</span>
                  </>
                ) : null}
                {availabilityStatus === "available" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm text-success">Available - No conflicts found</span>
                  </>
                ) : null}
                {availabilityStatus === "conflict" ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Conflict detected - Try another slot</span>
                  </>
                ) : null}
              </div>
            </div>

            {isReadOnlyViewer ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Timetable only. Booking requests can be submitted by faculty, lab assistants, and lab managers.
              </div>
            ) : (
              <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
                {isSubmitting ? "Submitting..." : "Send Booking Request"}
              </Button>
            )}
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
                ? "Loading bookings..."
                : selectedDate
                  ? `Selected date: ${selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`
                  : "Choose a date to begin"}
            </p>
            {!isLoadingBookings && selectedDate ? (
              <p className="text-sm text-muted-foreground">
                Approved slots are booked. Pending requests remain visible until a lab manager decides.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!isReadOnlyViewer ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Your Requests For This Lab</CardTitle>
            <CardDescription>
              Cancel your pending or approved requests when plans change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ownRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found for the selected lab.</p>
            ) : (
              ownRequests.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div>
                    <p className="font-medium text-card-foreground">
                      {new Date(booking.booking_date).toLocaleDateString()} · {booking.time_slot}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {booking.status}
                    </p>
                  </div>
                  {["pending", "approved"].includes(booking.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cancelBooking(booking.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
