import { Link } from "wouter";
import { ArrowLeft, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function Membership() {
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

      <section className="max-w-4xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          The Cohort Roster
        </p>
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground">
          MBAA <em className="italic font-light text-primary">Membership</em>{" "}
          Records
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Dues, attendance, and committee assignments for the current cohort.
          Records sync from the MBAA officers' working sheet.
        </p>
      </section>

      <div className="mt-16 border-t border-border/60 pt-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-sm border border-border/60 mb-6">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
            Coming Soon
          </p>
          <h2 className="font-serif text-2xl md:text-3xl tracking-tight leading-tight">
            Membership records will live{" "}
            <em className="italic font-light text-primary">here</em>.
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We're wiring this page up next. Tell us what you'd like to see —
            dues paid, event attendance, committee rosters, contact info — and
            we'll build it out.
          </p>
        </div>
      </div>
    </Layout>
  );
}
