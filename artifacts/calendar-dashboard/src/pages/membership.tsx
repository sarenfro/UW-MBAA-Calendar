import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Search, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useListMembers,
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
  getListMembersQueryKey,
} from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";

const TRACKS = [
  "Finance",
  "Marketing",
  "General Management",
  "Entrepreneurship",
  "Operations & Supply Chain",
  "Strategy & Leadership",
  "Technology & Analytics",
] as const;

const COMMITTEES = [
  "Events Committee",
  "Finance Committee",
  "Recruiting Committee",
  "Social Committee",
  "Community Service",
  "Alumni Relations",
  "Tech Committee",
  "EVCC Liaison",
] as const;

const GRAD_YEARS = [2025, 2026, 2027, 2028] as const;

const addMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Must be a valid email"),
  graduationYear: z.coerce.number().int().min(2020).max(2035),
  track: z.string().optional(),
  committee: z.string().optional(),
  duesPaid: z.boolean().default(false),
  notes: z.string().optional(),
});
type AddMemberForm = z.infer<typeof addMemberSchema>;

type DuesFilter = "all" | "paid" | "unpaid";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="border border-border/60 p-6">
      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
        {label}
      </p>
      <p
        className={
          "font-serif text-4xl tracking-tight leading-none" +
          (accent ? " text-primary" : " text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function DuesBadge({
  paid,
  memberId,
  onToggle,
  isPending,
}: {
  paid: boolean;
  memberId: number;
  onToggle: (id: number, val: boolean) => void;
  isPending: boolean;
}) {
  return (
    <button
      onClick={() => onToggle(memberId, !paid)}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 cursor-pointer group"
      title={paid ? "Mark as unpaid" : "Mark as paid"}
    >
      {paid ? (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors gap-1 font-medium text-[11px] tracking-wider uppercase">
          <Check className="h-3 w-3" />
          Paid
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-amber-700 border-amber-300 hover:bg-amber-50 transition-colors gap-1 font-medium text-[11px] tracking-wider uppercase"
        >
          <X className="h-3 w-3" />
          Unpaid
        </Badge>
      )}
    </button>
  );
}

export default function Membership() {
  const [search, setSearch] = useState("");
  const [duesFilter, setDuesFilter] = useState<DuesFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const queryClient = useQueryClient();

  const { data: members, isLoading, error } = useListMembers();

  const updateMember = useUpdateMember({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }),
    },
  });

  const createMember = useCreateMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        setAddOpen(false);
        form.reset();
      },
    },
  });

  const deleteMember = useDeleteMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        setDeleteTarget(null);
      },
    },
  });

  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      graduationYear: 2026,
      track: undefined,
      committee: undefined,
      duesPaid: false,
      notes: "",
    },
  });

  const filtered = useMemo(() => {
    let list = members ?? [];
    if (duesFilter === "paid") list = list.filter((m) => m.duesPaid);
    if (duesFilter === "unpaid") list = list.filter((m) => !m.duesPaid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.track ?? "").toLowerCase().includes(q) ||
          (m.committee ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [members, search, duesFilter]);

  const stats = useMemo(() => {
    const total = members?.length ?? 0;
    const paid = members?.filter((m) => m.duesPaid).length ?? 0;
    return { total, paid, unpaid: total - paid };
  }, [members]);

  function handleDuesToggle(id: number, duesPaid: boolean) {
    updateMember.mutate({ id, data: { duesPaid } });
  }

  function onSubmitAdd(values: AddMemberForm) {
    createMember.mutate({
      data: {
        name: values.name,
        email: values.email,
        graduationYear: values.graduationYear,
        track: values.track || undefined,
        committee: values.committee || undefined,
        duesPaid: values.duesPaid,
        notes: values.notes || undefined,
      },
    });
  }

  const filterTabs: { label: string; value: DuesFilter }[] = [
    { label: "All", value: "all" },
    { label: "Paid", value: "paid" },
    { label: "Unpaid", value: "unpaid" },
  ];

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
          The Cohort Roster
        </p>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground">
          MBAA <em className="italic font-light text-primary">Membership</em>{" "}
          Records
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Dues status, committee assignments, and contact info for the current
          cohort.
        </p>
      </section>

      <div className="grid grid-cols-3 gap-px border border-border/60 mb-12">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 border border-border/60">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Members" value={stats.total} />
            <StatCard label="Dues Paid" value={stats.paid} accent />
            <StatCard label="Outstanding" value={stats.unpaid} />
          </>
        )}
      </div>

      <div className="border-t border-border/60 pt-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1 border border-border/60 p-0.5 w-fit">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setDuesFilter(tab.value)}
                className={
                  "px-4 py-1.5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors" +
                  (duesFilter === tab.value
                    ? " bg-primary text-primary-foreground"
                    : " text-muted-foreground hover:text-foreground")
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roster…"
                className="pl-9 h-9 text-sm w-56 rounded-sm border-border/60"
              />
            </div>
            <Button
              onClick={() => setAddOpen(true)}
              size="sm"
              className="rounded-sm font-semibold tracking-wider uppercase text-xs h-9 px-4 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Member
            </Button>
          </div>
        </div>

        {isLoading ? (
          <RosterSkeleton />
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
              Error
            </p>
            <p className="font-serif text-2xl text-foreground">
              Could not load membership records.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border border-border/60 border-dashed">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
              {search || duesFilter !== "all" ? "No matches" : "No members yet"}
            </p>
            <p className="font-serif text-2xl text-foreground">
              {search || duesFilter !== "all"
                ? "Try a different search or filter."
                : "Add the first member to get started."}
            </p>
          </div>
        ) : (
          <div className="border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden md:table-cell">
                    Track
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden lg:table-cell">
                    Committee
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3 hidden sm:table-cell">
                    Grad Year
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground py-3">
                    Dues
                  </TableHead>
                  <TableHead className="py-3 w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow
                    key={member.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                  >
                    <TableCell className="py-3.5">
                      <div>
                        <p className="font-medium text-sm text-foreground leading-snug">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {member.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 hidden md:table-cell">
                      <p className="text-sm text-foreground/80">
                        {member.track ?? (
                          <span className="text-muted-foreground/60 italic">
                            —
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="py-3.5 hidden lg:table-cell">
                      <p className="text-sm text-foreground/80">
                        {member.committee ?? (
                          <span className="text-muted-foreground/60 italic">
                            —
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="py-3.5 hidden sm:table-cell">
                      <p className="text-sm text-foreground/80 font-mono">
                        {member.graduationYear}
                      </p>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <DuesBadge
                        paid={member.duesPaid}
                        memberId={member.id}
                        onToggle={handleDuesToggle}
                        isPending={updateMember.isPending}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <button
                        onClick={() => setDeleteTarget(member)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md rounded-sm">
          <DialogHeader>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-1">
              New Member
            </p>
            <DialogTitle className="font-serif text-2xl tracking-tight font-normal">
              Add to the{" "}
              <em className="italic font-light text-primary">roster</em>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmitAdd)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  {...form.register("name")}
                  placeholder="Sarah Renfro"
                  className="rounded-sm h-9"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Email
                </Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder="you@uw.edu"
                  className="rounded-sm h-9"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Grad Year
                </Label>
                <Select
                  onValueChange={(v) =>
                    form.setValue("graduationYear", parseInt(v, 10))
                  }
                  defaultValue="2026"
                >
                  <SelectTrigger className="rounded-sm h-9 text-sm">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAD_YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Track
                </Label>
                <Select
                  onValueChange={(v) => form.setValue("track", v)}
                >
                  <SelectTrigger className="rounded-sm h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Committee
                </Label>
                <Select
                  onValueChange={(v) => form.setValue("committee", v)}
                >
                  <SelectTrigger className="rounded-sm h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMITTEES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Any additional notes…"
                  className="rounded-sm text-sm resize-none h-16"
                />
              </div>

              <div className="col-span-2 flex items-center gap-2.5">
                <Checkbox
                  id="duesPaid"
                  checked={form.watch("duesPaid")}
                  onCheckedChange={(checked) =>
                    form.setValue("duesPaid", !!checked)
                  }
                  className="rounded-sm"
                />
                <Label
                  htmlFor="duesPaid"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Dues paid
                </Label>
              </div>
            </div>

            {createMember.error && (
              <p className="text-xs text-destructive">
                {String(createMember.error)}
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(false)}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMember.isPending}
                className="rounded-sm font-semibold tracking-wider uppercase text-xs"
              >
                {createMember.isPending ? "Adding…" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl tracking-tight font-normal">
              Remove{" "}
              <em className="italic font-light text-primary">
                {deleteTarget?.name}
              </em>{" "}
              from the roster?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              This will permanently delete their record, including dues status
              and committee assignment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm text-xs font-semibold tracking-wider uppercase">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMember.mutate({ id: deleteTarget.id })
              }
              disabled={deleteMember.isPending}
              className="rounded-sm bg-destructive hover:bg-destructive/90 text-xs font-semibold tracking-wider uppercase"
            >
              {deleteMember.isPending ? "Removing…" : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
