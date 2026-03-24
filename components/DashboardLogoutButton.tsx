"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { logoutAndRedirect } from "@/lib/client-logout"

export function DashboardLogoutButton() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void logoutAndRedirect(router)
      }}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  )
}
