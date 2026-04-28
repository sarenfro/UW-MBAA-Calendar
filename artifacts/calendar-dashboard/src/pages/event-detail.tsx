import { useRoute } from "wouter";
import { format } from "date-fns";
import { Download, MapPin, Clock, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetEvent, getGetEventQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function EventDetail() {
  const [, params] = useRoute("/event/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: event, isLoading, error } = useGetEvent(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventQueryKey(eventId),
    },
  });

  const handleDownloadIcs = async () => {
    if (!event) return;
    try {
      const res = await fetch(`/api/events/${event.id}/ics`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download ICS", err);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32 mb-10" />
          <Skeleton className="h-3 w-24 mb-4" />
          <Skeleton className="h-14 w-3/4 mb-3" />
          <Skeleton className="h-14 w-2/3 mb-10" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !event) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto mt-12 text-center">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
            Not Found
          </p>
          <h2 className="font-serif text-3xl mb-6">
            We couldn't find that <em className="italic font-light">event</em>.
          </h2>
          <Button asChild variant="outline" className="rounded-sm">
            <Link href="/">Back to calendar</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          asChild
          className="mb-10 -ml-3 text-muted-foreground hover:text-primary text-xs font-semibold tracking-[0.18em] uppercase"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back to Calendar
          </Link>
        </Button>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: event.calendar.color }}
            />
            <p
              className="text-[10px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: event.calendar.color }}
            >
              {event.calendar.name} · {event.calendar.owner}
            </p>
          </div>

          <h1 className="font-serif text-4xl md:text-6xl tracking-tight leading-[1.05] text-foreground">
            {event.title}
          </h1>
        </div>

        <div className="border-t border-b border-border/60 py-8 grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              When
            </p>
            <p className="font-serif text-xl text-foreground leading-tight">
              {format(start, "EEEE, MMMM d")}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              {event.allDay
                ? "All day"
                : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`}
            </p>
          </div>

          {event.location && (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Where
              </p>
              <p className="font-serif text-xl text-foreground leading-tight">
                {event.location}
              </p>
            </div>
          )}
        </div>

        {event.description && (
          <div className="mb-14">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-4">
              Details
            </p>
            <p className="text-base md:text-lg text-foreground/85 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-1">
              Take it with you
            </p>
            <p className="font-serif text-lg italic font-light text-foreground/80">
              Add this to any calendar app.
            </p>
          </div>
          <Button
            onClick={handleDownloadIcs}
            size="lg"
            className="rounded-sm font-semibold tracking-wider uppercase text-xs h-11 px-6"
          >
            <Download className="mr-2 h-4 w-4" />
            Download .ics
          </Button>
        </div>
      </div>
    </Layout>
  );
}
