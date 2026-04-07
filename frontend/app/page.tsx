"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Brain,
  CircleDashed,
  ClipboardCheck,
  Database,
  FileSearch,
  GitBranch,
  HeartPulse,
  Layers3,
  LogIn,
  Orbit,
  MessageSquareMore,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { MetricInfoTooltip } from "@/components/MetricInfoTooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const walkthroughStages = [
  {
    id: "interview",
    label: "Interview",
    phase: "01",
    title: "Interview agent clarifies the intake.",
    copy: "It starts from the symptom story and asks only the follow-up questions needed to make the case clearer.",
    tooltip:
      "The interview stage keeps the original symptom narrative attached to every answer, so later reasoning still points back to the same clinical story.",
    icon: MessageSquareMore,
    chip: "Clarifying intake",
    accentText: "text-cyan-700 dark:text-cyan-300",
    accentBg: "bg-cyan-500/10",
    accentBorder: "border-cyan-500/20",
    accentDot: "bg-cyan-400",
    summary: "The workspace shows the presenting symptoms, the next follow-up question, and the refined case context in one place.",
    story: [
      { label: "Starts with", value: "Presenting symptoms" },
      { label: "Agent action", value: "Targeted follow-up" },
      { label: "Shows next", value: "Structured case context" },
    ],
    surfaces: ["Presenting symptoms", "Follow-up questions", "Case summary"],
  },
  {
    id: "hypothesis",
    label: "Hypothesis",
    phase: "02",
    title: "Hypothesis agent ranks the likely paths.",
    copy: "It turns the clarified case into a working differential so retrieval can focus on the most relevant diagnoses first.",
    tooltip:
      "This stage builds an early ranked differential before evidence retrieval, which keeps the search targeted instead of broad and generic.",
    icon: Brain,
    chip: "Ranking differentials",
    accentText: "text-emerald-700 dark:text-emerald-300",
    accentBg: "bg-emerald-500/10",
    accentBorder: "border-emerald-500/18",
    accentDot: "bg-emerald-400",
    summary: "The user sees which diagnoses are currently leading, why they are being considered, and what evidence will be gathered next.",
    story: [
      { label: "Starts with", value: "Clarified case" },
      { label: "Agent action", value: "Ranks differentials" },
      { label: "Shows next", value: "Leading diagnoses" },
    ],
    surfaces: ["Differential list", "Confidence ordering", "Why these paths"],
  },
  {
    id: "evidence",
    label: "Evidence",
    phase: "03",
    title: "Evidence agent retrieves and compares support.",
    copy: "It gathers grounded medical support, then shows what strengthens or weakens each likely diagnosis.",
    tooltip:
      "Retrieved evidence is compared against the active differential, with supporting and contradicting signals kept visible rather than hidden behind a score.",
    icon: FileSearch,
    chip: "Reviewing evidence",
    accentText: "text-sky-700 dark:text-sky-300",
    accentBg: "bg-sky-500/10",
    accentBorder: "border-sky-500/18",
    accentDot: "bg-sky-400",
    summary: "The workspace keeps source-backed evidence beside the differential so the recommendation can be inspected before it is trusted.",
    story: [
      { label: "Starts with", value: "Ranked differential" },
      { label: "Agent action", value: "Retrieves support" },
      { label: "Shows next", value: "Evidence side by side" },
    ],
    surfaces: ["Supporting sources", "Contradictions", "Retrieved excerpts"],
  },
  {
    id: "critic",
    label: "Critic",
    phase: "04",
    title: "Critic agent checks for weak reasoning.",
    copy: "It looks for missing evidence, contradictions, and overconfident jumps before anything is handed off as final.",
    tooltip:
      "The critic stage can send the case back through another pass if it sees weak support, missing caveats, or a reasoning gap that should be revisited.",
    icon: GitBranch,
    chip: "Running critique",
    accentText: "text-amber-700 dark:text-amber-300",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/18",
    accentDot: "bg-amber-400",
    summary: "The user sees what the system is uncertain about, what may need another pass, and where the reasoning could break.",
    story: [
      { label: "Starts with", value: "Evidence-backed draft" },
      { label: "Agent action", value: "Challenges weak spots" },
      { label: "Shows next", value: "Critique + loop decision" },
    ],
    surfaces: ["Critique summary", "Loop-back decision", "Open limitations"],
  },
  {
    id: "decision",
    label: "Decision",
    phase: "05",
    title: "Decision agent assembles the clinical brief.",
    copy: "It turns the ranked differential, supporting evidence, and caveats into the decision view the clinician actually reviews.",
    tooltip:
      "The decision stage does not replace the evidence trail. It packages the final ranked assessment while keeping supporting rationale and caveats visible.",
    icon: ClipboardCheck,
    chip: "Preparing brief",
    accentText: "text-teal-700 dark:text-teal-300",
    accentBg: "bg-teal-500/10",
    accentBorder: "border-teal-500/18",
    accentDot: "bg-teal-400",
    summary: "The final output stays tied to the differential, retrieved evidence, and critic notes instead of appearing as a single opaque answer.",
    story: [
      { label: "Starts with", value: "Reviewed draft" },
      { label: "Agent action", value: "Builds final brief" },
      { label: "Shows next", value: "Decision summary" },
    ],
    surfaces: ["Ranked diagnoses", "Caveats + tests", "Assessment summary"],
  },
  {
    id: "memory",
    label: "Memory",
    phase: "06",
    title: "Memory agent links the visit to history.",
    copy: "It stores patient-linked context so future cases can reuse prior assessments, patterns, and visit history.",
    tooltip:
      "The memory stage connects the current visit to prior patient context, which helps future assessments start with more continuity and less repeated intake.",
    icon: Database,
    chip: "Updating memory",
    accentText: "text-violet-700 dark:text-violet-300",
    accentBg: "bg-violet-500/10",
    accentBorder: "border-violet-500/18",
    accentDot: "bg-violet-400",
    summary: "The workspace shows what gets retained for the patient so the next case can start with useful historical context already attached.",
    story: [
      { label: "Starts with", value: "Completed visit" },
      { label: "Agent action", value: "Links patient memory" },
      { label: "Shows next", value: "Reusable history" },
    ],
    surfaces: ["Prior visits", "Patient timeline", "Reusable context"],
  },
];

export default function LandingPage() {
  const shouldReduceMotion = useReducedMotion();
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setActiveStageIndex((current) => (current + 1) % walkthroughStages.length);
    }, 3600);

    return () => window.clearInterval(interval);
  }, [shouldReduceMotion]);

  const scrollToHowItWorks = () => {
    document.getElementById("workspace-story")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  };

  const activeStage = walkthroughStages[activeStageIndex];
  const ActiveStageIcon = activeStage.icon;
  const progressWidth = `${18 + ((activeStageIndex + 1) / walkthroughStages.length) * 72}%`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 shrink-0 px-4 py-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="topbar-surface topbar-shell mx-auto flex h-[86px] w-full max-w-[2040px] items-center gap-4 rounded-[30px] px-5 lg:px-7"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <motion.div
              className="brand-mark relative flex h-12 w-12 items-center justify-center rounded-[20px]"
              animate={shouldReduceMotion ? undefined : { boxShadow: ["0 16px 38px oklch(0.45 0.05 220 / 12%)", "0 18px 44px oklch(0.48 0.06 220 / 18%)", "0 16px 38px oklch(0.45 0.05 220 / 12%)"] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                className="absolute inset-1 rounded-[16px] border border-primary/10"
                animate={shouldReduceMotion ? undefined : { opacity: [0.18, 0.42, 0.18], scale: [0.96, 1.02, 0.96] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <Activity className="relative z-10 h-5 w-5 text-primary" />
            </motion.div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="truncate text-[21px] font-semibold leading-none tracking-[-0.045em] text-foreground">
                  Clinical Decision Support System
                </h1>
                <div className="premium-pill hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/90 md:inline-flex">
                  <Sparkles className="h-3 w-3" />
                  Multi-agent
                </div>
              </div>
              <p className="mt-1 truncate text-[13px] leading-none text-muted-foreground/78">
                Diagnostic workspace with live reasoning, grounded evidence, and patient-linked memory
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2.5 xl:flex">
            <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium">
              <span className="status-dot text-emerald-400" />
              Workspace ready
            </div>
            <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium">
              <Orbit className="h-3.5 w-3.5 text-emerald-500" />
              Live reasoning loop
            </div>
            <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium">
              <Brain className="h-3.5 w-3.5 text-primary" />
              LangGraph workflow
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            {!authLoading && (
              <Link
                href={user ? "/assessment" : "/login"}
                className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
              >
                {user ? (
                  <>Go to Assessment<ArrowRight className="h-3.5 w-3.5" /></>
                ) : (
                  <>Sign in<LogIn className="h-3.5 w-3.5" /></>
                )}
              </Link>
            )}
          </div>
        </motion.div>
      </header>

      <main className="relative overflow-hidden px-5 py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[5rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/12 blur-[120px]" />
          <div className="absolute right-[-10rem] top-[8rem] h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-[130px]" />
          <div className="absolute left-[40%] bottom-[-14rem] h-[30rem] w-[30rem] rounded-full bg-sky-500/8 blur-[130px]" />
          <motion.div
            className="absolute left-[8%] top-[12%] h-28 w-28 rounded-full border border-cyan-400/12"
            animate={shouldReduceMotion ? undefined : { y: [0, -10, 0], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[12%] top-[22%] h-20 w-20 rounded-full border border-emerald-400/12"
            animate={shouldReduceMotion ? undefined : { y: [0, 12, 0], x: [0, -6, 0], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          />
          <motion.div
            className="absolute left-[18%] top-[7rem] hidden h-px w-[26rem] bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent xl:block"
            animate={shouldReduceMotion ? undefined : { opacity: [0.18, 0.5, 0.18], scaleX: [0.94, 1.04, 0.94] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[14%] top-[28rem] hidden h-[10rem] w-[10rem] rounded-full border border-border/20 xl:block"
            animate={shouldReduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.18, 0.34, 0.18] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="relative mx-auto flex w-full max-w-[2040px] flex-col gap-8">
          <section className="hero-surface relative overflow-hidden rounded-[40px] px-6 py-12 sm:px-8 sm:py-14 xl:px-14 xl:py-16 2xl:px-18 2xl:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.72_0.09_220_/_0.16),transparent_28%),radial-gradient(circle_at_85%_20%,oklch(0.7_0.08_180_/_0.10),transparent_24%),radial-gradient(circle_at_18%_80%,oklch(0.72_0.05_220_/_0.06),transparent_24%)]" />

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto flex max-w-[980px] flex-col items-center text-center"
            >
              <motion.div
                className="pointer-events-none absolute -top-10 left-1/2 hidden h-28 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[60px] xl:block"
                animate={shouldReduceMotion ? undefined : { opacity: [0.45, 0.7, 0.45], scaleX: [0.96, 1.03, 0.96] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="mb-7 flex flex-wrap justify-center gap-2.5"
              >
                <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-primary">
                  <HeartPulse className="h-3.5 w-3.5" />
                  High-trust diagnostic workspace
                </div>
                <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium">
                  <ScanSearch className="h-3.5 w-3.5 text-emerald-500" />
                  Live reasoning, evidence, and memory
                </div>
              </motion.div>

              <div className="flex flex-col items-center">
                <h2 className="max-w-[12ch] text-[54px] font-semibold leading-[0.92] tracking-[-0.08em] text-foreground sm:max-w-[13ch] sm:text-[70px] xl:max-w-[14ch] xl:text-[84px] 2xl:max-w-[15ch] 2xl:text-[92px]">
                  Clinical Decision
                  <br />
                  Support System
                </h2>
                <p className="gradient-text-blue mt-5 max-w-[18ch] text-[24px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[30px] xl:text-[40px] 2xl:text-[44px]">
                  Visible reasoning at every step.
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0, scaleX: 0.8 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.55, delay: 0.16 }}
                className="accent-bar mt-7 w-32"
              />

              <p className="mt-8 max-w-[52rem] text-[18px] leading-9 text-muted-foreground/84 xl:text-[22px] xl:leading-10">
                Intake, follow-up, evidence review, critic feedback, and patient memory stay in one calm surface so the recommendation never arrives as a black box.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.22 }}
                className="mt-6 flex flex-wrap justify-center gap-2.5"
              >
                {["Traceable reasoning", "Evidence-backed retrieval", "Patient-linked memory"].map((item) => (
                  <div key={item} className="premium-pill rounded-full px-3.5 py-1.5 text-[12px] font-medium">
                    {item}
                  </div>
                ))}
              </motion.div>

              <div className="mt-10 grid w-full max-w-[860px] gap-4 md:grid-cols-2">
                {[
                  {
                    icon: Layers3,
                    title: "One continuous workspace",
                    copy: "No handoff between tools. The case, evidence, and reasoning all stay side by side.",
                  },
                  {
                    icon: CircleDashed,
                    title: "Deliberate refinement loops",
                    copy: "The critic can push the workflow back through another pass before the final ranking appears.",
                  },
                ].map(({ icon: Icon, title, copy }, index) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 + index * 0.05 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -5, scale: 1.01 }}
                    className="metric-tile flex flex-col items-center rounded-[28px] px-6 py-6 text-center"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/14 bg-primary/8 shadow-[var(--glow-blue)]">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                      {title}
                    </p>
                    <p className="mt-2 max-w-[28rem] text-[15px] leading-7 text-muted-foreground/76">
                      {copy}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.24 }}
                className="mt-10 flex w-full max-w-[560px] flex-col items-center gap-3 sm:flex-row sm:justify-center"
              >
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    className="h-[60px] w-full min-w-[240px] rounded-[18px] px-6 text-[16px] sm:w-auto"
                    onClick={scrollToHowItWorks}
                  >
                    Explore workspace
                    <ArrowDownRight className="ml-2 h-4.5 w-4.5" />
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                  className="w-full sm:w-auto"
                >
                  <Link href={user ? "/assessment" : "/login"} className="w-full sm:w-auto">
                    <Button className="btn-primary h-[60px] w-full min-w-[260px] rounded-[18px] px-6 text-[16px] shadow-md">
                      {user ? "Start clinical assessment" : "Sign in to start"}
                      <ArrowRight className="ml-2 h-4.5 w-4.5" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.3 }}
                className="mt-12 grid w-full gap-3 md:grid-cols-3"
              >
                {[
                  {
                    value: "5",
                    label: "Specialist agents",
                    copy: "Interview, hypothesis, evidence, critic, and memory work from one shared case state.",
                  },
                  {
                    value: "Live",
                    label: "Streaming workflow",
                    copy: "Every stage remains inspectable while the recommendation is being formed.",
                  },
                  {
                    value: "RAG",
                    label: "Grounded evidence",
                    copy: "Retrieved medical sources are checked before the final ranking is returned.",
                  },
                ].map(({ value, label, copy }, index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.28 + index * 0.05 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                    className="metric-tile rounded-[26px] px-5 py-5 text-left shadow-[var(--shadow-sm)]"
                  >
                    <div className="text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                      {value}
                    </div>
                    <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/76">
                      {label}
                    </p>
                    <p className="mt-2.5 text-[14px] leading-7 text-muted-foreground/72">
                      {copy}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          <section
            id="how-it-works"
            className="hero-surface relative overflow-hidden rounded-[40px] px-6 py-7 sm:px-8 sm:py-8 xl:px-10 xl:py-10"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,oklch(0.72_0.09_220_/_0.12),transparent_22%),radial-gradient(circle_at_12%_90%,oklch(0.7_0.08_180_/_0.08),transparent_18%)]" />

            <div className="relative">
              <div
                id="workspace-story"
                className="scroll-mt-32"
              >
                <div className="space-y-10">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-[40px] border border-border/60 bg-white/52 p-6 shadow-[var(--shadow-lg)] dark:bg-white/[0.03] sm:p-7"
                  >
                    <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
                      <div className="xl:pr-2">
                        <div className="mb-4 flex flex-wrap gap-2.5">
                          <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-primary">
                            <Layers3 className="h-3.5 w-3.5" />
                            Guided review flow
                          </div>
                          <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium">
                            <Brain className="h-3.5 w-3.5 text-emerald-500" />
                            Always-visible workflow
                          </div>
                        </div>

                        <div className="section-label mb-3">How the system works</div>
                        <h3 className="max-w-[13ch] text-[34px] font-semibold tracking-[-0.065em] text-foreground sm:text-[42px] xl:text-[50px]">
                          Explore one case as the system makes each step visible.
                        </h3>
                        <p className="mt-4 max-w-[38rem] text-[17px] leading-8 text-muted-foreground/80 xl:text-[18px]">
                          One live flow at the top shows the current phase. The walkthrough underneath explains the same journey in simple terms, without turning the page into tabs or controls.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2.5">
                          {[
                            "Auto-playing workflow story",
                            "One continuous workspace",
                            "Optional deeper info",
                          ].map((item) => (
                            <div key={item} className="premium-pill rounded-full px-3.5 py-1.5 text-[12px] font-medium">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[36px] border border-border/70 bg-[linear-gradient(180deg,oklch(1_0_0_/_0.95),oklch(0.982_0.006_240_/_0.97))] p-6 shadow-[inset_0_1px_0_oklch(1_0_0/0.72)] dark:border-white/10 dark:bg-[linear-gradient(180deg,oklch(1_0_0_/_0.06),oklch(1_0_0_/_0)),linear-gradient(180deg,oklch(0.19_0.016_248/_0.72),oklch(0.16_0.014_244/_0.94))] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]">
                      <motion.div
                        className="mb-6 h-1.5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
                        animate={shouldReduceMotion ? undefined : { width: progressWidth, opacity: [0.65, 1, 0.65] }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        style={{ width: progressWidth }}
                      />

                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="section-label mb-2">Agent flow</div>
                          <h4 className="max-w-[15ch] text-[28px] font-semibold tracking-[-0.055em] text-foreground sm:text-[32px]">
                            One live case scene, moving phase by phase.
                          </h4>
                        </div>
                        <div className={`premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-semibold ${activeStage.accentBorder} ${activeStage.accentBg} ${activeStage.accentText}`}>
                          <span className={`status-dot ${activeStage.accentDot}`} />
                          {activeStage.chip}
                        </div>
                      </div>

                      <div className="mb-6 flex flex-wrap gap-2.5">
                        {walkthroughStages.map((stage, index) => {
                          const Icon = stage.icon;
                          const isActive = index === activeStageIndex;

                          return (
                            <div
                              key={stage.id}
                              className={`flex min-w-[158px] flex-1 items-center gap-3 rounded-[22px] border px-4 py-3 transition-[background-color,border-color,box-shadow] duration-300 ${
                                isActive
                                  ? `${stage.accentBorder} ${stage.accentBg} shadow-[var(--shadow-sm)]`
                                  : "border-border/60 bg-white/70 dark:bg-background/48"
                              }`}
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/14 bg-primary/8 shadow-[var(--glow-blue)]">
                                <Icon className={`h-4 w-4 ${stage.accentText}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/58">
                                  {stage.phase}
                                </div>
                                <div className="truncate text-[15px] font-medium text-foreground/92">{stage.label}</div>
                              </div>
                              <div className={`ml-auto h-2.5 w-2.5 rounded-full ${isActive ? stage.accentDot : "bg-border/70"}`} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="overflow-hidden rounded-[36px] border border-border/70 bg-[linear-gradient(180deg,oklch(1_0_0_/_0.86),oklch(0.978_0.008_240_/_0.97))] p-6 shadow-[inset_0_1px_0_oklch(1_0_0/0.72)] dark:bg-[linear-gradient(180deg,oklch(1_0_0_/_0.03),oklch(1_0_0_/_0)),linear-gradient(180deg,oklch(0.2_0.015_248/_0.78),oklch(0.16_0.014_244/_0.96))] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]">
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <div>
                            <div className="section-label mb-1">Live workspace information</div>
                            <motion.div
                              key={`title-${activeStage.id}`}
                              initial={shouldReduceMotion ? false : { opacity: 0.45, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                              className="text-[24px] font-semibold tracking-[-0.04em] text-foreground"
                            >
                              {activeStage.label} in progress
                            </motion.div>
                          </div>
                          <motion.div
                            key={`phase-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${activeStage.accentBorder} ${activeStage.accentBg} ${activeStage.accentText}`}
                          >
                            Phase {activeStage.phase}
                          </motion.div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <motion.div
                            key={`start-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.55, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-[26px] border border-border/65 bg-white/80 px-5 py-5 shadow-[var(--shadow-sm)] dark:bg-background/54"
                          >
                            <div className="section-label mb-3">Where the case starts</div>
                            <p className="text-[21px] font-semibold tracking-[-0.04em] text-foreground">
                              {activeStage.story[0].value}
                            </p>
                          </motion.div>

                          <motion.div
                            key={`agent-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.55, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.03, ease: [0.22, 1, 0.36, 1] }}
                            className={`rounded-[26px] border px-5 py-5 shadow-[var(--shadow-sm)] ${activeStage.accentBorder} ${activeStage.accentBg}`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="section-label">Live agent</div>
                              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/78 dark:bg-background/62 ${activeStage.accentBorder}`}>
                                <ActiveStageIcon className={`h-5 w-5 ${activeStage.accentText}`} />
                              </div>
                            </div>
                            <p className="text-[21px] font-semibold tracking-[-0.04em] text-foreground">
                              {activeStage.story[1].value}
                            </p>
                          </motion.div>

                          <motion.div
                            key={`next-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.55, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-[26px] border border-border/65 bg-white/80 px-5 py-5 shadow-[var(--shadow-sm)] dark:bg-background/54"
                          >
                            <div className="section-label mb-3">What becomes visible next</div>
                            <p className="text-[21px] font-semibold tracking-[-0.04em] text-foreground">
                              {activeStage.story[2].value}
                            </p>
                          </motion.div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                          <motion.div
                            key={`summary-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.45 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-[24px] border border-border/60 bg-white/70 px-5 py-4 shadow-[var(--shadow-sm)] dark:bg-background/52"
                          >
                            <div className="section-label mb-3">What the system is showing</div>
                            <p className="text-[15px] leading-8 text-muted-foreground/78">
                              {activeStage.summary}
                            </p>
                          </motion.div>

                          <motion.div
                            key={`surfaces-${activeStage.id}`}
                            initial={shouldReduceMotion ? false : { opacity: 0.45 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-[24px] border border-border/60 bg-white/70 px-5 py-4 shadow-[var(--shadow-sm)] dark:bg-background/52"
                          >
                            <div className="section-label mb-3">Visible surfaces</div>
                            <p className="text-[14px] leading-7 text-muted-foreground/78">
                              {activeStage.surfaces.join(", ")}
                            </p>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.18 }}
                    transition={{ duration: 0.45 }}
                    className="overflow-hidden rounded-[38px] border border-border/55 bg-white/46 shadow-[var(--shadow-md)] dark:bg-white/[0.025]"
                  >
                    {walkthroughStages.map((stage, index) => {
                      const Icon = stage.icon;
                      const delay = index * 0.12;

                      return (
                        <motion.article
                          key={stage.id}
                          initial={{ opacity: 0, y: 18 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.22 }}
                          transition={{ duration: 0.45, delay }}
                          className={`relative overflow-hidden px-6 py-7 dark:bg-white/[0.01] ${index < walkthroughStages.length - 1 ? "border-b border-border/45" : ""}`}
                        >
                          <div className="relative z-10">
                            <div className="mb-5 flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] border bg-white/82 shadow-[var(--shadow-sm)] dark:bg-white/[0.04] ${stage.accentBorder}`}>
                                  <Icon className={`h-4.5 w-4.5 ${stage.accentText}`} />
                                </div>
                                <div>
                                  <div className="section-label mb-2">
                                    Phase {stage.phase} · {stage.label}
                                  </div>
                                  <h4 className="max-w-[18ch] text-[26px] font-semibold tracking-[-0.055em] text-foreground">
                                    {stage.title}
                                  </h4>
                                </div>
                              </div>
                              <MetricInfoTooltip label={`${stage.label} agent`} description={stage.tooltip} />
                            </div>

                            <p className="max-w-[34rem] text-[17px] leading-8 text-muted-foreground/80">
                              {stage.copy}
                            </p>

                            <div className="mt-6 flex items-start gap-3">
                              <div className={`mt-2 h-3 w-3 shrink-0 rounded-full ${stage.accentDot}`} />
                              <p className="text-[16px] leading-8 text-foreground/86">
                                It starts from <span className="font-semibold text-foreground">{stage.story[0].value}</span>, moves through <span className="font-semibold text-foreground">{stage.story[1].value}</span>, and makes <span className="font-semibold text-foreground">{stage.story[2].value}</span> visible in the workspace.
                              </p>
                            </div>

                            <div className="mt-6 rounded-[22px] border border-border/45 bg-background/38 px-4 py-4 dark:bg-background/28">
                              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/58">
                                In the workspace
                              </div>
                              <p className="text-[15px] leading-7 text-muted-foreground/82">
                                {stage.surfaces.join(", ")}
                              </p>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
