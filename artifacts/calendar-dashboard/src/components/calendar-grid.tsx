import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfDay, endOfDay } from "date-fns";
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

export function CalendarGrid({ events, onEventClick, currentDate, onDateChange }: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => onDateChange(addMonths(currentDate, 1));
  const prevMonth = () => onDateChange(subMonths(currentDate, 1));
  const goToToday = () => onDateChange(new Date());

  const getEventsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return events.filter(event => {
      const eventStart = new Date(event.startAt);
      const eventEnd = new Date(event.endAt);
      
      return eventStart <= dayEnd && eventEnd >= dayStart;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <h2 className="text-2xl font-serif tracking-tight">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-3 font-medium">
            Today
          </Button>
          <div className="flex items-center gap-1 border border-border/60 rounded-md p-0.5">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                "min-h-[120px] p-2 border-r border-b border-border/40 relative group transition-colors hover:bg-muted/10",
                !isCurrentMonth && "bg-muted/5 text-muted-foreground/50",
                dayIdx % 7 === 6 && "border-r-0",
                dayIdx >= days.length - 7 && "border-b-0"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                  isCurrentDay 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : !isCurrentMonth ? "text-muted-foreground/50" : "text-foreground/80"
                )}>
                  {format(day, dateFormat)}
                </span>
              </div>
              
              <div className="space-y-1.5 max-h-[calc(100%-2rem)] overflow-y-auto pr-1 custom-scrollbar">
                {dayEvents.slice(0, 4).map((event) => {
                  const eventStart = new Date(event.startAt);
                  return (
                    <motion.div
                      key={`${event.id}-${day.toString()}`}
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => onEventClick(event)}
                      className="text-xs px-2 py-1 rounded-md truncate cursor-pointer transition-transform hover:scale-[1.02] border-l-2 shadow-2xs"
                      style={{
                        backgroundColor: hexToRgba(event.calendar.color, 0.1),
                        color: event.calendar.color,
                        borderLeftColor: event.calendar.color,
                      }}
                    >
                      <span className="font-semibold mr-1">
                        {event.allDay ? "" : format(eventStart, "HH:mm")}
                      </span>
                      {event.title}
                    </motion.div>
                  )
                })}
                {dayEvents.length > 4 && (
                  <div className="text-xs font-medium text-muted-foreground pl-1">
                    + {dayEvents.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
