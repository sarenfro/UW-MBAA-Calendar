import { useState, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import {
  ArrowLeft,
  Send,
  Copy,
  Check,
  Clock,
  CircleDot,
  CircleCheck,
  ChevronRight,
  TicketSlash,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── types ────────────────────────────────────────────────────────────────────

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketCategory = "general" | "technology" | "event" | "financial" | "other";

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  submitterEmail: string;
  submitterName: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderEmail: string;
  senderName: string;
  isVp: boolean;
  content: string;
  createdAt: string;
}

interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: "General",
  technology: "Technology",
  event: "Event",
  financial: "Financial",
  other: "Other",
};

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  open: {
    label: "Open",
    icon: CircleDot,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  resolved: {
    label: "Resolved",
    icon: CircleCheck,
    className: "text-green-700 bg-green-50 border-green-200",
  },
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, icon: Icon, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
      {children}
    </p>
  );
}

// ─── SubmitForm ───────────────────────────────────────────────────────────────

function SubmitForm({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    submitterName: "",
    submitterEmail: "",
    category: "general" as TicketCategory,
    title: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }
      toast({ title: "Ticket submitted", description: "We'll be in touch soon." });
      onSubmitted(data.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid =
    form.submitterName.trim().length >= 2 &&
    form.submitterEmail.includes("@") &&
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 10;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Your name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Jane Smith"
            value={form.submitterName}
            onChange={set("submitterName")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">
            UW email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="yournetid@uw.edu"
            value={form.submitterEmail}
            onChange={set("submitterEmail")}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={form.category}
          onChange={set("category")}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
        >
          {(Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).map(
            ([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">
          Subject <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Brief summary of your issue"
          value={form.title}
          onChange={set("title")}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Please describe the issue in detail. Include any relevant context, steps to reproduce, or desired outcome."
          value={form.description}
          onChange={set("description")}
          rows={6}
          required
        />
        <p className="text-[11px] text-muted-foreground">
          {form.description.length} / 5000 characters
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={!isValid || isSubmitting}>
        {isSubmitting ? "Submitting…" : "Submit Ticket"}
      </Button>
    </form>
  );
}

// ─── TicketView ───────────────────────────────────────────────────────────────

function TicketView({ ticketId }: { ticketId: string }) {
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TicketWithMessages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadTicket() {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Ticket not found. Please check the link and try again.");
        } else {
          setError("Failed to load ticket.");
        }
        return;
      }
      const data = await res.json();
      setTicket(data);
    } catch {
      setError("Failed to load ticket.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (ticket) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticket?.messages.length]);

  function copyLink() {
    const url = `${window.location.origin}/tickets?id=${ticketId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (!res.ok) {
        toast({ title: "Failed to send reply", variant: "destructive" });
        return;
      }
      setReply("");
      await loadTicket();
    } catch {
      toast({ title: "Failed to send reply", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-2xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl border border-border/60 p-8 text-center space-y-3">
        <TicketSlash className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
        <p className="text-muted-foreground text-sm">{error}</p>
        <Link
          href="/tickets"
          className="text-sm text-primary hover:underline inline-block"
        >
          Submit a new ticket
        </Link>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Ticket header */}
      <div className="border border-border/60 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <SectionLabel>{CATEGORY_LABELS[ticket.category]}</SectionLabel>
            <h2 className="font-serif text-2xl tracking-tight leading-tight">
              {ticket.title}
            </h2>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>
            #{ticket.id.slice(0, 8).toUpperCase()}
          </span>
          <span>·</span>
          <span>Submitted {fmtDate(ticket.createdAt)}</span>
          <span>·</span>
          <span>{ticket.submitterName}</span>
        </div>
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy ticket link"}
        </button>
      </div>

      {/* Conversation */}
      <div className="space-y-3">
        <SectionLabel>Conversation</SectionLabel>
        <div className="space-y-3">
          {ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.isVp ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-sm border px-4 py-3 space-y-1 ${
                  msg.isVp
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border/60"
                }`}
              >
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  {msg.isVp ? "VP of Technology" : msg.senderName}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                {fmtDate(msg.createdAt)}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply box — only if ticket is not resolved */}
      {ticket.status !== "resolved" ? (
        <form onSubmit={handleReply} className="space-y-3">
          <SectionLabel>Add a reply</SectionLabel>
          <Textarea
            placeholder="Type your reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
          />
          <Button
            type="submit"
            disabled={!reply.trim() || isSending}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Sending…" : "Send Reply"}
          </Button>
        </form>
      ) : (
        <div className="border border-border/60 p-4 text-center text-sm text-muted-foreground bg-card">
          This ticket has been resolved. If you have a new issue, please{" "}
          <Link href="/tickets" className="text-primary hover:underline">
            submit a new ticket
          </Link>
          .
        </div>
      )}
    </div>
  );
}

// ─── MyTickets ────────────────────────────────────────────────────────────────

function MyTickets({ email, onSelect }: { email: string; onSelect: (id: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tickets/mine?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        setTickets(Array.isArray(data) ? data : []);
      })
      .catch(() => setTickets([]))
      .finally(() => setIsLoading(false));
  }, [email]);

  if (isLoading) {
    return (
      <div className="space-y-2 max-w-2xl">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded border border-border/40" />
        ))}
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="max-w-2xl border border-dashed border-border/60 p-8 text-center space-y-2">
        <TicketSlash className="h-7 w-7 mx-auto text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">
          No tickets found for{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      <SectionLabel>Tickets for {email}</SectionLabel>
      <div className="border border-border/60 divide-y divide-border/40">
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="group w-full bg-background hover:bg-card transition-colors p-4 flex items-center gap-3 text-left"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={t.status} />
                <span className="text-[10px] text-muted-foreground">
                  {CATEGORY_LABELS[t.category]}
                </span>
              </div>
              <p className="text-sm font-medium truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                #{t.id.slice(0, 8).toUpperCase()} · {fmtDate(t.createdAt)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function Tickets() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const ticketIdParam = params.get("id");
  const emailParam = params.get("email");

  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState(emailParam ?? "");
  const [lookupSubmitted, setLookupSubmitted] = useState(!!emailParam);

  const activeTicketId = ticketIdParam ?? submittedId;

  function handleTicketSelect(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    url.searchParams.delete("email");
    window.history.replaceState({}, "", url.toString());
    setSubmittedId(id);
    setLookupSubmitted(false);
  }

  return (
    <Layout>
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Calendar
        </Link>
      </div>

      <section className="mb-10 max-w-2xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          04 · Support
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-foreground">
          Submit a{" "}
          <em className="italic font-light text-primary">Support Ticket</em>
        </h1>
        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
          Have an issue or question for the VP of Technology? Submit a ticket
          below and we'll get back to you. You can track updates and reply
          directly in this thread.
        </p>
      </section>

      {activeTicketId ? (
        <div className="space-y-6">
          <button
            onClick={() => {
              setSubmittedId(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("id");
              window.history.replaceState({}, "", url.toString());
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            New ticket
          </button>
          <TicketView ticketId={activeTicketId} />
        </div>
      ) : lookupSubmitted && lookupEmail ? (
        <div className="space-y-6">
          <button
            onClick={() => setLookupSubmitted(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <MyTickets email={lookupEmail} onSelect={handleTicketSelect} />
        </div>
      ) : (
        <div className="space-y-10">
          <SubmitForm onSubmitted={handleTicketSelect} />

          <div className="border-t border-border/60 pt-8 max-w-2xl">
            <SectionLabel>Already have a ticket?</SectionLabel>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your UW email to see all tickets you've submitted.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLookupSubmitted(true);
              }}
              className="flex gap-2 max-w-sm"
            >
              <Input
                type="email"
                placeholder="yournetid@uw.edu"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!lookupEmail.includes("@")}
              >
                Look up
              </Button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
