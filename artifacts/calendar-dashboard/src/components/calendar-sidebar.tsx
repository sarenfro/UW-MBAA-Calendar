import { Calendar as CalendarIcon, Check, Layers } from "lucide-react";
import { cn, hexToRgba } from "@/lib/utils";
import type { Calendar } from "@workspace/api-client-react";
import { Button } from "./ui/button";

interface CalendarSidebarProps {
  calendars: Calendar[] | undefined;
  hiddenCalendarIds: Set<number>;
  onToggle: (id: number) => void;
  isLoading: boolean;
}

export function CalendarSidebar({ calendars, hiddenCalendarIds, onToggle, isLoading }: CalendarSidebarProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!calendars?.length) {
    return (
      <div className="text-center p-6 bg-muted/20 rounded-xl border border-border border-dashed">
        <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">No calendars found.</p>
      </div>
    );
  }

  const allHidden = calendars.every(c => hiddenCalendarIds.has(c.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Calendars</h3>
        {allHidden && (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            All hidden
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        {calendars.map((calendar) => {
          const isHidden = hiddenCalendarIds.has(calendar.id);
          return (
            <button
              key={calendar.id}
              onClick={() => onToggle(calendar.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left",
                "hover:bg-muted/60"
              )}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 border transition-colors flex items-center justify-center"
                style={{
                  borderColor: calendar.color,
                  backgroundColor: isHidden ? "transparent" : calendar.color,
                }}
              >
                {!isHidden && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
              </div>
              <span
                className={cn(
                  "text-sm truncate transition-colors",
                  isHidden ? "text-muted-foreground line-through decoration-1" : "text-foreground"
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
