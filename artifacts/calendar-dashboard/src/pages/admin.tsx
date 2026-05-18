import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Trash2, Plus, ShieldAlert, Lock, RefreshCw, Pencil, X, Check, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Shuffle, Award, Camera, RotateCcw } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useListClubs,
  useListClubLeads,
  getListClubLeadsQueryKey,
  useAddClubLead,
  useRemoveClubLead,
  useVerifyAdminPassword,
  useAdminListCalendars,
  getAdminListCalendarsQueryKey,
  useAdminCreateCalendar,
  useAdminUpdateCalendar,
  useAdminDeleteCalendar,
  useAdminListClubs,
  getAdminListClubsQueryKey,
  useAdminCreateClub,
  useAdminUpdateClub,
  useAdminDeleteClub,
  useAdminReorderClubs,
  useGetStudentLeaderCurrent,
  getGetStudentLeaderCurrentQueryKey,
  useAdminUpdateStudentLeader,
  useAdminAdvanceStudentLeaderQuarter,
  type AdminCalendar,
  type AdminClub,
  type StudentLeaderEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "mbaa_admin_unlocked";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
      {children}
    </p>
  );
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const verify = useVerifyAdminPassword({
    mutation: {
      onSuccess: (data) => {
        if (data.ok) {
          sessionStorage.setItem(SESSION_KEY, "1");
          onUnlock(password);
        } else {
          setError("Incorrect password.");
        }
      },
      onError: () => {
        setError("Incorrect password.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) return;
    verify.mutate({ data: { password } });
  }

  return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 border border-border/60 mb-2">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
              Admin Access
            </p>
            <h1 className="font-serif text-3xl tracking-tight text-foreground">
              Club Lead{" "}
              <em className="italic font-light text-primary">Management</em>
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the admin password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Password
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                autoFocus
                className="h-10 rounded-sm border-border/60"
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={verify.isPending || !password}
              className="w-full rounded-sm text-xs font-semibold tracking-[0.14em] uppercase h-10"
            >
              {verify.isPending ? "Checking…" : "Enter"}
            </Button>
          </form>

          <div className="text-center">
            <Button variant="ghost" asChild className="text-xs text-muted-foreground tracking-wider uppercase">
              <Link href="/membership">← Back to Membership</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Club management ──────────────────────────────────────────────────────────

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const EXCLUDED_CLUB_CALENDAR_NAMES = [
  "UW Foster MBAA",
  "Career Management",
];

type ClubFormState = {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  calendarId: number | null;
};

const EMPTY_CLUB_FORM: ClubFormState = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
  calendarId: null,
};

function ClubRow({
  club,
  password,
  calendars,
  onDeleted,
  onUpdated,
}: {
  club: AdminClub;
  password: string;
  calendars: AdminCalendar[];
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<ClubFormState>({
    name: club.name,
    slug: club.slug,
    description: club.description ?? "",
    isActive: club.isActive,
    calendarId: club.calendarId ?? null,
  });
  const availableCalendars = calendars.filter(
    (c) => !EXCLUDED_CLUB_CALENDAR_NAMES.includes(c.name),
  );
  const { toast } = useToast();

  const updateMutation = useAdminUpdateClub({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        onUpdated();
        toast({ title: "Club updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const deleteMutation = useAdminDeleteClub({
    mutation: {
      onSuccess: () => {
        onDeleted();
        toast({ title: "Club deleted", description: `"${club.name}" has been removed.` });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  function handleSave() {
    updateMutation.mutate({
      id: club.id,
      data: {
        password,
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        isActive: form.isActive,
        calendarId: form.calendarId ?? undefined,
      },
    });
  }

  function handleDelete() {
    deleteMutation.mutate({ id: club.id, data: { password } });
  }

  return (
    <>
      <TableRow className="border-b border-border/40 last:border-0 hover:bg-muted/20 align-top">
        <TableCell className="py-3 w-4">
          <span
            className={`inline-block w-2 h-2 rounded-full mt-1 ${form.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
        </TableCell>
        <TableCell className="py-3 font-medium text-sm min-w-[160px]">
          {editing ? (
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: toSlug(name) }));
              }}
              className="h-7 text-sm rounded-sm border-border/60 px-2"
            />
          ) : (
            <span>{club.name}</span>
          )}
        </TableCell>
        <TableCell className="py-3 text-sm text-muted-foreground font-mono hidden md:table-cell">
          {editing ? (
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              className="h-7 text-sm rounded-sm border-border/60 px-2 font-mono"
            />
          ) : (
            <span>{club.slug}</span>
          )}
        </TableCell>
        <TableCell className="py-3 hidden lg:table-cell">
          {editing ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground">{form.isActive ? "Active" : "Inactive"}</span>
            </div>
          ) : (
            <span className={`text-xs font-medium ${club.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
              {club.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </TableCell>
        <TableCell className="py-3 hidden xl:table-cell">
          {(() => {
            const linked = availableCalendars.find((c) => c.id === club.calendarId);
            return linked ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: linked.color }} />
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{linked.name}</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/40">—</span>
            );
          })()}
        </TableCell>
        <TableCell className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setEditing(false);
                    setForm({ name: club.name, slug: club.slug, description: club.description ?? "", isActive: club.isActive, calendarId: club.calendarId ?? null });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {editing && (
        <TableRow className="bg-muted/10 border-b border-border/40">
          <TableCell />
          <TableCell colSpan={5} className="py-3">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description…"
                  className="h-7 text-sm rounded-sm border-border/60 px-2"
                />
              </div>
              <div className="space-y-1.5 min-w-[200px]">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Linked Calendar
                </Label>
                <Select
                  value={form.calendarId !== null ? String(form.calendarId) : "__none__"}
                  onValueChange={(v) => setForm((f) => ({ ...f, calendarId: v === "__none__" ? null : Number(v) }))}
                >
                  <SelectTrigger className="h-7 text-sm rounded-sm border-border/60 w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="__none__">None</SelectItem>
                    {availableCalendars.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{club.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the club and all its membership records and lead assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ClubManagementPanel({ password }: { password: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ClubFormState>(EMPTY_CLUB_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  const calQk = getAdminListCalendarsQueryKey({ password });
  const { data: allCalendars } = useAdminListCalendars(
    { password },
    { query: { queryKey: calQk } },
  );
  const availableCalendars = (allCalendars ?? []).filter(
    (c) => !EXCLUDED_CLUB_CALENDAR_NAMES.includes(c.name),
  );

  const queryKey = getAdminListClubsQueryKey({ password });
  const { data: clubs, isLoading } = useAdminListClubs(
    { password },
    { query: { queryKey } },
  );

  const reorderMutation = useAdminReorderClubs();

  const createMutation = useAdminCreateClub({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        setShowAddForm(false);
        setForm(EMPTY_CLUB_FORM);
        setAddError(null);
        toast({ title: "Club added" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setAddError(msg ?? "Failed to add club.");
      },
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!form.name.trim()) { setAddError("Name is required."); return; }
    if (!form.slug.trim()) { setAddError("Slug is required."); return; }
    createMutation.mutate({
      data: {
        password,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description || undefined,
        isActive: form.isActive,
        calendarId: form.calendarId ?? undefined,
      },
    });
  }

  function handleSortChange(next: "asc" | "desc" | null) {
    setSortDir(next);
    if (!clubs || clubs.length === 0) return;
    const sorted = [...clubs].sort((a, b) => {
      if (next === "asc") return a.name.localeCompare(b.name);
      if (next === "desc") return b.name.localeCompare(a.name);
      return 0;
    });
    reorderMutation.mutate({
      data: { password, clubIds: sorted.map((c) => c.id) },
    });
  }

  const displayClubs = clubs
    ? [...clubs].sort((a, b) => {
        if (sortDir === "asc") return a.name.localeCompare(b.name);
        if (sortDir === "desc") return b.name.localeCompare(a.name);
        return 0;
      })
    : [];

  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="border border-border/60">
      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : clubs && clubs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead className="py-3 w-4" />
              <TableHead className="py-3">
                <button
                  type="button"
                  onClick={() =>
                    handleSortChange(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc")
                  }
                  className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground hover:text-primary transition-colors"
                >
                  Name
                  <SortIcon className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                Slug
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden lg:table-cell">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden xl:table-cell">
                Calendar
              </TableHead>
              <TableHead className="py-3 w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayClubs.map((club) => (
              <ClubRow
                key={club.id}
                club={club}
                password={password}
                calendars={availableCalendars}
                onDeleted={() => qc.invalidateQueries({ queryKey })}
                onUpdated={() => qc.invalidateQueries({ queryKey })}
              />
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground italic">No clubs yet.</p>
        </div>
      )}

      {/* Add club */}
      <div className="border-t border-border/60">
        {showAddForm ? (
          <form onSubmit={handleAdd} className="p-5 space-y-4">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              New Club
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: toSlug(name) }));
                  }}
                  placeholder="Finance Society"
                  className="h-8 text-sm rounded-sm border-border/60"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  placeholder="finance-society"
                  className="h-8 text-sm rounded-sm border-border/60 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                Description
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description…"
                className="h-8 text-sm rounded-sm border-border/60"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                Linked Calendar
              </Label>
              <Select
                value={form.calendarId !== null ? String(form.calendarId) : "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, calendarId: v === "__none__" ? null : Number(v) }))}
              >
                <SelectTrigger className="h-8 text-sm rounded-sm border-border/60 w-full max-w-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="__none__">None</SelectItem>
                  {availableCalendars.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="club-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="club-active" className="text-sm text-muted-foreground cursor-pointer">
                Active
              </Label>
            </div>

            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                size="sm"
                className="rounded-sm text-xs font-semibold tracking-[0.14em] uppercase"
              >
                {createMutation.isPending ? "Adding…" : "Add Club"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-sm text-xs text-muted-foreground"
                onClick={() => { setShowAddForm(false); setForm(EMPTY_CLUB_FORM); setAddError(null); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-primary hover:bg-muted/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Club
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Calendar management ──────────────────────────────────────────────────────

type CalendarFormState = {
  name: string;
  owner: string;
  color: string;
  subscriptionUrl: string;
  description: string;
  timezone: string;
  defaultHidden: boolean;
};

const EMPTY_FORM: CalendarFormState = {
  name: "",
  owner: "",
  color: "#7c3aed",
  subscriptionUrl: "",
  description: "",
  timezone: "America/Los_Angeles",
  defaultHidden: false,
};

function CalendarRow({
  calendar,
  password,
  onDeleted,
  onUpdated,
}: {
  calendar: AdminCalendar;
  password: string;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<CalendarFormState>({
    name: calendar.name,
    owner: calendar.owner,
    color: calendar.color,
    subscriptionUrl: calendar.subscriptionUrl ?? "",
    description: calendar.description ?? "",
    timezone: calendar.timezone,
    defaultHidden: calendar.defaultHidden,
  });
  const { toast } = useToast();

  const updateMutation = useAdminUpdateCalendar({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        onUpdated();
        toast({ title: "Calendar updated" });
      },
      onError: () => {
        toast({ title: "Update failed", variant: "destructive" });
      },
    },
  });

  const deleteMutation = useAdminDeleteCalendar({
    mutation: {
      onSuccess: () => {
        onDeleted();
        toast({ title: "Calendar deleted", description: `"${calendar.name}" and all its events have been removed.` });
      },
      onError: () => {
        toast({ title: "Delete failed", variant: "destructive" });
      },
    },
  });

  function handleSave() {
    updateMutation.mutate({
      id: calendar.id,
      data: { password, ...form, subscriptionUrl: form.subscriptionUrl || undefined },
    });
  }

  function handleDelete() {
    deleteMutation.mutate({ id: calendar.id, data: { password } });
  }

  return (
    <>
      <TableRow className="border-b border-border/40 last:border-0 hover:bg-muted/20 align-top">
        <TableCell className="py-3 w-4">
          <span
            className="inline-block w-3 h-3 rounded-full mt-0.5"
            style={{ backgroundColor: editing ? form.color : calendar.color }}
          />
        </TableCell>
        <TableCell className="py-3 font-medium text-sm min-w-[160px]">
          {editing ? (
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-7 text-sm rounded-sm border-border/60 px-2"
            />
          ) : (
            <span>{calendar.name}</span>
          )}
        </TableCell>
        <TableCell className="py-3 text-sm text-muted-foreground hidden md:table-cell min-w-[120px]">
          {editing ? (
            <Input
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              className="h-7 text-sm rounded-sm border-border/60 px-2"
            />
          ) : (
            <span>{calendar.owner}</span>
          )}
        </TableCell>
        <TableCell className="py-3 text-sm text-muted-foreground hidden lg:table-cell min-w-[260px]">
          {editing ? (
            <Input
              value={form.subscriptionUrl}
              onChange={(e) => setForm((f) => ({ ...f, subscriptionUrl: e.target.value }))}
              placeholder="https://…/feed.ics"
              className="h-7 text-xs rounded-sm border-border/60 px-2 font-mono"
            />
          ) : (
            <span className="font-mono text-xs truncate block max-w-[260px]">
              {calendar.subscriptionUrl ?? <em className="not-italic text-muted-foreground/50">no URL</em>}
            </span>
          )}
        </TableCell>
        <TableCell className="py-3 text-right w-24">
          {editing ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                disabled={updateMutation.isPending}
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    name: calendar.name,
                    owner: calendar.owner,
                    color: calendar.color,
                    subscriptionUrl: calendar.subscriptionUrl ?? "",
                    description: calendar.description ?? "",
                    timezone: calendar.timezone,
                    defaultHidden: calendar.defaultHidden,
                  });
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      {editing && (
        <TableRow className="border-b border-border/40 bg-muted/10">
          <TableCell colSpan={5} className="pb-4 pt-1 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-8 h-7 rounded-sm border border-border/60 cursor-pointer p-0.5 bg-transparent"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-7 text-xs rounded-sm border-border/60 px-2 font-mono flex-1"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Timezone
                </Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  className="h-7 text-xs rounded-sm border-border/60 px-2"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="h-7 text-xs rounded-sm border-border/60 px-2"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`hidden-${calendar.id}`}
                    checked={form.defaultHidden}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, defaultHidden: v }))}
                  />
                  <Label
                    htmlFor={`hidden-${calendar.id}`}
                    className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground cursor-pointer"
                  >
                    Hidden by default
                  </Label>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{calendar.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the calendar and all of its events. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function generateUniqueColor(usedColors: string[]): string {
  const usedHues = usedColors
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
    .map((c) => hexToHsl(c)[0]);

  let bestHue = 0;
  let bestGap = 0;
  const candidates = Array.from({ length: 360 }, (_, i) => i);
  for (const hue of candidates) {
    const minDist = usedHues.reduce((min, h) => {
      const d = Math.min(Math.abs(hue - h), 360 - Math.abs(hue - h));
      return Math.min(min, d);
    }, 360);
    if (minDist > bestGap) { bestGap = minDist; bestHue = hue; }
  }
  // Add slight randomness within the best zone
  const finalHue = (bestHue + (Math.random() * 20 - 10) + 360) % 360;
  return hslToHex(finalHue, 0.65 + Math.random() * 0.2, 0.45 + Math.random() * 0.1);
}

function CalendarManagementPanel({ password }: { password: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<CalendarFormState>(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  const queryKey = getAdminListCalendarsQueryKey({ password });
  const { data: calendars, isLoading } = useAdminListCalendars(
    { password },
    { query: { queryKey } }
  );

  const createMutation = useAdminCreateCalendar({
    mutation: {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowAddForm(false);
        setAddError(null);
        qc.invalidateQueries({ queryKey });
        toast({ title: "Calendar added" });
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Something went wrong";
        setAddError(msg);
      },
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!form.name.trim() || !form.owner.trim() || !form.color.trim()) return;
    createMutation.mutate({
      data: {
        password,
        name: form.name.trim(),
        owner: form.owner.trim(),
        color: form.color,
        description: form.description || undefined,
        timezone: form.timezone || "America/Los_Angeles",
        subscriptionUrl: form.subscriptionUrl || undefined,
        defaultHidden: form.defaultHidden,
      },
    });
  }

  const sortedCalendars = calendars
    ? [...calendars].sort((a, b) => {
        if (sortDir === "asc") return a.name.localeCompare(b.name);
        if (sortDir === "desc") return b.name.localeCompare(a.name);
        return 0;
      })
    : [];

  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="border border-border/60">
      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : calendars && calendars.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead className="py-3 w-4" />
              <TableHead className="py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))
                  }
                  className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground hover:text-primary transition-colors"
                >
                  Name
                  <SortIcon className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                Owner
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden lg:table-cell">
                ICS URL
              </TableHead>
              <TableHead className="py-3 w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCalendars.map((cal) => (
              <CalendarRow
                key={cal.id}
                calendar={cal}
                password={password}
                onDeleted={() => qc.invalidateQueries({ queryKey })}
                onUpdated={() => qc.invalidateQueries({ queryKey })}
              />
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground italic">No calendars yet.</p>
        </div>
      )}

      <div className="border-t border-border/60">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add calendar
          </span>
          {showAddForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showAddForm && (
          <form onSubmit={handleAdd} className="px-4 pb-4 space-y-4 border-t border-border/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Finance Society"
                  className="h-8 text-sm rounded-sm border-border/60"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Owner / Source <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  placeholder="UW Foster MBAA"
                  className="h-8 text-sm rounded-sm border-border/60"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  ICS Feed URL
                </Label>
                <Input
                  value={form.subscriptionUrl}
                  onChange={(e) => setForm((f) => ({ ...f, subscriptionUrl: e.target.value }))}
                  placeholder="https://calendar.google.com/…/basic.ics"
                  className="h-8 text-sm rounded-sm border-border/60 font-mono"
                  type="url"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Color <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-8 h-8 rounded-sm border border-border/60 cursor-pointer p-0.5 bg-transparent"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-8 text-sm rounded-sm border-border/60 font-mono flex-1"
                    maxLength={7}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-sm border-border/60 shrink-0"
                    title="Generate a color not used by existing calendars"
                    onClick={() => {
                      const used = (calendars ?? []).map((c) => c.color);
                      setForm((f) => ({ ...f, color: generateUniqueColor(used) }));
                    }}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="h-8 text-sm rounded-sm border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Timezone
                </Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="America/Los_Angeles"
                  className="h-8 text-sm rounded-sm border-border/60"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="add-hidden"
                  checked={form.defaultHidden}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, defaultHidden: v }))}
                />
                <Label
                  htmlFor="add-hidden"
                  className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground cursor-pointer"
                >
                  Hidden by default
                </Label>
              </div>
              <div className="flex items-center gap-2">
                {addError && <p className="text-xs text-destructive">{addError}</p>}
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending || !form.name.trim() || !form.owner.trim()}
                  className="rounded-sm h-8 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {createMutation.isPending ? "Adding…" : "Add Calendar"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Club leads panel ─────────────────────────────────────────────────────────

function ClubLeadsPanel({ slug, clubName }: { slug: string; clubName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: leads, isLoading } = useListClubLeads(slug, {
    query: { queryKey: getListClubLeadsQueryKey(slug) },
  });

  const addMutation = useAddClubLead({
    mutation: {
      onSuccess: () => {
        setEmail("");
        setAddError(null);
        qc.invalidateQueries({ queryKey: getListClubLeadsQueryKey(slug) });
        toast({ title: "Lead added", description: `Added to ${clubName}` });
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ?? "Something went wrong";
        setAddError(msg);
      },
    },
  });

  const removeMutation = useRemoveClubLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClubLeadsQueryKey(slug) });
        toast({ title: "Lead removed" });
      },
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!email.trim()) return;
    addMutation.mutate({ slug, data: { email: email.trim() } });
  }

  return (
    <div className="border border-border/60">
      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : leads && leads.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                Name
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden sm:table-cell">
                Email
              </TableHead>
              <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                Added
              </TableHead>
              <TableHead className="py-3 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow
                key={lead.leadId}
                className="border-b border-border/40 last:border-0 hover:bg-muted/30"
              >
                <TableCell className="py-3 font-medium text-sm">
                  {lead.fullName}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground hidden sm:table-cell">
                  {lead.email}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground hidden md:table-cell">
                  {fmtDate(lead.addedAt)}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({ slug, leadId: lead.leadId })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground italic">
            No leads registered for this club yet.
          </p>
        </div>
      )}

      <div className="border-t border-border/60 p-4">
        <form onSubmit={handleAdd} className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Add lead by UW email
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAddError(null);
              }}
              placeholder="name@uw.edu"
              className="h-9 text-sm rounded-sm border-border/60"
            />
            {addError && (
              <p className="text-xs text-destructive mt-1">{addError}</p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={addMutation.isPending || !email.trim()}
            className="rounded-sm h-9 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Lead
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Student Leader Panel ──────────────────────────────────────────────────────

const QUARTER_STATUSES = [
  { value: "nominations_open", label: "Nominations Open" },
  { value: "nominations_closed", label: "Nominations Closed / Voting" },
  { value: "announced", label: "Winner Announced" },
] as const;

function StudentLeaderPanel({ password }: { password: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: current, isLoading } = useGetStudentLeaderCurrent();

  const [draft, setDraft] = useState<Partial<StudentLeaderEntry>>({});
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [nextQuarter, setNextQuarter] = useState("");

  const updateMutation = useAdminUpdateStudentLeader({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStudentLeaderCurrentQueryKey() });
        toast({ title: "Saved", description: "Student leader entry updated." });
        setEditing(false);
      },
      onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
    },
  });

  const advanceMutation = useAdminAdvanceStudentLeaderQuarter({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStudentLeaderCurrentQueryKey() });
        toast({ title: "Quarter advanced", description: `New quarter "${nextQuarter}" created.` });
        setAdvanceOpen(false);
        setNextQuarter("");
      },
      onError: () => toast({ title: "Error", description: "Failed to advance quarter.", variant: "destructive" }),
    },
  });

  function startEdit() {
    if (!current) return;
    setDraft({
      status: current.status,
      winnerName: current.winnerName ?? "",
      winnerClub: current.winnerClub ?? "",
      winnerProgram: current.winnerProgram ?? "",
      winnerBio: current.winnerBio ?? "",
      nominatedBy: current.nominatedBy ?? "",
      reason: current.reason ?? "",
    });
    setEditing(true);
  }

  function handleSave() {
    if (!current) return;
    updateMutation.mutate({
      id: current.id,
      data: {
        status: (draft.status as "nominations_open" | "nominations_closed" | "announced") ?? current.status,
        winnerName: draft.winnerName || undefined,
        winnerClub: draft.winnerClub || undefined,
        winnerProgram: draft.winnerProgram || undefined,
        winnerBio: draft.winnerBio || undefined,
        nominatedBy: draft.nominatedBy || undefined,
        reason: draft.reason || undefined,
        password,
      },
    });
  }

  async function handlePhotoUpload(file: File) {
    if (!current) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/admin/student-leader/${current.id}/photo?password=${encodeURIComponent(password)}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: getGetStudentLeaderCurrentQueryKey() });
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Error", description: "Photo upload failed.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const statusLabel = QUARTER_STATUSES.find((s) => s.value === current?.status)?.label ?? current?.status ?? "—";

  return (
    <div className="space-y-6">
      {/* Current quarter header */}
      <div className="border border-border/60 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground mb-1">
              {current ? current.quarter : "No active quarter"}
            </p>
            {current && (
              <p className="text-sm text-foreground">
                Status:{" "}
                <span className={`font-semibold ${
                  current.status === "announced" ? "text-emerald-600" :
                  current.status === "nominations_closed" ? "text-amber-600" :
                  "text-primary"
                }`}>{statusLabel}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {current && !editing && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-sm h-8 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5 border-border/60"
                onClick={startEdit}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="rounded-sm h-8 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5 border-border/60"
              onClick={() => setAdvanceOpen(true)}
            >
              <RotateCcw className="h-3 w-3" />
              Advance Quarter
            </Button>
          </div>
        </div>

        {/* Photo row */}
        {current && (
          <div className="mt-4 flex items-center gap-4">
            {current.winnerPhotoUrl ? (
              <img
                src={current.winnerPhotoUrl}
                alt="Winner"
                className="w-14 h-14 rounded-full object-cover border border-border/60"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted/40 border border-border/60 flex items-center justify-center">
                <Award className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Winner photo</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhotoUpload(file);
                  }}
                />
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] uppercase border border-border/60 rounded-sm px-2 py-1 hover:bg-muted/30 transition-colors ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                  <Camera className="h-3 w-3" />
                  {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && current && (
        <div className="border border-primary/20 p-5 space-y-4">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary mb-3">Editing {current.quarter}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={draft.status as string}
                onValueChange={(v) => setDraft((d) => ({ ...d, status: v as StudentLeaderEntry["status"] }))}
              >
                <SelectTrigger className="rounded-sm h-9 text-sm border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Winner Name</Label>
              <Input
                value={draft.winnerName ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, winnerName: e.target.value }))}
                placeholder="Full name"
                className="rounded-sm h-9 text-sm border-border/60"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Club / Organization</Label>
              <Input
                value={draft.winnerClub ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, winnerClub: e.target.value }))}
                placeholder="e.g. Finance Club"
                className="rounded-sm h-9 text-sm border-border/60"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Input
                value={draft.winnerProgram ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, winnerProgram: e.target.value }))}
                placeholder="e.g. MBA, MSBA"
                className="rounded-sm h-9 text-sm border-border/60"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nominated By</Label>
              <Input
                value={draft.nominatedBy ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, nominatedBy: e.target.value }))}
                placeholder="Name or 'Anonymous'"
                className="rounded-sm h-9 text-sm border-border/60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Bio / Accomplishments</Label>
            <Textarea
              value={draft.winnerBio ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, winnerBio: e.target.value }))}
              placeholder="Briefly describe why this person was selected…"
              rows={3}
              className="rounded-sm text-sm border-border/60 resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nomination Quote / Reason</Label>
            <Textarea
              value={draft.reason ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
              placeholder="Quoted nomination reason to display publicly…"
              rows={3}
              className="rounded-sm text-sm border-border/60 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="rounded-sm h-8 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <Check className="h-3 w-3" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-sm h-8 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5 border-border/60"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Advance Quarter dialog */}
      <AlertDialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance to Next Quarter</AlertDialogTitle>
            <AlertDialogDescription>
              The current quarter will be archived and a new one will open for nominations.
              Enter the name for the new quarter (e.g. "Summer 2026").
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Input
              value={nextQuarter}
              onChange={(e) => setNextQuarter(e.target.value)}
              placeholder="Summer 2026"
              className="rounded-sm h-9 text-sm border-border/60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && nextQuarter.trim()) {
                  advanceMutation.mutate({ data: { nextQuarter: nextQuarter.trim(), password } });
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (nextQuarter.trim()) {
                  advanceMutation.mutate({ data: { nextQuarter: nextQuarter.trim(), password } });
                }
              }}
              disabled={!nextQuarter.trim() || advanceMutation.isPending}
            >
              {advanceMutation.isPending ? "Advancing…" : "Advance Quarter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Admin content ────────────────────────────────────────────────────────────

function AdminContent({ onLock, password }: { onLock: () => void; password: string }) {
  const { data: clubs, isLoading: clubsLoading } = useListClubs();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedClub = clubs?.find((c) => c.slug === selectedSlug);
  const { toast } = useToast();

  const [syncing, setSyncing] = useState(false);
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { ok?: boolean; totalEvents?: number; error?: string };
      if (data.ok) {
        toast({ title: "Sync complete", description: `${data.totalEvents?.toLocaleString()} events refreshed across all calendars.` });
      } else {
        toast({ title: "Sync failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Sync failed", description: "Network error", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-10">
        <Button
          variant="ghost"
          asChild
          className="-ml-3 text-muted-foreground hover:text-primary text-xs font-semibold tracking-[0.18em] uppercase"
        >
          <Link href="/membership">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back to Membership
          </Link>
        </Button>
        <Button
          variant="ghost"
          onClick={onLock}
          className="text-muted-foreground hover:text-primary text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Lock
        </Button>
      </div>

      <section className="max-w-4xl mb-12">
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary">
            Admin
          </p>
          <ShieldAlert className="h-3.5 w-3.5 text-primary" />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground">
          Club Lead{" "}
          <em className="italic font-light text-primary">Management</em>
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Manage calendar sources, designate which members can request magic-link access to a club's
          roster, and manually trigger calendar syncs.
        </p>
      </section>

      <Separator className="mb-10" />

      <div className="max-w-3xl space-y-10">

        {/* Calendar Data */}
        <div>
          <SectionLabel>Calendar Data</SectionLabel>
          <div className="space-y-4">
            <div className="border border-border/60 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Sync all calendars</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fetches the latest events from all ICS feeds and refreshes the database. Takes ~30 seconds.
                </p>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                size="sm"
                className="rounded-sm shrink-0 text-xs font-semibold tracking-[0.14em] uppercase gap-1.5 border-border/60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Now"}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Calendar Sources */}
        <div>
          <SectionLabel>Calendar Sources</SectionLabel>
          <p className="text-sm text-muted-foreground mb-4">
            Add, edit, or remove calendar ICS feeds. Deleting a calendar also removes all its synced events.
          </p>
          <CalendarManagementPanel password={password} />
        </div>

        <Separator />

        {/* Club Management */}
        <div>
          <SectionLabel>Clubs</SectionLabel>
          <p className="text-sm text-muted-foreground mb-4">
            Add, edit, or remove clubs. Deleting a club also removes all its membership records and lead assignments.
          </p>
          <ClubManagementPanel password={password} />
        </div>

        <Separator />

        {/* Club Leads */}
        <div>
          <SectionLabel>Club Lead Access</SectionLabel>
          {clubsLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select onValueChange={(v) => setSelectedSlug(v)}>
              <SelectTrigger className="w-64 rounded-sm h-9 text-sm border-border/60">
                <SelectValue placeholder="Choose a club…" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {clubs?.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedSlug && selectedClub && (
          <div>
            <SectionLabel>Leads — {selectedClub.name}</SectionLabel>
            <ClubLeadsPanel slug={selectedSlug} clubName={selectedClub.name} />
          </div>
        )}

        {!selectedSlug && (
          <div className="py-16 text-center border border-border/60 border-dashed">
            <SectionLabel>No club selected</SectionLabel>
            <p className="font-serif text-2xl text-foreground">
              Pick a club above to manage its leads.
            </p>
          </div>
        )}

        <Separator />

        {/* Student Leader of the Quarter */}
        <div>
          <SectionLabel>Student Leader of the Quarter</SectionLabel>
          <p className="text-sm text-muted-foreground mb-4">
            Manage the current quarter's status, winner details, photo, and advance to a new quarter when voting closes.
          </p>
          <StudentLeaderPanel password={password} />
        </div>

      </div>
    </Layout>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  function handleLock() {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
    setAdminPassword("");
  }

  if (!unlocked) {
    return (
      <PasswordGate
        onUnlock={(pw) => {
          setAdminPassword(pw);
          setUnlocked(true);
        }}
      />
    );
  }

  return <AdminContent onLock={handleLock} password={adminPassword} />;
}
