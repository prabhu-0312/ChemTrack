import { redirect } from "next/navigation"

import { requirePageAuth } from "@/lib/auth"

export default async function DashboardPage() {
  const auth = await requirePageAuth()

  if (auth.profile.role === "lab_manager" || auth.profile.role === "lab_assistant") {
    redirect("/dashboard/inventory")
  }

  if (auth.profile.role === "faculty") {
    redirect("/dashboard/booking")
  }

  redirect("/dashboard/search")
}
