import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function RejectedPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <Card className="w-full border-border">
        <CardHeader>
          <CardTitle>Request Rejected</CardTitle>
          <CardDescription>
            Your account request was rejected by the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Contact your Lab Manager if you believe this is an error.
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
