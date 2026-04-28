import { format } from "date-fns";
import { Download, ExternalLink, MapPin, Clock, Calendar as CalendarIcon, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hexToRgba } from "@/lib/utils";
import type { Event } from "@workspace/api-client-react";
import { Link } from "wouter";

interface EventDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDialog({ event, open, onOpenChange }: EventDialogProps) {
  if (!event) return null;

  const handleDownloadIcs = async () => {
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

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 border-0 shadow-2xl">
        <div 
          className="h-2 w-full" 
          style={{ backgroundColor: event.calendar.color }} 
        />
        <div className="p-6">
          <DialogHeader className="mb-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl font-serif tracking-tight leading-tight">
                {event.title}
              </DialogTitle>
              <Badge 
                variant="outline" 
                className="shrink-0 font-medium"
                style={{ 
                  backgroundColor: hexToRgba(event.calendar.color, 0.1),
                  color: event.calendar.color,
                  borderColor: hexToRgba(event.calendar.color, 0.2)
                }}
              >
                {event.calendar.name}
              </Badge>
            </div>
            
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="font-medium text-foreground">
                  {format(start, "EEEE, MMMM d, yyyy")}
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span>
                  {event.allDay 
                    ? "All Day" 
                    : `${format(start, "h:mm a")} — ${format(end, "h:mm a")}`}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </DialogHeader>

          {event.description && (
            <div className="mb-8 text-sm leading-relaxed text-foreground/80">
              <p>{event.description}</p>
            </div>
          )}

          <div className="flex items-center gap-4 py-4 border-y border-border/40 mb-6 bg-muted/30 -mx-6 px-6">
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: hexToRgba(event.calendar.color, 0.1), color: event.calendar.color }}
            >
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium leading-none mb-1">Source Calendar</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{event.calendar.owner}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleDownloadIcs} className="flex-1 gap-2 shadow-sm font-medium">
              <Download className="h-4 w-4" />
              Download .ics
            </Button>
            <Button variant="outline" asChild className="flex-1 gap-2 shadow-sm">
              <Link href={`/event/${event.id}`}>
                <ExternalLink className="h-4 w-4" />
                View Details
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
