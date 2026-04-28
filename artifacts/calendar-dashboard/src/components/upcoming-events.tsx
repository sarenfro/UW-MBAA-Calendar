import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon } from "lucide-react";
import type { Event } from "@workspace/api-client-react";

interface UpcomingEventsProps {
  events: Event[] | undefined;
  isLoading: boolean;
  onEventClick: (event: Event) => void;
}

function SectionEyebrow() {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
        On the Horizon
      </p>
      <h3 className="font-serif text-2xl tracking-tight leading-tight">
        What's <em className="italic font-light text-primary">next</em>
      </h3>
    </div>
  );
}

export function UpcomingEvents({
  events,
  isLoading,
  onEventClick,
}: UpcomingEventsProps) {
  if (isLoading) {
    return (
      <div className="space-y-5">
        <SectionEyebrow />
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="space-y-5">
        <SectionEyebrow />
        <div className="text-center p-6 border border-dashed border-border/60 rounded-sm">
          <CalendarIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionEyebrow />
      <ul className="divide-y divide-border/60 border-y border-border/60">
        {events.map((event, i) => {
          const start = new Date(event.startAt);

          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <button
                onClick={() => onEventClick(event)}
                className="w-full text-left py-3.5 group flex items-start gap-3"
              >
                <div className="flex flex-col items-center justify-center w-12 shrink-0 pt-0.5">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground leading-none">
                    {format(start, "MMM")}
                  </span>
                  <span className="font-serif text-2xl leading-none mt-1 text-foreground">
                    {format(start, "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0 border-l border-border/60 pl-3">
                  <div className="font-medium text-sm text-foreground/90 group-hover:text-primary transition-colors leading-snug">
                    {event.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: event.calendar.color }}
                    />
                    <span>{event.calendar.name}</span>
                    <span className="opacity-40">·</span>
                    <span>
                      {event.allDay ? "All day" : format(start, "h:mm a")}
                    </span>
                  </div>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
