import Link from "next/link"
import { FlaskConical } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FlaskConical className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-sidebar-foreground">ChemTrack</span>
          </Link>
        </div>
        
        <div className="space-y-6">
          <blockquote className="text-xl text-sidebar-foreground/90 leading-relaxed">
            &ldquo;ChemTrack has transformed how we manage our lab inventory. The smart search saves hours of time, and the booking system eliminated scheduling conflicts completely.&rdquo;
          </blockquote>
          <div>
            <p className="font-semibold text-sidebar-foreground">Dr. Sarah Chen</p>
            <p className="text-sm text-sidebar-foreground/70">Chemistry Department Head, Stanford University</p>
          </div>
        </div>

        <div className="flex items-center gap-8 text-sm text-sidebar-foreground/50">
          <span>Trusted by 500+ Labs</span>
          <span>25,000+ Chemicals Tracked</span>
          <span>99.9% Uptime</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
