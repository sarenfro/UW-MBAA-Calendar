import { CalendarDays, Calendar as CalendarIcon, Hash } from "lucide-react";
import type { DashboardSummary } from "@workspace/api-client-react";

interface DashboardSummaryProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}

export function DashboardSummaryStats({ summary, isLoading }: DashboardSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CalendarIcon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-3xl font-serif tracking-tight leading-none mb-1 text-foreground/90">
            {summary.eventsToday}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Events Today
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center shrink-0">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <div className="text-3xl font-serif tracking-tight leading-none mb-1 text-foreground/90">
            {summary.eventsThisWeek}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            This Week
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-chart-4/10 text-chart-4 flex items-center justify-center shrink-0">
          <Hash className="h-6 w-6" />
        </div>
        <div>
          <div className="text-3xl font-serif tracking-tight leading-none mb-1 text-foreground/90">
            {summary.totalEvents}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Total Events
          </div>
        </div>
      </div>
    </div>
  );
}
