import { Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Calendar } from "@workspace/api-client-react";

interface CalendarSidebarProps {
  calendars: Calendar[] | undefined;
  hiddenCalendarIds: Set<number>;
  onToggle: (id: number) => void;
  isLoading: boolean;
}

export function CalendarSidebar({
  calendars,
  hiddenCalendarIds,
  onToggle,
  isLoading,
}: CalendarSidebarProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!calendars?.length) {
    return (
      <div className="space-y-4">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          Sources
        </p>
        <div className="text-center p-6 border border-dashed border-border/60 rounded-sm">
          <Layers className="h-6 w-6 mx-auto text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No calendars found.</p>
        </div>
      </div>
    );
  }

  const allHidden = calendars.every((c) => hiddenCalendarIds.has(c.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          Sources
        </p>
        {allHidden && (
          <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            All hidden
          </span>
        )}
      </div>

      <h3 className="font-serif text-2xl tracking-tight leading-tight">
        Filter by{" "}
        <em className="italic font-light text-primary">calendar</em>
      </h3>

      <div className="space-y-0.5 pt-1">
        {calendars.map((calendar) => {
          const isHidden = hiddenCalendarIds.has(calendar.id);
          return (
            <button
              key={calendar.id}
              onClick={() => onToggle(calendar.id)}
              className="w-full flex items-center gap-3 py-1.5 group text-left"
            >
              <div
                className="w-3.5 h-3.5 rounded-full flex-shrink-0 border transition-colors flex items-center justify-center"
                style={{
                  borderColor: calendar.color,
                  backgroundColor: isHidden ? "transparent" : calendar.color,
                }}
              >
                {!isHidden && (
                  <Check
                    className="w-2 h-2 text-white"
                    strokeWidth={4}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors group-hover:text-primary",
                  isHidden
                    ? "text-muted-foreground line-through decoration-1"
                    : "text-foreground",
                )}
              >
                {calendar.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
