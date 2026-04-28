import { useState, useEffect } from "react";
import { Link, useSearchParams } from "wouter";
import {
  ArrowLeft,
  Search,
  Download,
  Mail,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  useGetMembershipSummary,
  useSearchMembers,
  getSearchMembersQueryKey,
  useGetMemberMemberships,
  getGetMemberMembershipsQueryKey,
  useListClubs,
  useGetClubSummary,
  getGetClubSummaryQueryKey,
  useRequestRosterAccess,
  useGetClubRoster,
  getGetClubRosterQueryKey,
} from "@workspace/api-client-react";
import type { Club, TokenErrorResponse } from "@workspace/api-client-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function fmtProgram(p: string) {
  return p === "full_time" ? "Full-Time" : "Evening";
}

// ─── shared atoms ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="border border-border/60 p-6">
      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
        {label}
      </p>
      <p
        className={`font-serif text-4xl tracking-tight leading-none${accent ? " text-primary" : " text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] tracking-wider uppercase font-semibold gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Active
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="text-muted-foreground text-[10px] tracking-wider uppercase font-semibold gap-1"
    >
      <XCircle className="h-3 w-3" />
      Expired
    </Badge>
  );
}

// ─── Tab 1: Find Me ───────────────────────────────────────────────────────────

function FindMeTab() {
  const [inputVal, setInputVal] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(inputVal.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputVal]);

  const searchEnabled = debouncedQ.length >= 2;

  const { data: results, isFetching } = useSearchMembers(
    { q: debouncedQ },
    {
      query: {
        queryKey: getSearchMembersQueryKey({ q: debouncedQ }),
        enabled: searchEnabled,
      },
    },
  );

  const { data: memberDetail, isFetching: detailLoading } =
    useGetMemberMemberships(selectedId ?? "", {
      query: {
        queryKey: getGetMemberMembershipsQueryKey(selectedId ?? ""),
        enabled: !!selectedId,
      },
    });

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setSelectedId(null);
          }}
          placeholder="Search by name or email…"
          className="pl-9 h-9 text-sm rounded-sm border-border/60"
        />
      </div>

      {!searchEnabled && (
        <div className="py-16 text-center border border-border/60 border-dashed">
          <SectionLabel>Search the roster</SectionLabel>
          <p className="font-serif text-2xl text-foreground">
            Type your name or UW email to find your memberships.
          </p>
        </div>
      )}

      {searchEnabled && (
        <div className="border border-border/60">
          {isFetching ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !results?.length ? (
            <div className="py-10 text-center">
              <SectionLabel>No results</SectionLabel>
              <p className="font-serif text-xl text-foreground">
                No members matched &ldquo;{debouncedQ}&rdquo;
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden sm:table-cell">
                    Program
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                    Class
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((m) => (
                  <TableRow
                    key={m.id}
                    onClick={() =>
                      setSelectedId(m.id === selectedId ? null : m.id)
                    }
                    className={`border-b border-border/40 last:border-0 cursor-pointer ${
                      m.id === selectedId
                        ? "bg-primary/5 hover:bg-primary/[0.08]"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-sm text-foreground">
                        {m.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.email}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 hidden sm:table-cell text-sm text-foreground/80">
                      {fmtProgram(m.program)}
                    </TableCell>
                    <TableCell className="py-3 hidden md:table-cell text-sm font-mono text-foreground/80">
                      {m.classYear}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {selectedId && (
        <div className="border border-border/60 p-6">
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full mt-4" />
            </div>
          ) : memberDetail ? (
            <div className="space-y-5">
              <div>
                <SectionLabel>Member profile</SectionLabel>
                <p className="font-serif text-2xl tracking-tight text-foreground">
                  {memberDetail.member.fullName}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {memberDetail.member.email} &middot;{" "}
                  {fmtProgram(memberDetail.member.program)} &middot; Class of{" "}
                  {memberDetail.member.classYear}
                </p>
              </div>

              {memberDetail.memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No club memberships on record.
                </p>
              ) : (
                <div>
                  <SectionLabel>Club memberships</SectionLabel>
                  <div className="border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border/60 hover:bg-transparent">
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                            Club
                          </TableHead>
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden sm:table-cell">
                            Year
                          </TableHead>
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                            Term
                          </TableHead>
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                            Paid
                          </TableHead>
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden lg:table-cell">
                            Expires
                          </TableHead>
                          <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberDetail.memberships.map((ms, i) => (
                          <TableRow
                            key={i}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                          >
                            <TableCell className="py-3 font-medium text-sm">
                              {ms.clubName}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-foreground/80 hidden sm:table-cell">
                              {ms.academicYear}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-foreground/80 hidden md:table-cell">
                              {ms.termYears}Y
                            </TableCell>
                            <TableCell className="py-3 text-sm text-foreground/80">
                              {fmtDate(ms.paidAt)}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-foreground/80 hidden lg:table-cell">
                              {fmtDate(ms.expiresAt)}
                            </TableCell>
                            <TableCell className="py-3">
                              <ActiveBadge active={ms.isActive} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Browse a Club ─────────────────────────────────────────────────────

function BrowseClubTab() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: clubs } = useListClubs();
  const { data: summary, isFetching } = useGetClubSummary(
    selectedSlug ?? "",
    {
      query: {
        queryKey: getGetClubSummaryQueryKey(selectedSlug ?? ""),
        enabled: !!selectedSlug,
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2 block">
          Club
        </Label>
        <Select onValueChange={(v) => setSelectedSlug(v)}>
          <SelectTrigger className="rounded-sm h-9 text-sm border-border/60">
            <SelectValue placeholder="Select a club…" />
          </SelectTrigger>
          <SelectContent>
            {clubs?.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSlug && (
        <div className="py-16 text-center border border-border/60 border-dashed">
          <SectionLabel>Club stats</SectionLabel>
          <p className="font-serif text-2xl text-foreground">
            Select a club to see its membership summary.
          </p>
        </div>
      )}

      {selectedSlug && isFetching && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {summary && !isFetching && (
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground whitespace-nowrap">
              {summary.currentAcademicYear}
            </p>
            <Separator className="flex-1" />
          </div>

          <div>
            <SectionLabel>Enrollment breakdown</SectionLabel>
            <div className="border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/60 hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                      Program
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 text-right">
                      New
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 text-right">
                      Returning
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-border/40 hover:bg-muted/30">
                    <TableCell className="py-3 font-medium text-sm">
                      Full-Time
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono">
                      {summary.fullTime.newThisYear}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono">
                      {summary.fullTime.returning}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono font-semibold">
                      {summary.fullTime.total}
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="py-3 font-medium text-sm">
                      Evening
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono">
                      {summary.evening.newThisYear}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono">
                      {summary.evening.returning}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-right font-mono font-semibold">
                      {summary.evening.total}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <SectionLabel>
              Dues collected ({summary.currentAcademicYear})
            </SectionLabel>
            <div className="grid grid-cols-3 gap-px border border-border/60">
              <StatCard label="Gross" value={fmtMoney(summary.amountPaid)} />
              <StatCard
                label="PayPal fees (3.5%)"
                value={fmtMoney(summary.paypalFee)}
              />
              <StatCard
                label="Net dues"
                value={fmtMoney(summary.netDues)}
                accent
              />
            </div>
          </div>

          {summary.yearOverYear.length > 0 && (
            <div>
              <SectionLabel>Year-over-year membership</SectionLabel>
              <div className="border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                        Academic Year
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 text-right">
                        Members
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.yearOverYear.map((row) => (
                      <TableRow
                        key={row.academicYear}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                      >
                        <TableCell className="py-3 font-mono text-sm">
                          {row.academicYear}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm font-semibold">
                          {row.memberCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Club Lead Access ──────────────────────────────────────────────────

function RequestAccessForm({ clubs }: { clubs: Club[] }) {
  const [requestSlug, setRequestSlug] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const mutation = useRequestRosterAccess({
    mutation: {
      onSuccess: (data) => {
        setSubmitted(true);
        setDevLink(data.magicLink ?? null);
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requestSlug || !email.trim()) return;
    mutation.mutate({ slug: requestSlug, data: { email: email.trim() } });
  }

  if (submitted) {
    return (
      <div className="border border-border/60 p-8 max-w-md space-y-4">
        <div>
          <SectionLabel>Sent</SectionLabel>
          <p className="font-serif text-2xl tracking-tight text-foreground">
            Check your{" "}
            <em className="italic font-light text-primary">inbox</em>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          If your email is registered as a lead for that club, you will receive
          a link shortly. It expires in 24 hours and can only be used once.
        </p>
        {devLink && (
          <div className="p-3 border border-amber-300 bg-amber-50 rounded-sm">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-700 mb-1.5">
              Dev mode -- link not emailed
            </p>
            <a
              href={devLink}
              className="text-xs text-amber-800 underline underline-offset-2 break-all font-mono"
            >
              {devLink}
            </a>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold tracking-wider uppercase rounded-sm"
          onClick={() => {
            setSubmitted(false);
            setEmail("");
            setDevLink(null);
          }}
        >
          Request another link
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Club
        </Label>
        <Select onValueChange={(v) => setRequestSlug(v)}>
          <SelectTrigger className="rounded-sm h-9 text-sm border-border/60">
            <SelectValue placeholder="Select your club…" />
          </SelectTrigger>
          <SelectContent>
            {clubs.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Your UW email
        </Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@uw.edu"
          className="h-9 rounded-sm text-sm border-border/60"
        />
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">
          Something went wrong. Please try again.
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={!requestSlug || !email.trim() || mutation.isPending}
        className="rounded-sm font-semibold tracking-wider uppercase text-xs h-9 px-4 gap-1.5"
      >
        <Mail className="h-3.5 w-3.5" />
        {mutation.isPending ? "Sending…" : "Send access link"}
      </Button>
    </form>
  );
}

function RosterView({ slug, token }: { slug: string; token: string }) {
  const { data, isLoading, isError, error } = useGetClubRoster(slug, { token }, {
    query: {
      queryKey: getGetClubRosterQueryKey(slug, { token }),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    const code = (error as { data?: TokenErrorResponse } | null)?.data?.code;
    const codeLabels: Record<string, string> = {
      token_expired: "This link has expired.",
      token_used: "This link has already been used.",
      token_invalid: "This link is invalid.",
    };
    return (
      <div className="py-16 text-center border border-border/60 border-dashed">
        <SectionLabel>Access denied</SectionLabel>
        <p className="font-serif text-2xl text-foreground mb-3">
          {codeLabels[code ?? "token_invalid"] ?? "Access denied."}
        </p>
        <p className="text-sm text-muted-foreground">
          Request a new access link using the form below.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const csvUrl = `/api/clubs/${slug}/roster.csv?token=${token}`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <SectionLabel>Club roster</SectionLabel>
          <p className="font-serif text-3xl tracking-tight text-foreground">
            {data.club.name}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {data.currentAcademicYear} &middot; {data.members.length} members
          </p>
        </div>
        <a href={csvUrl} download>
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm text-xs font-semibold tracking-wider uppercase gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </a>
      </div>

      <div>
        <SectionLabel>Members</SectionLabel>
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden sm:table-cell">
                  Program
                </TableHead>
                <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                  Class
                </TableHead>
                <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => {
                const latest = m.memberships[0];
                return (
                  <TableRow
                    key={m.email}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-sm text-foreground">
                        {m.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.email}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 hidden sm:table-cell text-sm text-foreground/80">
                      {fmtProgram(m.program)}
                    </TableCell>
                    <TableCell className="py-3 hidden md:table-cell text-sm font-mono text-foreground/80">
                      {m.classYear}
                    </TableCell>
                    <TableCell className="py-3">
                      {latest && <ActiveBadge active={latest.isActive} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {(data.renewalForecast.expiringThisYear.length > 0 ||
        data.renewalForecast.lapsedLastYear.length > 0) && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground whitespace-nowrap">
              Renewal forecast
            </p>
            <Separator className="flex-1" />
          </div>

          {data.renewalForecast.expiringThisYear.length > 0 && (
            <div>
              <SectionLabel>Expiring this year</SectionLabel>
              <div className="border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                        Name
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                        Expires
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.renewalForecast.expiringThisYear.map((m) => (
                      <TableRow
                        key={m.email}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                      >
                        <TableCell className="py-3">
                          <p className="font-medium text-sm">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground/80">
                          {fmtDate(m.expiresAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {data.renewalForecast.lapsedLastYear.length > 0 && (
            <div>
              <SectionLabel>Lapsed last year</SectionLabel>
              <div className="border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                        Name
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                        Last paid
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.renewalForecast.lapsedLastYear.map((m) => (
                      <TableRow
                        key={m.email}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                      >
                        <TableCell className="py-3">
                          <p className="font-medium text-sm">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-sm font-mono text-foreground/80">
                          {m.lastPaidAcademicYear}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeadAccessTab({
  token,
  club,
}: {
  token: string;
  club: string;
}) {
  const hasToken = !!token && !!club;
  const { data: clubs } = useListClubs();

  return (
    <div className="space-y-6">
      {hasToken ? (
        <>
          <RosterView slug={club} token={token} />
          <Separator />
          <div className="space-y-4">
            <SectionLabel>Need a new link?</SectionLabel>
            <RequestAccessForm clubs={clubs ?? []} />
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="max-w-xl">
            <SectionLabel>How it works</SectionLabel>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you are a registered club lead, enter your club and UW email
              below. We will email you a secure link to view your full member
              roster and download a CSV export.
            </p>
          </div>
          <RequestAccessForm clubs={clubs ?? []} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Membership() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";
  const urlClub = searchParams.get("club") ?? "";
  const defaultTab = urlToken && urlClub ? "lead" : "find";

  const { data: summary, isLoading: summaryLoading } =
    useGetMembershipSummary();

  return (
    <Layout>
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

      <section className="max-w-4xl mb-12">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          MBAA Club Dues
        </p>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground">
          MBAA <em className="italic font-light text-primary">Membership</em>{" "}
          Records
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Find your club memberships, browse dues summaries by club, or access
          your roster as a club lead.
        </p>
      </section>

      <div className="grid grid-cols-3 gap-px border border-border/60 mb-12">
        {summaryLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 border border-border/60">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Active members"
              value={summary?.totalActiveMembers ?? 0}
              accent
            />
            <StatCard
              label={`Dues collected (${summary?.currentAcademicYear ?? ""})`}
              value={fmtMoney(summary?.totalDuesCollected ?? 0)}
            />
            <StatCard
              label="Active clubs"
              value={summary?.activeClubCount ?? 0}
            />
          </>
        )}
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-8">
        <TabsList className="border border-border/60 bg-transparent p-0.5 rounded-none gap-0 h-auto">
          <TabsTrigger
            value="find"
            className="rounded-none px-5 py-2 text-xs font-semibold tracking-[0.18em] uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Find Me
          </TabsTrigger>
          <TabsTrigger
            value="clubs"
            className="rounded-none px-5 py-2 text-xs font-semibold tracking-[0.18em] uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Browse a Club
          </TabsTrigger>
          <TabsTrigger
            value="lead"
            className="rounded-none px-5 py-2 text-xs font-semibold tracking-[0.18em] uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Club Lead Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="find" className="mt-0">
          <FindMeTab />
        </TabsContent>
        <TabsContent value="clubs" className="mt-0">
          <BrowseClubTab />
        </TabsContent>
        <TabsContent value="lead" className="mt-0">
          <LeadAccessTab token={urlToken} club={urlClub} />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
