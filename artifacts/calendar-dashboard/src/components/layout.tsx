import { Link } from "wouter";
import { Calendar as CalendarIcon } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <span className="font-serif text-2xl tracking-tight leading-none pt-1">UW MBAA Calendar</span>
          </Link>
          <div className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Unified Calendar
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>A beautiful, unified inbox for all your calendars.</p>
      </footer>
    </div>
  );
}
