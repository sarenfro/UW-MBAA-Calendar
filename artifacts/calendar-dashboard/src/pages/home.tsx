import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
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

  const { data: upcomingEventsRaw, isLoading: isLoadingUpcoming } =
    useListUpcomingEvents({ limit: 15 });

  const upcomingEvents = upcomingEventsRaw
    ?.filter((e) => !hiddenCalendarIds.has(e.calendar.id))
    .filter((e) => e.calendar.name !== "UW Foster Undergraduate Events")
    .slice(0, 5);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/60 border border-border/60">
          <Link
            href="/membership"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              01 · Roster
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              MBAA <em className="italic font-light">Membership</em> Records
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>find out what clubs you registered for</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
          <Link
            href="/directory"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              02 · Directory
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              Student <em className="italic font-light">Directory</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>browse and connect with your cohort</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
          <Link
            href="/documents"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              03 · Resources
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              Document <em className="italic font-light">Library</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>files and resources shared by the executive team</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
          <Link
            href="/tickets"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              04 · Support
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              Submit a <em className="italic font-light">Ticket</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>escalate issues to the VP of Technology</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
          <a
            href="https://mbaschedulestudio.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              05 · Planning
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              Elective <em className="italic font-light">Schedule Studio</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>plan your elective schedule interactively</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </a>
          <a
            href="https://vote-booth.replit.app/voting-booth/"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              06 · Voting
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              MBAA <em className="italic font-light">Voting Booth</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>cast your vote on MBAA decisions</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </a>
          <Link
            href="/student-leader"
            className="group bg-background hover:bg-card transition-colors p-5 flex flex-col gap-2 min-h-[90px]"
          >
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              07 · Recognition
            </p>
            <h3 className="font-serif text-2xl tracking-tight leading-tight flex-1">
              Student Leader <em className="italic font-light">of the Quarter</em>
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary transition-colors">
              <span>celebrating outstanding MBAA leadership</span>
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <ShieldAlert className="h-3 w-3" />
            Exec Admin
          </Link>
        </div>
      </section>
      <EventDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </Layout>
  );
}
