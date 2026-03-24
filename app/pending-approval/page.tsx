"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { logoutAndRedirect } from "@/lib/client-logout"

export default function PendingApprovalPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await logoutAndRedirect(router)
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <Card className="w-full border-border">
        <CardHeader>
          <CardTitle>Approval Pending</CardTitle>
          <CardDescription>
            Your account is awaiting Lab Manager approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You will be able to access the dashboard once your request is approved.
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={handleLogout}>Logout</Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
