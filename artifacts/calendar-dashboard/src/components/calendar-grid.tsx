import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hexToRgba, cn } from "@/lib/utils";
import type { Event } from "@workspace/api-client-react";
import { motion } from "framer-motion";

interface CalendarGridProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function CalendarGrid({
  events,
  onEventClick,
  currentDate,
  onDateChange,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => onDateChange(addMonths(currentDate, 1));
  const prevMonth = () => onDateChange(subMonths(currentDate, 1));
  const goToToday = () => onDateChange(new Date());

  const getEventsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return events
      .filter((event) => {
        const eventStart = new Date(event.startAt);
        const eventEnd = new Date(event.endAt);
        return eventStart <= dayEnd && eventEnd >= dayStart;
      })
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  };

  const monthName = format(currentDate, "MMMM");
  const yearName = format(currentDate, "yyyy");

  return (
    <div className="flex flex-col h-full bg-card border border-border/60 rounded-sm overflow-hidden">
      <div className="flex items-end justify-between px-7 py-6 border-b border-border/60">
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-none">
          {monthName}{" "}
          <em className="italic font-light text-muted-foreground">
            {yearName}
          </em>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs font-semibold tracking-wider uppercase rounded-sm"
          >
            Today
          </Button>
          <div className="flex items-center border border-border/60 rounded-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="h-8 w-8 rounded-none rounded-l-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-border/60" />
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="h-8 w-8 rounded-none rounded-r-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border/60">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-5 auto-rows-fr">
        {days.map((day, dayIdx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toString()}
              className={cn(
                "min-h-[120px] p-2.5 border-r border-b border-border/60 relative transition-colors hover:bg-muted/30",
                !isCurrentMonth && "bg-muted/20",
                dayIdx % 7 === 6 && "border-r-0",
                dayIdx >= days.length - 7 && "border-b-0",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "font-serif text-base leading-none",
                    isCurrentDay
                      ? "text-primary font-medium"
                      : !isCurrentMonth
                        ? "text-muted-foreground/50"
                        : "text-foreground/80",
                  )}
                >
                  {format(day, "d")}
                </span>
                {isCurrentDay && (
                  <span className="text-[8px] font-semibold tracking-[0.18em] uppercase text-primary">
                    Today
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-[calc(100%-2rem)] overflow-y-auto pr-0.5 custom-scrollbar">
                {dayEvents.map((event) => {
                  const eventStart = new Date(event.startAt);
                  return (
                    <motion.div
                      key={`${event.id}-${day.toString()}`}
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => onEventClick(event)}
                      className="text-[11px] px-1.5 py-1 cursor-pointer transition-colors border-l-2 hover:bg-muted/40 break-words"
                      style={{
                        borderLeftColor: event.calendar.color,
                        backgroundColor: hexToRgba(event.calendar.color, 0.06),
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      <span
                        className="font-semibold mr-1.5"
                        style={{ color: event.calendar.color }}
                      >
                        {event.allDay ? "" : format(eventStart, "h:mma").toLowerCase()}
                      </span>
                      <span className="text-foreground/85">{event.title}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
