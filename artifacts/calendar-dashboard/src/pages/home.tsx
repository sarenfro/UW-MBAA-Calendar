import { useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Layout } from "@/components/layout";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { UpcomingEvents } from "@/components/upcoming-events";
import { CalendarGrid } from "@/components/calendar-grid";
import { EventDialog } from "@/components/event-dialog";
import { useCalendarFilters } from "@/hooks/use-calendar";
import {
  useListEvents,
  useListUpcomingEvents,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
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
    visibleCalendarIdsString,
  } = useCalendarFilters();

  const { data: upcomingEvents, isLoading: isLoadingUpcoming } =
    useListUpcomingEvents({ limit: 5 });

  const eventsParams = {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
    calendarIds: visibleCalendarIdsString || undefined,
  };

  const { data: events, isLoading: isLoadingEvents } = useListEvents(
    eventsParams,
    {
      query: {
        queryKey: getListEventsQueryKey(eventsParams),
        enabled: visibleCalendarIdsString !== "",
      },
    },
  );

  return (
    <Layout>
      <section className="mb-10 lg:mb-14 max-w-4xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          The Cohort Calendar
        </p>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground">
          One calendar for{" "}
          <em className="italic font-light text-primary">everything</em> the
          MBAA is doing this quarter.
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Class deadlines, club events, recruiting nights, and personal
          commitments — together in one place. Click any event to see the source
          and add it to your own calendar.
        </p>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
        <aside className="lg:col-span-3 space-y-10">
          <CalendarSidebar
            calendars={calendars}
            hiddenCalendarIds={hiddenCalendarIds}
            onToggle={toggleCalendar}
            isLoading={!calendars}
          />

          <div className="hidden lg:block">
            <div className="border-t border-border/60 mb-6" />
            <UpcomingEvents
              events={upcomingEvents}
              isLoading={isLoadingUpcoming}
              onEventClick={setSelectedEvent}
            />
          </div>
        </aside>

        <div className="lg:col-span-9 flex flex-col">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-4">
            Month at a Glance
          </p>
          <div className="flex-1 min-h-[640px]">
            {isLoadingEvents ? (
              <div className="w-full h-full bg-card animate-pulse rounded-sm border border-border/60" />
            ) : (
              <CalendarGrid
                events={events || []}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onEventClick={setSelectedEvent}
              />
            )}
          </div>

          <div className="mt-10 block lg:hidden">
            <UpcomingEvents
              events={upcomingEvents}
              isLoading={isLoadingUpcoming}
              onEventClick={setSelectedEvent}
            />
          </div>
        </div>
      </div>
      <section className="mt-20 lg:mt-28 border-t border-border/60 pt-12">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
          More from the MBAA
        </p>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mb-10 max-w-2xl">
          Other places to{" "}
          <em className="italic font-light text-primary">go</em>
        </h2>

      </section>
      <EventDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </Layout>
  );
}
