import { Link } from "wouter";
import { ArrowLeft, Award, Star, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetStudentLeaderCurrent,
  useListStudentLeaderHistory,
} from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  nominations_open: "Nominations Open",
  nominations_closed: "Voting in Progress",
  announced: "Winner Announced",
};

export default function StudentLeader() {
  const { data: current, isLoading } = useGetStudentLeaderCurrent();
  const { data: history } = useListStudentLeaderHistory();

  const isAnnounced = current?.status === "announced";
  const hasWinner = isAnnounced && !!current?.winnerName;

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
                <span className={`text-[10px] font-semibold tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border ${
                  current.status === "announced"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : current.status === "nominations_closed"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-primary/5 text-primary border-primary/20"
                }`}>
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
                        ? `Submit your nominations for ${current.quarter}.`
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
