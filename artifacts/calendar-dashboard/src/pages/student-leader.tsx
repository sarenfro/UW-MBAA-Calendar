import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Award, Star, Users, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetStudentLeaderCurrent,
  useListStudentLeaderHistory,
  useSubmitStudentLeaderNomination,
  type NominationResponse,
} from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  nominations_open: "Nominations Open",
  nominations_closed: "Voting in Progress",
  announced: "Winner Announced",
};

const CLASS_OPTIONS = ["FT 2027", "FT 2028"];

// ─── Nomination form ──────────────────────────────────────────────────────────

interface NominationFormProps {
  quarter: string;
}

function NominationForm({ quarter }: NominationFormProps) {
  const [form, setForm] = useState({
    nominatorName: "",
    nominatorEmail: "",
    nominatorClass: "",
    nomineeName: "",
    nomineeClass: "",
    leadershipReason: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitted, setSubmitted] = useState<NominationResponse | null>(null);

  const mutation = useSubmitStudentLeaderNomination({
    mutation: {
      onSuccess: (data) => setSubmitted(data),
    },
  });

  function validate() {
    const e: typeof errors = {};
    if (!form.nominatorName.trim()) e.nominatorName = "Required";
    if (!form.nominatorEmail.trim()) e.nominatorEmail = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.nominatorEmail)) e.nominatorEmail = "Enter a valid email";
    if (!form.nomineeName.trim()) e.nomineeName = "Required";
    if (!form.nomineeClass) e.nomineeClass = "Required";
    if (!form.leadershipReason.trim()) e.leadershipReason = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      data: {
        nominatorName: form.nominatorName.trim(),
        nominatorEmail: form.nominatorEmail.trim(),
        nominatorClass: form.nominatorClass || undefined,
        nomineeName: form.nomineeName.trim(),
        nomineeClass: form.nomineeClass,
        leadershipReason: form.leadershipReason.trim(),
      },
    });
  }

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  }

  // ── Confirmation ────────────────────────────────────────────────────────────
  if (submitted) {
    const nominatorFirst = submitted.nominatorName.split(" ")[0];
    const nomineeFirst = submitted.nomineeName.split(" ")[0];
    return (
      <div className="border border-emerald-200 bg-emerald-50/60 p-8 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <p className="font-serif text-2xl tracking-tight text-emerald-900">
            Nomination submitted
          </p>
        </div>
        <p className="text-sm text-emerald-800 leading-relaxed max-w-lg">
          Thanks, {nominatorFirst}. Your nomination for{" "}
          <span className="font-semibold">{submitted.nomineeName}</span> has been
          submitted. The MBAA leadership team will review nominations after the
          quarter closes and announce the recipients at the next all-MBA event.
          All nominees are notified that they were nominated, even if they aren't
          selected, so {nomineeFirst} will know you recognized them.
        </p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Intro */}
      <div className="border-l-2 border-primary/30 pl-4 text-sm text-muted-foreground leading-relaxed">
        Each quarter, the Foster MBA Association recognizes one student from each
        full-time class who has made a positive impact on our community and
        demonstrated the core values of Foster. Anyone can submit a nomination,
        and the nominee doesn't need to hold a formal leadership role. Nominations
        for{" "}
        <span className="font-medium text-foreground">[{quarter}]</span> close on{" "}
        <span className="font-medium text-foreground">[date]</span> at{" "}
        <span className="font-medium text-foreground">[time]</span>.
      </div>

      {/* Nominator section */}
      <div className="space-y-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          About you
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="nominatorName" className="text-sm font-medium">
            Your full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nominatorName"
            value={form.nominatorName}
            onChange={(e) => set("nominatorName", e.target.value)}
            placeholder="Jane Smith"
            className={`rounded-sm h-9 text-sm border-border/60 ${errors.nominatorName ? "border-destructive" : ""}`}
          />
          {errors.nominatorName ? (
            <p className="text-xs text-destructive">{errors.nominatorName}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Nominations are attributed, so the nominee will see who nominated them.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nominatorEmail" className="text-sm font-medium">
            Your email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nominatorEmail"
            type="email"
            value={form.nominatorEmail}
            onChange={(e) => set("nominatorEmail", e.target.value)}
            placeholder="jsmith@uw.edu"
            className={`rounded-sm h-9 text-sm border-border/60 ${errors.nominatorEmail ? "border-destructive" : ""}`}
          />
          {errors.nominatorEmail ? (
            <p className="text-xs text-destructive">{errors.nominatorEmail}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              We'll send a confirmation here once your nomination is received.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nominatorClass" className="text-sm font-medium">
            Your class{" "}
            <span className="text-muted-foreground/60 font-normal">(optional)</span>
          </Label>
          <Select value={form.nominatorClass} onValueChange={(v) => set("nominatorClass", v)}>
            <SelectTrigger id="nominatorClass" className="rounded-sm h-9 text-sm border-border/60 w-48">
              <SelectValue placeholder="Select class…" />
            </SelectTrigger>
            <SelectContent>
              {CLASS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Nominee section */}
      <div className="space-y-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          About your nominee
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="nomineeName" className="text-sm font-medium">
            Nominee's full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nomineeName"
            value={form.nomineeName}
            onChange={(e) => set("nomineeName", e.target.value)}
            placeholder="Alex Johnson"
            className={`rounded-sm h-9 text-sm border-border/60 ${errors.nomineeName ? "border-destructive" : ""}`}
          />
          {errors.nomineeName ? (
            <p className="text-xs text-destructive">{errors.nomineeName}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Please use their full name as it appears in the Foster directory. You
              can't nominate yourself.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nomineeClass" className="text-sm font-medium">
            Which class is this person in? <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.nomineeClass}
            onValueChange={(v) => set("nomineeClass", v)}
          >
            <SelectTrigger
              id="nomineeClass"
              className={`rounded-sm h-9 text-sm border-border/60 w-48 ${errors.nomineeClass ? "border-destructive" : ""}`}
            >
              <SelectValue placeholder="Select class…" />
            </SelectTrigger>
            <SelectContent>
              {CLASS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.nomineeClass && (
            <p className="text-xs text-destructive">{errors.nomineeClass}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="leadershipReason" className="text-sm font-medium">
            How was this student a great leader? Any other comments?{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="leadershipReason"
            value={form.leadershipReason}
            onChange={(e) => set("leadershipReason", e.target.value)}
            rows={6}
            placeholder="Tell us what they did, who it helped, and why it mattered…"
            className={`rounded-sm text-sm border-border/60 resize-none ${errors.leadershipReason ? "border-destructive" : ""}`}
          />
          {errors.leadershipReason ? (
            <p className="text-xs text-destructive">{errors.leadershipReason}</p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Specific stories and examples carry more weight than general praise.
              What did they do, who did it help, and why did it matter? A few
              sentences is great, a few paragraphs is fine too. Please submit one
              nomination per person; if you want to recognize multiple classmates,
              submit a separate form for each.
            </p>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">
          Something went wrong. Please try again.
        </p>
      )}

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-sm font-semibold tracking-[0.14em] uppercase text-xs h-10 px-6"
      >
        {mutation.isPending ? "Submitting…" : "Submit nomination"}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentLeader() {
  const { data: current, isLoading } = useGetStudentLeaderCurrent();
  const { data: history } = useListStudentLeaderHistory();

  const isAnnounced = current?.status === "announced";
  const hasWinner = isAnnounced && !!current?.winnerName;
  const isNominationsOpen = current?.status === "nominations_open";

  return (
    <Layout>
      <div className="max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground hover:text-primary transition-colors mb-10"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Calendar
        </Link>

        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          Recognition
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight mb-3">
          Student Leader{" "}
          <em className="italic font-light text-primary">of the Quarter</em>
        </h1>
        <p className="text-base text-muted-foreground mb-12 max-w-xl leading-relaxed">
          Each quarter the MBAA recognizes one student leader who went above and
          beyond for the cohort.
        </p>

        {/* Current quarter spotlight */}
        <section className="mb-16">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : current ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                  {current.quarter}
                </p>
                <span
                  className={`text-[10px] font-semibold tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border ${
                    current.status === "announced"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : current.status === "nominations_closed"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-primary/5 text-primary border-primary/20"
                  }`}
                >
                  {STATUS_LABELS[current.status] ?? current.status}
                </span>
              </div>

              {hasWinner ? (
                <div className="border border-border/60 p-8 flex flex-col sm:flex-row gap-8">
                  {/* Photo / avatar */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-3">
                    {current.winnerPhotoUrl ? (
                      <img
                        src={current.winnerPhotoUrl}
                        alt={current.winnerName ?? "Winner"}
                        className="w-28 h-28 rounded-full object-cover border-2 border-primary/20"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <span className="font-serif text-3xl text-primary">
                          {(current.winnerName ?? "")
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="font-serif text-3xl tracking-tight leading-tight">
                        {current.winnerName}
                      </h2>
                      {(current.winnerClub || current.winnerProgram) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {[current.winnerClub, current.winnerProgram]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    {current.winnerBio && (
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {current.winnerBio}
                      </p>
                    )}

                    {current.reason && (
                      <blockquote className="border-l-2 border-primary/40 pl-4 italic text-sm text-muted-foreground leading-relaxed">
                        "{current.reason}"
                        {current.nominatedBy && (
                          <span className="block not-italic text-xs mt-1 text-muted-foreground/70">
                            — {current.nominatedBy}
                          </span>
                        )}
                      </blockquote>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border/60 p-12 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
                    {current.status === "nominations_open" ? (
                      <Users className="h-7 w-7 text-muted-foreground/50" />
                    ) : (
                      <Award className="h-7 w-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <div>
                    <p className="font-serif text-xl tracking-tight text-muted-foreground">
                      {current.status === "nominations_open"
                        ? "Nominations are open"
                        : current.status === "nominations_closed"
                        ? "Voting is in progress"
                        : "Announcement coming soon"}
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {current.status === "nominations_open"
                        ? `Submit your nominations for ${current.quarter} below.`
                        : `The ${current.quarter} winner will be revealed here shortly.`}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="border border-dashed border-border/60 p-12 flex flex-col items-center text-center gap-4">
              <Award className="h-7 w-7 text-muted-foreground/50" />
              <p className="font-serif text-xl tracking-tight text-muted-foreground">
                No active quarter yet
              </p>
            </div>
          )}
        </section>

        {/* Nomination form — only when nominations are open */}
        {isNominationsOpen && current && (
          <section className="mb-16">
            <div className="border-t border-border/60 pt-10 mb-8">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-3">
                Nominate
              </p>
              <h2 className="font-serif text-3xl md:text-4xl leading-[1.05] tracking-tight mb-2">
                Nominate a Student Leader{" "}
                <em className="italic font-light text-primary">of the Quarter</em>
              </h2>
              <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
                Recognize a classmate who made the Foster MBA community better this
                quarter.
              </p>
            </div>
            <NominationForm quarter={current.quarter} />
          </section>
        )}

        {/* Past winners */}
        <section>
          <div className="border-t border-border/60 pt-10">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-6">
              Past Recipients
            </p>
            <div className="divide-y divide-border/40">
              {!history || history.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 italic py-4">
                  No past recipients yet.
                </p>
              ) : (
                history.map((w) => (
                  <div key={w.id} className="py-4 flex items-center gap-4">
                    {w.winnerPhotoUrl ? (
                      <img
                        src={w.winnerPhotoUrl}
                        alt={w.winnerName ?? ""}
                        className="w-9 h-9 rounded-full object-cover border border-border/60 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-serif text-sm text-primary">
                          {(w.winnerName ?? "")
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{w.winnerName}</p>
                      {w.winnerClub && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {w.winnerClub}
                        </p>
                      )}
                    </div>
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-muted-foreground/60 shrink-0">
                      {w.quarter}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
