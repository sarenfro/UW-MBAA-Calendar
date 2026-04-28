import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Clock, ArrowRight } from "lucide-react";
import type { Event } from "@workspace/api-client-react";
import { hexToRgba } from "@/lib/utils";

interface UpcomingEventsProps {
  events: Event[] | undefined;
  isLoading: boolean;
  onEventClick: (event: Event) => void;
}

export function UpcomingEvents({ events, isLoading, onEventClick }: UpcomingEventsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-serif text-xl tracking-tight text-foreground/90">Upcoming</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="space-y-4">
        <h3 className="font-serif text-xl tracking-tight text-foreground/90">Upcoming</h3>
        <div className="text-center p-8 bg-muted/20 rounded-xl border border-border border-dashed">
          <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl tracking-tight text-foreground/90">Upcoming</h3>
      <div className="space-y-3">
        {events.map((event, i) => {
          const start = new Date(event.startAt);
          
          return (
            <motion.button
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onEventClick(event)}
              className="w-full text-left group flex items-stretch bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-border/80"
            >
              <div 
                className="w-1.5 shrink-0 transition-colors group-hover:bg-opacity-80" 
                style={{ backgroundColor: event.calendar.color }} 
              />
              <div className="p-3.5 flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="font-medium text-sm truncate text-foreground/90 group-hover:text-foreground transition-colors">
                    {event.title}
                  </div>
                  <div 
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ 
                      backgroundColor: hexToRgba(event.calendar.color, 0.1),
                      color: event.calendar.color
                    }}
                  >
                    {format(start, "MMM d")}
                  </div>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1.5 opacity-70" />
                  {event.allDay ? "All Day" : format(start, "h:mm a")}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
