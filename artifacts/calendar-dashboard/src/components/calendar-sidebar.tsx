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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl tracking-tight text-foreground/90">Calendars</h3>
        {allHidden && (
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            All hidden
          </span>
        )}
      </div>
      
      <div className="space-y-2">
        {calendars.map((calendar) => {
          const isHidden = hiddenCalendarIds.has(calendar.id);
          const bgRgba = hexToRgba(calendar.color, 0.1);
          
          return (
            <button
              key={calendar.id}
              onClick={() => onToggle(calendar.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 border",
                isHidden 
                  ? "bg-transparent border-transparent hover:bg-muted/50" 
                  : "bg-card shadow-sm border-border/40 hover:shadow-md hover:border-border/80"
              )}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border-2 transition-colors flex items-center justify-center"
                  style={{ 
                    borderColor: calendar.color,
                    backgroundColor: isHidden ? "transparent" : calendar.color
                  }}
                >
                  {!isHidden && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <div className="text-left truncate">
                  <div className={cn(
                    "text-sm font-medium truncate transition-colors",
                    isHidden ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {calendar.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {calendar.owner}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
