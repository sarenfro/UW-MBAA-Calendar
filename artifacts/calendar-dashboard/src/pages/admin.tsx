import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Trash2, Plus, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  useListClubs,
  useListClubLeads,
  getListClubLeadsQueryKey,
  useAddClubLead,
  useRemoveClubLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

export default function Admin() {
  const { data: clubs, isLoading: clubsLoading } = useListClubs();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedClub = clubs?.find((c) => c.slug === selectedSlug);

  return (
    <Layout>
      <Button
        variant="ghost"
        asChild
        className="mb-10 -ml-3 text-muted-foreground hover:text-primary text-xs font-semibold tracking-[0.18em] uppercase"
      >
        <Link href="/membership">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back to Membership
        </Link>
      </Button>

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
          Designate which members can request magic-link access to a club's
          roster. Only members already in the roster database can be added as
          leads.
        </p>
      </section>

      <Separator className="mb-10" />

      <div className="max-w-3xl space-y-10">
        <div>
          <SectionLabel>Select a club</SectionLabel>
          {clubsLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select onValueChange={(v) => setSelectedSlug(v)}>
              <SelectTrigger className="w-64 rounded-sm h-9 text-sm border-border/60">
                <SelectValue placeholder="Choose a club…" />
              </SelectTrigger>
              <SelectContent>
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
            <SectionLabel>
              Leads — {selectedClub.name}
            </SectionLabel>
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
      </div>
    </Layout>
  );
}
