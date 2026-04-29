import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Search, Mail, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListDirectoryMembers } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtProgram(p: string) {
  return p === "full_time" ? "Full-time MBA" : "Evening MBA";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0] ?? "").toUpperCase() +
    (parts[parts.length - 1][0] ?? "").toUpperCase()
  );
}

const PROGRAM_COLORS: Record<string, string> = {
  full_time: "bg-primary/10 text-primary border-primary/20",
  evening: "bg-amber-50 text-amber-800 border-amber-200",
};

const AVATAR_COLORS = [
  "bg-primary text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-rose-600 text-white",
  "bg-indigo-600 text-white",
  "bg-emerald-600 text-white",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── sub-components ──────────────────────────────────────────────────────────

function MemberCard({ member }: { member: Member }) {
  const ini = initials(member.fullName);
  const color = avatarColor(member.fullName);

  return (
    <div className="bg-card border border-border/60 p-4 flex gap-4 items-start hover:border-border transition-colors">
      <div
        className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${color}`}
      >
        {ini}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground leading-tight truncate">
          {member.fullName}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Class of {member.classYear}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className={`text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full border ${PROGRAM_COLORS[member.program] ?? "bg-muted text-muted-foreground border-border"}`}
          >
            {fmtProgram(member.program)}
          </span>
        </div>
        <a
          href={`mailto:${member.email}`}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
        >
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{member.email}</span>
        </a>
      </div>
    </div>
  );
}

function MemberCardSkeleton() {
  return (
    <div className="bg-card border border-border/60 p-4 flex gap-4 items-start">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

// ─── filter bar ──────────────────────────────────────────────────────────────

type ProgramFilter = "all" | "full_time" | "evening";
type YearFilter = "all" | number;

interface FilterBarProps {
  query: string;
  onQuery: (v: string) => void;
  program: ProgramFilter;
  onProgram: (v: ProgramFilter) => void;
  year: YearFilter;
  onYear: (v: YearFilter) => void;
  years: number[];
}

function FilterBar({ query, onQuery, program, onProgram, year, onYear, years }: FilterBarProps) {
  const programOptions: { label: string; value: ProgramFilter }[] = [
    { label: "All", value: "all" },
    { label: "Full-time", value: "full_time" },
    { label: "Evening", value: "evening" },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {programOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onProgram(opt.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              program === opt.value
                ? "bg-primary text-white border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onYear("all")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
            year === "all"
              ? "bg-primary text-white border-primary"
              : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          All years
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onYear(y)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              year === y
                ? "bg-primary text-white border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Directory() {
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState<ProgramFilter>("all");
  const [year, setYear] = useState<YearFilter>("all");

  const { data: members, isLoading } = useListDirectoryMembers({});

  const years = useMemo(() => {
    if (!members) return [];
    return [...new Set(members.map((m) => m.classYear))].sort();
  }, [members]);

  const filtered = useMemo(() => {
    if (!members) return [];
    let list = members;

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      );
    }
    if (program !== "all") list = list.filter((m) => m.program === program);
    if (year !== "all") list = list.filter((m) => m.classYear === year);

    return list;
  }, [members, query, program, year]);

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

      <section className="mb-10 max-w-3xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          Student Directory
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-foreground">
          Your{" "}
          <em className="italic font-light text-primary">cohort</em>, all in one
          place.
        </h1>
        <p className="mt-5 text-base text-muted-foreground leading-relaxed">
          Browse and search all {members?.length ?? "—"} enrolled MBAA students
          across the Full-time and Evening programs.
        </p>
      </section>

      <div className="space-y-5">
        <FilterBar
          query={query}
          onQuery={setQuery}
          program={program}
          onProgram={setProgram}
          year={year}
          onYear={setYear}
          years={years}
        />

        {/* count row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {isLoading ? (
            <Skeleton className="h-3 w-24" />
          ) : (
            <span>
              {filtered.length === members?.length
                ? `${members.length} members`
                : `${filtered.length} of ${members?.length} members`}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60">
            {Array.from({ length: 12 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/60">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No members match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60">
            {filtered.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
