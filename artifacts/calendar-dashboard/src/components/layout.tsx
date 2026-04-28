import { Link } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/15 text-foreground">
      <header className="border-b border-border/60 bg-background">
        <div className="container mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <span className="font-serif text-lg leading-none">W</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                UW Foster
              </span>
              <span className="font-serif text-xl tracking-tight pt-0.5">
                MBAA <em className="italic font-light">Calendar</em>
              </span>
            </div>
          </Link>
          <div className="hidden sm:block text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Spring Quarter · 2026
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 lg:px-10 py-10 lg:py-14">
        {children}
      </main>
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
            UW Foster MBAA · Built for the cohort
          </p>
          <p className="font-serif italic text-sm text-muted-foreground">
            Everything in one place.
          </p>
        </div>
      </footer>
    </div>
  );
}
