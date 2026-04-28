import { useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Layout } from "@/components/layout";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { UpcomingEvents } from "@/components/upcoming-events";
import { CalendarGrid } from "@/components/calendar-grid";
import { EventDialog } from "@/components/event-dialog";
import { useCalendarFilters } from "@/hooks/use-calendar";
import { useListEvents, useListUpcomingEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  const { 
    calendars, 
    hiddenCalendarIds, 
    toggleCalendar, 
    visibleCalendarIdsString 
  } = useCalendarFilters();

  const { data: upcomingEvents, isLoading: isLoadingUpcoming } = useListUpcomingEvents({ limit: 5 });
  
  const eventsParams = {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
    calendarIds: visibleCalendarIdsString || undefined,
  };

  const { data: events, isLoading: isLoadingEvents } = useListEvents(eventsParams, {
    query: {
      queryKey: getListEventsQueryKey(eventsParams),
      enabled: visibleCalendarIdsString !== "", // only load if there are visible calendars
    }
  });

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 space-y-8">
          <CalendarSidebar 
            calendars={calendars} 
            hiddenCalendarIds={hiddenCalendarIds} 
            onToggle={toggleCalendar}
            isLoading={!calendars}
          />
          
          <div className="hidden lg:block border-t border-border/40 pt-8">
            <UpcomingEvents 
              events={upcomingEvents} 
              isLoading={isLoadingUpcoming} 
              onEventClick={setSelectedEvent} 
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9 flex flex-col h-[calc(100vh-8rem)]">
          <div className="flex-1 min-h-[600px]">
            {isLoadingEvents ? (
              <div className="w-full h-full bg-card animate-pulse rounded-2xl border border-border/40" />
            ) : (
              <CalendarGrid 
                events={events || []} 
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onEventClick={setSelectedEvent}
              />
            )}
          </div>
          
          {/* Mobile Upcoming Events */}
          <div className="mt-8 block lg:hidden">
            <UpcomingEvents 
              events={upcomingEvents} 
              isLoading={isLoadingUpcoming} 
              onEventClick={setSelectedEvent} 
            />
          </div>
        </div>
      </div>

      <EventDialog 
        event={selectedEvent} 
        open={!!selectedEvent} 
        onOpenChange={(open) => !open && setSelectedEvent(null)} 
      />
    </Layout>
  );
}
