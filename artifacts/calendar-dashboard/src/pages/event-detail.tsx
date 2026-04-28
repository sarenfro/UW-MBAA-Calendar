import { useRoute } from "wouter";
import { format } from "date-fns";
import { Download, MapPin, Clock, Calendar as CalendarIcon, User, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hexToRgba } from "@/lib/utils";
import { useGetEvent, getGetEventQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function EventDetail() {
  const [, params] = useRoute("/event/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: event, isLoading, error } = useGetEvent(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventQueryKey(eventId)
    }
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
    } catch (error) {
      console.error("Failed to download ICS", error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto mt-8">
          <Skeleton className="h-10 w-24 mb-8" />
          <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
            <Skeleton className="h-4 w-full" />
            <div className="p-8 md:p-12 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="pt-8 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !event) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto mt-12 text-center">
          <h2 className="text-2xl font-serif mb-4 text-foreground/80">Event not found</h2>
          <Button asChild variant="outline">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto mt-4 mb-16">
        <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calendar
          </Link>
        </Button>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div 
            className="h-3 w-full" 
            style={{ backgroundColor: event.calendar.color }} 
          />
          
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
              <div className="space-y-4">
                <Badge 
                  variant="outline" 
                  className="font-medium px-3 py-1 text-sm border-2 shadow-2xs"
                  style={{ 
                    backgroundColor: hexToRgba(event.calendar.color, 0.05),
                    color: event.calendar.color,
                    borderColor: hexToRgba(event.calendar.color, 0.15)
                  }}
                >
                  {event.calendar.name}
                </Badge>
                
                <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-foreground leading-tight">
                  {event.title}
                </h1>
              </div>

              <Button 
                onClick={handleDownloadIcs} 
                size="lg"
                className="shrink-0 font-medium shadow-sm transition-all hover:shadow-md"
              >
                <Download className="mr-2 h-5 w-5" />
                Download .ics
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 bg-muted/20 p-6 rounded-2xl border border-border/40">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-background border border-border/60 shadow-sm flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Time</h3>
                  <div className="text-muted-foreground text-sm">
                    <p className="font-medium mb-0.5">{format(start, "EEEE, MMMM d, yyyy")}</p>
                    <p>{event.allDay ? "All Day" : `${format(start, "h:mm a")} to ${format(end, "h:mm a")}`}</p>
                  </div>
                </div>
              </div>

              {event.location && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-background border border-border/60 shadow-sm flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Location</h3>
                    <div className="text-muted-foreground text-sm">
                      <p>{event.location}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mb-12">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Description</h3>
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/80 leading-relaxed bg-background/50 p-6 rounded-xl border border-border/30">
                  <p className="whitespace-pre-wrap">{event.description}</p>
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Calendar Source</h3>
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: hexToRgba(event.calendar.color, 0.1), color: event.calendar.color }}
                    >
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{event.calendar.owner}</p>
                      <p className="text-xs text-muted-foreground">{event.calendar.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
