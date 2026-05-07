import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Send,
  CircleDot,
  Clock,
  CircleCheck,
  ChevronLeft,
  X,
  Shield,
  ShieldOff,
  TicketSlash,
  RefreshCw,
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

const STATUS_ORDER: TicketStatus[] = ["open", "in_progress", "resolved"];

const NEXT_STATUS: Record<TicketStatus, TicketStatus> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "open",
};

const NEXT_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Mark In Progress",
  in_progress: "Mark Resolved",
  resolved: "Re-open",
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

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

// ─── session helpers (shared with documents) ──────────────────────────────────

const SESSION_KEY = "mbaa_exec_session";

function getExecSession(): { token: string; email: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveExecSession(token: string, email: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, email }));
}

function clearExecSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── ExecLoginModal ───────────────────────────────────────────────────────────

function ExecLoginModal({
  onClose,
  onLoggedIn,
}: {
  onClose: () => void;
  onLoggedIn: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "sent">("email");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    try {
      const res = await fetch("/api/documents/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      if (data.magicLink) {
        const url = new URL(data.magicLink);
        const token = url.searchParams.get("execToken");
        if (token) {
          const verifyRes = await fetch("/api/documents/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.ok) {
            saveExecSession(token, verifyData.email);
            onLoggedIn(token, verifyData.email);
            toast({ title: "Exec access granted", description: verifyData.email });
            onClose();
            return;
          }
        }
      }
      setPhase("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel>VP Access Required</SectionLabel>
            <h2 className="font-serif text-2xl tracking-tight">
              Sign <em className="italic font-light text-primary">in</em>
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "email" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exec-email">UW Email</Label>
              <Input
                id="exec-email"
                type="email"
                placeholder="yournetid@uw.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only authorized executive team members can access this dashboard.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={!email || isSending} className="w-full">
              {isSending ? "Sending…" : "Send Access Link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              If{" "}
              <span className="font-medium text-foreground">{email}</span> is
              authorized, you'll receive an access link in your inbox. Click it
              to return here.
            </p>
            <button
              onClick={() => setPhase("email")}
              className="text-xs text-primary hover:underline"
            >
              Try a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TicketDetail ─────────────────────────────────────────────────────────────

function TicketDetail({
  ticketId,
  execToken,
  onBack,
  onStatusChange,
}: {
  ticketId: string;
  execToken: string;
  onBack: () => void;
  onStatusChange: (id: string, status: TicketStatus) => void;
}) {
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TicketWithMessages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadTicket() {
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (!res.ok) return;
    const data = await res.json();
    setTicket(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (ticket) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticket?.messages.length]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-exec-token": execToken,
        },
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

  async function handleStatusChange() {
    if (!ticket) return;
    const nextStatus = NEXT_STATUS[ticket.status];
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-exec-token": execToken,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        toast({ title: "Failed to update status", variant: "destructive" });
        return;
      }
      const updated = await res.json();
      setTicket((prev) => prev ? { ...prev, status: updated.status } : prev);
      onStatusChange(ticket.id, updated.status);
      toast({ title: `Ticket status updated to ${STATUS_CONFIG[updated.status as TicketStatus].label}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-32 w-full bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft className="h-3 w-3" />
        All tickets
      </button>

      {/* Header */}
      <div className="border border-border/60 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <SectionLabel>{CATEGORY_LABELS[ticket.category]}</SectionLabel>
            <h2 className="font-serif text-2xl tracking-tight leading-tight">
              {ticket.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <StatusBadge status={ticket.status} />
            <Button
              size="sm"
              variant="outline"
              onClick={handleStatusChange}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              {isUpdatingStatus ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : null}
              {NEXT_STATUS_LABEL[ticket.status]}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-border/40 pt-3">
          <div>
            <p className="text-muted-foreground mb-0.5">From</p>
            <p className="font-medium">{ticket.submitterName}</p>
            <p className="text-muted-foreground">{ticket.submitterEmail}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Submitted</p>
            <p className="font-medium">{fmtDate(ticket.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Ticket ID</p>
            <p className="font-mono font-medium">#{ticket.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
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
                  {msg.isVp ? "VP of Technology (you)" : msg.senderName}
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

      {/* Reply */}
      <form onSubmit={handleReply} className="space-y-3">
        <SectionLabel>Reply as VP of Technology</SectionLabel>
        <Textarea
          placeholder="Type your response to the student…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
        />
        <p className="text-[11px] text-muted-foreground">
          Your reply will be emailed to {ticket.submitterEmail}
        </p>
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
    </div>
  );
}

// ─── TicketList ───────────────────────────────────────────────────────────────

function TicketList({
  tickets,
  activeFilter,
  onFilterChange,
  onSelect,
}: {
  tickets: Ticket[];
  activeFilter: TicketStatus | "all";
  onFilterChange: (f: TicketStatus | "all") => void;
  onSelect: (id: string) => void;
}) {
  const filters: (TicketStatus | "all")[] = ["all", ...STATUS_ORDER];

  const filterLabels: Record<TicketStatus | "all", string> = {
    all: "All",
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
  };

  const filtered =
    activeFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === activeFilter);

  const counts: Record<TicketStatus | "all", number> = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border border-border/60 p-1 rounded-sm w-fit">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 text-xs font-semibold tracking-wide rounded-sm transition-colors ${
              activeFilter === f
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filterLabels[f]}
            <span
              className={`ml-1.5 text-[10px] ${
                activeFilter === f ? "opacity-70" : "opacity-50"
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border/60 p-10 text-center space-y-2">
          <TicketSlash className="h-7 w-7 mx-auto text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No tickets in this category.</p>
        </div>
      ) : (
        <div className="border border-border/60 divide-y divide-border/40">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="group w-full bg-background hover:bg-card transition-colors p-4 flex items-start gap-4 text-left"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={t.status} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    {CATEGORY_LABELS[t.category]}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{t.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t.submitterName}</span>
                  <span>·</span>
                  <span>{t.submitterEmail}</span>
                  <span>·</span>
                  <span>{fmtRelative(t.updatedAt)}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 pt-0.5">
                #{t.id.slice(0, 8).toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function TicketsDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [execSession, setExecSession] = useState<{
    token: string;
    email: string;
  } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TicketStatus | "all">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Restore exec session on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("execToken");

    if (tokenFromUrl) {
      fetch("/api/documents/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            saveExecSession(tokenFromUrl, data.email);
            setExecSession({ token: tokenFromUrl, email: data.email });
          }
        })
        .catch(() => {})
        .finally(() => {
          navigate("/tickets/dashboard", {
            replace: true,
          } as Parameters<typeof navigate>[1]);
        });
    } else {
      const session = getExecSession();
      if (session) {
        setExecSession(session);
      } else {
        setShowLogin(true);
      }
    }
  }, []);

  // Load tickets when session is available
  useEffect(() => {
    if (!execSession) return;
    loadTickets();
  }, [execSession]);

  async function loadTickets() {
    if (!execSession) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        headers: { "x-exec-token": execSession.token },
      });
      if (res.status === 401) {
        clearExecSession();
        setExecSession(null);
        setShowLogin(true);
        return;
      }
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load tickets", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  function handleStatusChange(id: string, status: TicketStatus) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)),
    );
  }

  const openCount = tickets.filter((t) => t.status === "open").length;

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

      <section className="mb-8 max-w-4xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          VP Dashboard
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-foreground">
            Support{" "}
            <em className="italic font-light text-primary">Tickets</em>
            {openCount > 0 && (
              <span className="ml-3 text-base font-sans font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full align-middle">
                {openCount} open
              </span>
            )}
          </h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            {execSession ? (
              <>
                <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                  <Shield className="h-3 w-3" />
                  {execSession.email}
                </div>
                <button
                  onClick={() => {
                    clearExecSession();
                    setExecSession(null);
                    setTickets([]);
                    toast({ title: "Signed out" });
                    setShowLogin(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </button>
                <button
                  onClick={loadTickets}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                VP Login
              </button>
            )}
          </div>
        </div>
      </section>

      {execSession ? (
        selectedTicketId ? (
          <div className="max-w-2xl">
            <TicketDetail
              ticketId={selectedTicketId}
              execToken={execSession.token}
              onBack={() => setSelectedTicketId(null)}
              onStatusChange={handleStatusChange}
            />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 max-w-4xl">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-muted animate-pulse rounded border border-border/40"
              />
            ))}
          </div>
        ) : (
          <div className="max-w-4xl">
            <TicketList
              tickets={tickets}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onSelect={setSelectedTicketId}
            />
          </div>
        )
      ) : (
        <div className="max-w-md border border-dashed border-border/60 p-10 text-center space-y-3">
          <ShieldOff className="h-8 w-8 mx-auto text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            This dashboard is restricted to the VP of Technology.
          </p>
          <Button onClick={() => setShowLogin(true)} size="sm">
            Sign In
          </Button>
        </div>
      )}

      {showLogin && (
        <ExecLoginModal
          onClose={() => setShowLogin(false)}
          onLoggedIn={(token, email) => {
            setExecSession({ token, email });
            setShowLogin(false);
          }}
        />
      )}
    </Layout>
  );
}
