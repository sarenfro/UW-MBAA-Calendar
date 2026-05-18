import { Link } from "wouter";
import { ArrowLeft, Award, Star } from "lucide-react";
import { Layout } from "@/components/layout";

const CURRENT_QUARTER = "Spring 2026";

const WINNER = {
  name: "TBD",
  club: "",
  program: "",
  bio: "",
  nominated_by: "",
  reason: "",
};

const PAST_WINNERS = [
  { quarter: "Winter 2026", name: "TBD", club: "" },
];

export default function StudentLeader() {
  const hasWinner = !!WINNER.name && WINNER.name !== "TBD";

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

        {/* Current winner spotlight */}
        <section className="mb-16">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-6">
            {CURRENT_QUARTER}
          </p>

          {hasWinner ? (
            <div className="border border-border/60 p-8 flex flex-col sm:flex-row gap-8">
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <span className="font-serif text-3xl text-primary">
                    {WINNER.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="font-serif text-3xl tracking-tight leading-tight">
                    {WINNER.name}
                  </h2>
                  {WINNER.club && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {WINNER.club}
                      {WINNER.program && ` · ${WINNER.program}`}
                    </p>
                  )}
                </div>

                {WINNER.bio && (
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {WINNER.bio}
                  </p>
                )}

                {WINNER.reason && (
                  <blockquote className="border-l-2 border-primary/40 pl-4 italic text-sm text-muted-foreground leading-relaxed">
                    "{WINNER.reason}"
                    {WINNER.nominated_by && (
                      <span className="block not-italic text-xs mt-1 text-muted-foreground/70">
                        — {WINNER.nominated_by}
                      </span>
                    )}
                  </blockquote>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border/60 p-12 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
                <Award className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-serif text-xl tracking-tight text-muted-foreground">
                  Announcement coming soon
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  The {CURRENT_QUARTER} winner will be revealed here.
                </p>
              </div>
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
              {PAST_WINNERS.filter((w) => w.name && w.name !== "TBD").length ===
              0 ? (
                <p className="text-sm text-muted-foreground/60 italic py-4">
                  No past recipients yet.
                </p>
              ) : (
                PAST_WINNERS.filter((w) => w.name && w.name !== "TBD").map(
                  (w) => (
                    <div
                      key={w.quarter}
                      className="py-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{w.name}</p>
                        {w.club && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {w.club}
                          </p>
                        )}
                      </div>
                      <p className="text-xs font-semibold tracking-[0.14em] uppercase text-muted-foreground/60">
                        {w.quarter}
                      </p>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
