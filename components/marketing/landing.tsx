"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Check,
  Compass,
  Gauge,
  MessageSquareText,
  Sparkles,
  Target,
  Trophy,
  Layers,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export function Landing({ isAuthed }: { isAuthed: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isAuthed={isAuthed} />
      <main className="flex-1">
        <Hero isAuthed={isAuthed} />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Pricing isAuthed={isAuthed} />
        <FinalCta isAuthed={isAuthed} />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Brand />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthed ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/library">Start practising</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]" />
      <div className="container grid gap-12 py-20 lg:grid-cols-2 lg:py-28">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="flex flex-col justify-center"
        >
          <Badge variant="secondary" className="mb-5 w-fit gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Duolingo for consulting guesstimates
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Crack guesstimates with an{" "}
            <span className="text-primary">AI interviewer</span>, not an answer key.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Practise India-focused market-sizing and demand cases interactively. Think aloud, build
            frameworks, defend your assumptions — and get McKinsey/BCG/Bain-style questioning and a
            detailed evaluation. No answers handed to you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={isAuthed ? "/dashboard" : "/library"}>
                {isAuthed ? "Go to dashboard" : "Try a guesstimate free"}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No card required. No login needed to try your first one.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Annual umbrella demand in Mumbai</div>
        <Badge variant="muted">⏱ 04:12</Badge>
      </div>
      <div className="space-y-3">
        <ChatBubble who="ai">
          Let&apos;s structure this before any numbers. What would you anchor your estimate on?
        </ChatBubble>
        <ChatBubble who="you">I&apos;ll start with Mumbai&apos;s population, ~2 crore.</ChatBubble>
        <ChatBubble who="ai">
          Good — but would everyone buy umbrellas the same way? How would you segment first?
        </ChatBubble>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Assumptions" value="3" />
        <MiniStat label="Framework" value="Population → …" />
        <MiniStat label="Status" value="In progress" />
      </div>
    </div>
  );
}

function ChatBubble({ who, children }: { who: "ai" | "you"; children: React.ReactNode }) {
  const isAi = who === "ai";
  return (
    <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
          isAi ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}

const STEPS = [
  {
    icon: Compass,
    title: "Pick a guesstimate",
    body: "Choose from India-only market-sizing and demand cases across 14 categories, difficulties and interview levels.",
  },
  {
    icon: MessageSquareText,
    title: "Think aloud with the AI",
    body: "Segment, assume, calculate and build your framework while the interviewer asks Socratic questions and nudges you.",
  },
  {
    icon: Gauge,
    title: "Get evaluated & improve",
    body: "Receive an 8-category scorecard, a readiness band, a better approach — and track your growth over time.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t bg-muted/30 py-20">
      <div className="container">
        <SectionHeading
          eyebrow="How it works"
          title="Practice like it's a real interview"
          subtitle="Three steps to turn guesswork into structured, defensible thinking."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="rounded-xl border bg-card p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="mb-1 text-sm font-medium text-muted-foreground">Step {i + 1}</div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Brain, title: "Socratic AI interviewer", body: "Four modes — Interviewer, Coach, Teacher, Evaluator. It questions and guides, never spoon-feeds." },
  { icon: Layers, title: "Framework builder", body: "Drag-and-arrange your estimation chain: population → segmentation → frequency → final estimate." },
  { icon: Target, title: "Assumption ratings", body: "Every assumption is rated Reasonable / Weak / Excellent with a note, so you learn to justify numbers." },
  { icon: Gauge, title: "8-category evaluation", body: "Structuring, segmentation, assumptions, calculation, communication, business sense and more." },
  { icon: MessageSquareText, title: "3-level hints", body: "Stuck? Escalating hints nudge you — the full answer stays hidden until you've truly engaged." },
  { icon: Trophy, title: "Progress & rank", body: "XP, streaks, achievements and a percentile Silver→Diamond rank as you get interview-ready." },
];

function Features() {
  return (
    <section id="features" className="py-20">
      <div className="container">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to get interview-ready"
          subtitle="Built to feel like a consultant sitting across the table from you."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { quote: "It actually made me defend my assumptions instead of just reading a solved PDF. Felt like a real BCG round.", name: "Ananya R.", role: "MBA, IIM-A" },
  { quote: "The framework builder + hints combo is brilliant. I stopped freezing on market-sizing.", name: "Karthik S.", role: "PM aspirant" },
  { quote: "Loved that everything is India-context. Numbers finally felt intuitive.", name: "Meera J.", role: "Strategy hopeful" },
];

function Testimonials() {
  return (
    <section className="border-t bg-muted/30 py-20">
      <div className="container">
        <SectionHeading
          eyebrow="Loved by learners"
          title="From guesswork to structured thinking"
          subtitle="Placeholder testimonials — swap for real ones as they come in."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border bg-card p-6"
            >
              <blockquote className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground"> · {t.role}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    features: ["Unlimited practice", "Guesstimates and cases", "AI interviewer + hints", "Scored evaluation & feedback", "Progress tracking & streaks"],
    cta: "Start free",
    href: "/library",
    highlight: false,
    // Everything the app does today is in this plan.
    planned: false,
  },
  {
    name: "Pro",
    price: "₹499",
    period: "per month",
    features: ["Everything in Free", "Advanced analytics", "Mock interview sessions", "Company-specific sets", "Priority AI evaluations", "Interview readiness reports"],
    cta: "Not available yet",
    href: "/library",
    highlight: true,
    /**
     * No payments are wired up. The card stays because it's the product's
     * intended shape, but it must not read as purchasable — the button used to
     * say "Go Pro" and quietly drop you into a free signup.
     */
    planned: true,
  },
];

function Pricing({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section id="pricing" className="py-20">
      <div className="container">
        <SectionHeading
          eyebrow="Pricing"
          title="Everything is free."
          subtitle="Every question is free to practise. Pro is what's planned next — it isn't purchasable yet."
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative rounded-2xl border bg-card p-8",
                p.highlight && "border-primary shadow-lg ring-1 ring-primary/20",
              )}
            >
              {p.planned && (
                <Badge variant="muted" className="absolute -top-3 left-8">Planned</Badge>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {p.planned ? (
                <Button className="mt-8 w-full" variant="outline" disabled>
                  {p.cta}
                </Button>
              ) : (
                <Button asChild className="mt-8 w-full">
                  <Link href={isAuthed ? "/dashboard" : p.href}>{p.cta}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="border-t py-20">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border bg-primary px-8 py-16 text-center text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_0%,rgba(255,255,255,0.15),transparent)]" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your first guesstimate is one click away.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            No account needed to start. Think aloud, get guided, and become interview-ready.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link href={isAuthed ? "/dashboard" : "/library"}>
              {isAuthed ? "Go to dashboard" : "Practise now, free"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Brand />
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} EstimateIQ · Built for MBA interview prep.
        </p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
