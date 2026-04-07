"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useDiagnosis } from "@/hooks/useDiagnosis";
import { SymptomInput } from "@/components/SymptomInput";
import { InterviewForm } from "@/components/InterviewForm";
import { AssessmentHero } from "@/components/AssessmentHero";
import { DifferentialList } from "@/components/DifferentialList";
import { EvidencePanel } from "@/components/EvidencePanel";
import { CriticPanel } from "@/components/CriticPanel";
import { WorkflowView } from "@/components/WorkflowView";
import { MemoryView } from "@/components/MemoryView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Brain,
  Sparkles,
  MessageCircle,
  BookOpen,
  GitBranch,
  ShieldAlert,
  Database,
  Stethoscope,
  Square,
  Download,
  Plus,
  FlaskConical,
  LogOut,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Workspace tabs                                                     */
/* ------------------------------------------------------------------ */

type View = "diagnosis" | "evidence" | "workflow" | "critic" | "memory";

const TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope },
  { id: "evidence", label: "Evidence", icon: BookOpen },
  { id: "workflow", label: "Workflow", icon: GitBranch },
  { id: "critic", label: "Critic", icon: ShieldAlert },
  { id: "memory", label: "History", icon: Database },
];

function normalizeAgentId(agent?: string): string {
  if (!agent) return "";
  if (agent === "memory") return "memory_update";
  if (agent === "skip_critic") return "critic";
  return agent;
}

/* ------------------------------------------------------------------ */
/*  Report generator                                                   */
/* ------------------------------------------------------------------ */

function generateReport(state: {
  symptoms: string[];
  finalDiagnosis: Record<string, unknown>[];
  clinicalSummary: string;
  caveats: string[];
  evidence: Record<string, unknown>[];
  criticFeedback: Record<string, unknown>;
  iteration: number;
}): string {
  const lines: string[] = [];
  const now = new Date();

  lines.push("=" .repeat(60));
  lines.push("CLINICAL DECISION SUPPORT REPORT");
  lines.push("=" .repeat(60));
  lines.push("");
  lines.push(`Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  lines.push(`Iterations: ${state.iteration}`);
  lines.push("");

  lines.push("-".repeat(40));
  lines.push("PRESENTING SYMPTOMS");
  lines.push("-".repeat(40));
  state.symptoms.forEach((s) => lines.push(`  - ${s}`));
  lines.push("");

  if (state.clinicalSummary) {
    lines.push("-".repeat(40));
    lines.push("CLINICAL SUMMARY");
    lines.push("-".repeat(40));
    lines.push(state.clinicalSummary);
    lines.push("");
  }

  lines.push("-".repeat(40));
  lines.push("DIAGNOSES");
  lines.push("-".repeat(40));
  interface DiagRecord {
    rank?: number;
    diagnosis?: string;
    confidence?: string | number;
    explanation?: string;
    urgency?: string;
    key_evidence?: string[];
    recommended_tests?: string[];
  }
  (state.finalDiagnosis as DiagRecord[]).forEach((d, i) => {
    lines.push(`  ${i + 1}. ${d.diagnosis || "Unknown"}`);
    const confLabel = typeof d.confidence === "string" ? d.confidence.replace("_", " ") : `${((d.confidence || 0) * 100).toFixed(0)}%`;
    lines.push(`     Evidence level: ${confLabel}`);
    lines.push(`     Urgency: ${d.urgency || "N/A"}`);
    if (d.explanation) lines.push(`     Explanation: ${d.explanation}`);
    if (d.key_evidence?.length) {
      lines.push(`     Key Evidence:`);
      d.key_evidence.forEach((e) => lines.push(`       - ${e}`));
    }
    if (d.recommended_tests?.length) {
      lines.push(`     Recommended Tests:`);
      d.recommended_tests.forEach((t) => lines.push(`       - ${t}`));
    }
    lines.push("");
  });

  if (state.caveats?.length) {
    lines.push("-".repeat(40));
    lines.push("IMPORTANT LIMITATIONS");
    lines.push("-".repeat(40));
    state.caveats.forEach((c) => lines.push(`  - ${c}`));
    lines.push("");
  }

  const score = state.criticFeedback?.score as number;
  if (typeof score === "number") {
    lines.push("-".repeat(40));
    lines.push("CRITIC REVIEW");
    lines.push("-".repeat(40));
    lines.push(`  Score: ${score.toFixed(2)}`);
    const summary = state.criticFeedback?.summary as string;
    if (summary) lines.push(`  Summary: ${summary}`);
    lines.push("");
  }

  lines.push("=".repeat(60));
  lines.push("DISCLAIMER: This AI-assisted assessment is for clinical");
  lines.push("decision support only. It does not replace professional");
  lines.push("medical judgment.");
  lines.push("=".repeat(60));

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Auth guard — proxy handles redirect, but this prevents flash of content
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-[14px]">Loading...</div>
      </div>
    );
  }
  if (!user) return null;

  return <AssessmentPage signOut={signOut} router={router} />;
}

function AssessmentPage({ signOut, router }: { signOut: () => Promise<void>; router: ReturnType<typeof useRouter> }) {
  const {
    state,
    startInterview,
    submitAnswersAndDiagnose,
    skipInterview,
    stopDiagnosis,
    reset,
  } = useDiagnosis();

  const [activeView, setActiveView] = useState<View>("workflow");
  const [hasManualViewSelection, setHasManualViewSelection] = useState(false);

  /* Derived state */
  const criticScore = (state.criticFeedback?.score as number) || 0;
  const criticThreshold = state.criticThreshold;

  const isLooping = useMemo(() => {
    return state.isRunning && criticScore >= criticThreshold && state.iteration > 0;
  }, [state.isRunning, criticScore, state.iteration, criticThreshold]);

  const patientIdFromEvents = useMemo(() => {
    const startEvent = state.events.find((e) => e.type === "start");
    const raw = startEvent as unknown as Record<string, unknown> | undefined;
    return (raw?.patient_id as string) || "patient_001";
  }, [state.events]);

  const normalizedCurrentAgent = useMemo(
    () => normalizeAgentId(state.currentAgent),
    [state.currentAgent]
  );

  const completedAgents = useMemo(() => {
    const agentNames = new Set<string>();
    for (const event of state.events) {
      if (event.type === "agent_update") {
        const raw = event as unknown as Record<string, unknown>;
        const name = normalizeAgentId((raw.agent as string) || "");
        if (name) agentNames.add(name);
      }
    }
    if (normalizedCurrentAgent && state.isRunning) {
      agentNames.delete(normalizedCurrentAgent);
    }
    return Array.from(agentNames);
  }, [state.events, normalizedCurrentAgent, state.isRunning]);

  const isDiagnosing = state.phase === "diagnosing" || state.phase === "complete";
  const isInterviewing = state.phase === "interview";
  const isInputPhase = state.phase === "input" && !state.isRunning && state.events.length === 0;
  const showCritic = state.finalDiagnosis.length > 0 && !state.isRunning;
  const isComplete = state.finalDiagnosis.length > 0 && !state.isRunning;
  const differentials = state.finalDiagnosis.length > 1 ? state.finalDiagnosis.slice(1) : [];
  const visibleView = isComplete && !hasManualViewSelection ? "diagnosis" : activeView;
  const primaryDiagnosis = state.finalDiagnosis[0] as
    | {
        diagnosis?: string;
        confidence?: string | number;
        recommended_tests?: string[];
        urgency?: string;
      }
    | undefined;
  const latestEvidenceOutput = useMemo(() => {
    const evidenceEvents = state.events.filter(
      (event) => event.type === "agent_update" && normalizeAgentId(event.agent) === "evidence"
    );
    return evidenceEvents[evidenceEvents.length - 1]?.output || {};
  }, [state.events]);
  const retrievedChunkCount = ((latestEvidenceOutput.retrieved_chunks as unknown[]) || []).length;
  const sourceTypes = useMemo(() => {
    const chunks = (latestEvidenceOutput.retrieved_chunks as { source_type?: string; document_type?: string }[]) || [];
    const types = new Set<string>();
    chunks.forEach((chunk) => {
      const raw = chunk.document_type || chunk.source_type;
      if (!raw) return;
      types.add(raw.toUpperCase());
    });
    return Array.from(types);
  }, [latestEvidenceOutput]);
  const primaryTests = primaryDiagnosis?.recommended_tests?.slice(0, 2) || [];

  const handleStartInterview = useCallback(
    (symptoms: string[], patientId: string, criticEnabled: boolean, maxIterations: number) => {
      setActiveView("workflow");
      setHasManualViewSelection(false);
      startInterview(symptoms, patientId, criticEnabled, maxIterations);
    },
    [startInterview]
  );

  const handleSubmitAnswersAndDiagnose = useCallback(
    (answers: { question_id: string; question: string; answer: string }[]) => {
      setActiveView("workflow");
      setHasManualViewSelection(false);
      submitAnswersAndDiagnose(answers);
    },
    [submitAnswersAndDiagnose]
  );

  const handleSkipInterview = useCallback(() => {
    setActiveView("workflow");
    setHasManualViewSelection(false);
    skipInterview();
  }, [skipInterview]);

  const handleReset = useCallback(() => {
    setActiveView("workflow");
    setHasManualViewSelection(false);
    reset();
  }, [reset]);

  /* Download report handler */
  const handleDownloadReport = useCallback(() => {
    const report = generateReport(state);
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 shrink-0 px-4 py-4 lg:px-6">
        <div className="topbar-surface topbar-shell mx-auto flex h-[86px] w-full max-w-[2040px] items-center gap-4 rounded-[30px] px-5 lg:px-7">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 group">
            <div className="brand-mark flex h-12 w-12 items-center justify-center rounded-[20px] transition-shadow duration-200 group-hover:shadow-[0_0_16px_oklch(0.58_0.1_245/18%)]">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[21px] font-semibold tracking-[-0.045em] text-foreground leading-none">
                Clinical Decision Support System
              </h1>
              <p className="mt-1 truncate text-[13px] leading-none text-muted-foreground/78">
                Diagnostic workspace with live reasoning, grounded evidence, and patient-linked memory
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2.5 xl:flex">
            <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium">
              <Stethoscope className="h-3.5 w-3.5 text-emerald-500" />
              Intake workspace
            </div>
            <div className="premium-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium">
              <Brain className="h-3.5 w-3.5 text-primary" />
              LangGraph workflow
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isInterviewing && (
              <Badge className="border border-amber-500/20 bg-amber-500/12 px-3 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                <MessageCircle className="mr-1.5 h-3 w-3" /> Awaiting Answers
              </Badge>
            )}
            {state.isRunning && !isInterviewing && (
              <Badge className="border border-cyan-500/20 bg-cyan-500/12 px-3 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
                <div className="relative mr-1.5 flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
                </div>
                Analyzing
              </Badge>
            )}
            {isComplete && (
              <Badge className="border border-emerald-500/20 bg-emerald-500/12 px-3 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <Sparkles className="mr-1.5 h-3 w-3" /> Complete
              </Badge>
            )}
            <ThemeToggle />
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
                router.refresh();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  INPUT PHASE                                                  */}
      {/* ============================================================ */}
      {isInputPhase && (
        <main className="relative flex-1 overflow-hidden px-5 py-6 lg:px-8 lg:py-8 animate-fadeInUp">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[-8rem] top-[4rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-[100px]" />
            <div className="absolute right-[-7rem] top-[7rem] h-[28rem] w-[28rem] rounded-full bg-emerald-500/12 blur-[110px]" />
            <div className="absolute left-[34%] bottom-[-10rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-[120px]" />
            <div className="absolute left-[18%] top-[12%] h-px w-44 bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
            <div className="absolute right-[14%] top-[18%] h-28 w-28 rounded-full border border-emerald-400/8" />
          </div>

          <div className="relative mx-auto min-h-[calc(100vh-120px)] w-full max-w-[1640px]">
            <div className="relative overflow-hidden hero-surface rounded-[42px] px-3 py-3 shadow-[var(--shadow-lg)] sm:px-4 sm:py-4 lg:px-5 lg:py-5">
              <div className="absolute -inset-6 rounded-[50px] bg-gradient-to-br from-cyan-500/16 via-transparent to-emerald-500/14 blur-[70px]" />
              <div className="relative">
                <SymptomInput
                  onStart={handleStartInterview}
                  onStop={stopDiagnosis}
                  onReset={handleReset}
                  isRunning={state.isRunning || state.interviewLoading}
                />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/*  INTERVIEW PHASE                                              */}
      {/* ============================================================ */}
      {isInterviewing && (
        <main className="flex-1 overflow-y-auto px-5 lg:px-8 py-6">
          <div className="mx-auto w-full max-w-6xl animate-fadeInUp">
            <InterviewForm
              questions={state.interviewQuestions}
              isLoading={state.interviewLoading}
              symptoms={state.symptoms}
              onSubmit={handleSubmitAnswersAndDiagnose}
              onSkip={handleSkipInterview}
            />
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/*  WORKSPACE (diagnosing / complete)                            */}
      {/* ============================================================ */}
      {isDiagnosing && (
        <div className="mx-auto flex w-full max-w-[2040px] flex-1 flex-col lg:flex-row gap-5 overflow-hidden px-4 pb-4 lg:px-6 lg:pb-6">
          {/* ---- Sidebar ---- */}
          <aside className="w-full lg:w-[300px] xl:w-[330px] shrink-0 rounded-[34px] shell-panel shell-outline flex flex-col overflow-y-auto max-h-[50vh] lg:max-h-none">
            <div className="m-4 mb-0 rounded-[30px] border border-primary/14 bg-gradient-to-br from-primary/[0.09] via-background/96 to-emerald-500/[0.06] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label mb-2">Assessment status</p>
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${state.isRunning ? "bg-cyan-300 animate-pulse" : "bg-emerald-400"}`} />
                    <span className="text-[20px] font-semibold tracking-[-0.04em] text-foreground">
                      {state.isRunning ? "Analysis in progress" : "Assessment complete"}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground/74">
                    {state.isRunning
                      ? "The workflow is still assembling evidence and updating the final assessment."
                      : "The current case has completed evidence review and is ready for inspection."}
                  </p>
                </div>
                <Badge className="shrink-0 border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground capitalize">
                  {normalizedCurrentAgent ? normalizedCurrentAgent.replace("_", " ") : "decision"}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="metric-tile rounded-[18px] px-3.5 py-3">
                    <p className="section-label mb-1.5">Patient</p>
                    <p className="truncate text-[14px] font-mono text-foreground/78">
                      {patientIdFromEvents}
                    </p>
                  </div>

                  <div className="metric-tile rounded-[18px] px-3.5 py-3">
                    <p className="section-label mb-1.5">Iteration</p>
                    <p className="text-[14px] font-mono tabular-nums text-foreground/78">
                      {state.iteration > 0 || state.isRunning
                        ? `${state.iteration}/${state.maxIterations}`
                        : `0/${state.maxIterations}`}
                    </p>
                    {isComplete && state.iteration > 0 && (
                      <p className="mt-1 text-[10px] leading-3 text-muted-foreground/50">
                        {state.iteration < state.maxIterations
                          ? "Resolved early — critic satisfied"
                          : "Used all refinement passes"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="metric-tile rounded-[18px] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="section-label">Critic score</p>
                    <span
                      className={`text-[14px] font-mono font-semibold tabular-nums ${
                        criticScore > 0
                          ? criticScore >= criticThreshold
                            ? "text-orange-500 dark:text-orange-400"
                            : "text-emerald-500 dark:text-emerald-400"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {criticScore > 0 ? criticScore.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  {criticScore > 0 && (
                    <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground/60">
                      {criticScore <= 0.15
                        ? "Excellent — reasoning is tight and well-supported"
                        : criticScore <= 0.30
                        ? "Good — minor gaps, sound overall logic"
                        : criticScore <= 0.50
                        ? "Moderate — some issues refined through looping"
                        : "Poor — significant gaps flagged by critic"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-border/50 p-5">
              <div className="surface-tint-cyan rounded-[24px] border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/14 bg-primary/8">
                    {isComplete ? (
                      <Stethoscope className="h-4 w-4 text-primary" />
                    ) : (
                      <Brain className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="section-label">Current focus</div>
                    <div className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-foreground">
                      {isComplete
                        ? primaryDiagnosis?.diagnosis || "Diagnosis ready"
                        : normalizedCurrentAgent
                        ? normalizedCurrentAgent.replace("_", " ")
                        : "Awaiting workflow"}
                    </div>
                  </div>
                </div>
                <p className="text-[13px] leading-6 text-muted-foreground/76">
                  {isComplete
                    ? primaryDiagnosis?.confidence != null
                      ? `${typeof primaryDiagnosis.confidence === "string" ? primaryDiagnosis.confidence.replace("_", " ").charAt(0).toUpperCase() + primaryDiagnosis.confidence.replace("_", " ").slice(1) : "Moderate"} suspicion in the leading diagnosis after evidence and critic review.`
                      : "Final decision is ready for review."
                    : state.isRunning
                    ? "The graph is actively updating this case with new reasoning output."
                    : "Start an assessment to populate the workflow."}
                </p>
              </div>
            </div>

            {/* Symptoms */}
            <div className="border-b border-border/50 p-5">
              <span className="section-label block mb-2.5">Symptoms</span>
              <div className="metric-tile rounded-[22px] p-3">
                <div className="flex flex-wrap gap-2">
                {state.symptoms.map((s) => (
                  <span key={s} className="inline-flex rounded-full border border-primary/18 bg-primary/8 px-3 py-1.5 text-[12px] font-medium text-primary dark:text-cyan-100/90 shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]">
                    {s}
                  </span>
                ))}
                </div>
              </div>
            </div>

            <div className="border-b border-border/50 p-5">
              <span className="section-label mb-2.5 block">Evidence status</span>
              <div className="space-y-3 rounded-[22px] border border-border/60 bg-card/46 p-3.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.18)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] text-foreground/84">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    Retrieved chunks
                  </div>
                  <span className="text-[13px] font-mono tabular-nums text-foreground/80">
                    {retrievedChunkCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] text-foreground/84">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    Source types
                  </div>
                  <span className="text-[12px] text-muted-foreground/78">
                    {sourceTypes.length > 0 ? sourceTypes.join(", ") : "Waiting"}
                  </span>
                </div>
                {isComplete && primaryDiagnosis?.urgency && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[13px] text-foreground/84">
                      <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                      Urgency
                    </div>
                    <span className="text-[12px] font-medium text-foreground/82 capitalize">
                      {primaryDiagnosis.urgency}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mini pipeline status */}
            <div className="border-b border-border/50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="section-label block">Pipeline</span>
                <span className="text-[12px] text-muted-foreground/76">
                  {completedAgents.length}/6 complete
                </span>
              </div>
              <div className="rounded-[22px] border border-border/60 bg-card/46 p-3 shadow-[inset_0_1px_0_oklch(1_0_0/0.18)]">
                <div className="grid grid-cols-6 gap-1.5">
                {["interviewer", "hypothesis", "evidence", "critic", "decision", "memory_update"].map((id) => {
                  const isDone = completedAgents.includes(id);
                  const isActive = id === normalizedCurrentAgent && state.isRunning;
                  return (
                    <div
                      key={id}
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                        isActive ? "bg-primary animate-pulse shadow-[0_0_10px_oklch(0.58_0.1_245/24%)] dark:bg-cyan-300" : isDone ? "bg-emerald-500/70" : "bg-muted"
                      }`}
                    />
                  );
                })}
                </div>
              {normalizedCurrentAgent && state.isRunning && (
                <p className="mt-3 text-[12px] font-medium capitalize text-muted-foreground">
                  {normalizedCurrentAgent.replace("_", " ")}...
                </p>
              )}
              </div>
            </div>

            {primaryTests.length > 0 && (
              <div className="border-b border-border/50 p-5">
                <span className="section-label mb-2.5 block">Next tests</span>
                <div className="rounded-[22px] border border-border/60 bg-card/46 p-3.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.18)]">
                  <div className="mb-2 flex items-center gap-2 text-[13px] text-foreground/84">
                    <FlaskConical className="h-3.5 w-3.5 text-primary" />
                    Recommended
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {primaryTests.map((test) => (
                      <span
                        key={test}
                        className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-[12px] text-muted-foreground/82"
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 p-5">
              {isComplete && (
                <Button
                  onClick={handleDownloadReport}
                  variant="outline"
                  size="sm"
                  className="h-11 w-full border-border/60 bg-card/70 text-[12px] text-foreground/85 hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download Report
                </Button>
              )}
              {state.isRunning ? (
                <Button onClick={stopDiagnosis} variant="destructive" size="sm" className="h-11 w-full text-[12px]">
                  <Square className="h-3.5 w-3.5 mr-1.5" /> Stop
                </Button>
              ) : (
                <Button onClick={handleReset} size="sm" className="btn-primary h-11 w-full text-[12px]">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Assessment
                </Button>
              )}
            </div>
          </aside>

          {/* ---- Main workspace ---- */}
          <div className="flex-1 flex flex-col min-w-0 rounded-[36px] shell-panel shell-outline overflow-hidden">
            {/* Workspace tabs */}
            <nav className="shrink-0 flex items-center gap-2 border-b border-border/50 bg-card/48 px-5 py-4 backdrop-blur-xl">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = visibleView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveView(tab.id);
                      setHasManualViewSelection(true);
                    }}
                    className={`relative flex items-center gap-2 rounded-full px-4 py-3 text-[14px] font-medium transition-all duration-200 ${
                      isActive
                        ? "border border-border/70 bg-background/84 text-foreground shadow-[var(--shadow-sm)]"
                        : "text-muted-foreground/70 hover:bg-background/45 hover:text-foreground/84"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="workspace-tab"
                        className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-cyan-500/[0.08] via-sky-500/[0.04] to-emerald-500/[0.08]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* View content */}
            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,oklch(1_0_0_/_0.018),transparent)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={visibleView}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
                  {/* DIAGNOSIS VIEW */}
                  {visibleView === "diagnosis" && (
                    <div className="p-8 space-y-7">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className="card-elevated p-6 sm:p-7"
                      >
                        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                              <div className={`h-2 w-2 rounded-full ${isComplete ? "bg-emerald-500" : "bg-cyan-400 animate-pulse"}`} />
                              Assessment overview
                            </div>
                            <div className="mt-4 text-[36px] font-semibold tracking-[-0.055em] text-foreground sm:text-[42px]">
                              {isComplete ? "Decision ready for review" : "Diagnostic analysis in progress"}
                            </div>
                            <p className="mt-3 max-w-[52rem] text-[17px] leading-9 text-muted-foreground/80">
                              {isComplete
                                ? "Review the final recommendation, evidence strength, differential coverage, and limitations in one polished clinical summary."
                                : "The graph is still moving through hypothesis generation, evidence review, and critic analysis before the final decision is returned."}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2.5">
                              <Badge className="border border-border/60 bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
                                {state.finalDiagnosis.length || 0} diagnosis{state.finalDiagnosis.length === 1 ? "" : "es"}
                              </Badge>
                              <Badge className="border border-border/60 bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
                                {state.symptoms.length} symptom{state.symptoms.length === 1 ? "" : "s"}
                              </Badge>
                              <Badge className={`border px-3 py-1.5 text-[12px] ${
                                criticScore > 0 && criticScore <= 0.15
                                  ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
                                  : criticScore <= 0.30
                                  ? "border-sky-500/20 bg-sky-500/8 text-sky-700 dark:text-sky-400"
                                  : criticScore <= 0.50
                                  ? "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400"
                                  : "border-border/60 bg-background/80 text-muted-foreground"
                              }`}>
                                Critic {criticScore > 0
                                  ? `${criticScore.toFixed(2)} · ${criticScore <= 0.15 ? "Excellent" : criticScore <= 0.30 ? "Good" : criticScore <= 0.50 ? "Moderate" : "Poor"}`
                                  : "N/A"}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
                            <div className="metric-tile p-5">
                              <p className="section-label mb-2">Status</p>
                              <div className="text-[20px] font-semibold text-foreground/90">
                                {isComplete ? "Complete" : "Running"}
                              </div>
                              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/72">
                                Current diagnostic state
                              </p>
                            </div>
                            <div className="metric-tile p-5">
                              <p className="section-label mb-2">Iterations</p>
                              <div className="text-[20px] font-semibold text-foreground/90">
                                {state.iteration || 0}
                                <span className="text-muted-foreground/45">/{state.maxIterations}</span>
                              </div>
                              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/72">
                                {isComplete
                                  ? state.iteration < state.maxIterations
                                    ? "Final decision after the workflow refinement loop."
                                    : "All refinement passes used before final decision."
                                  : "Refinement loops used"}
                              </p>
                            </div>
                            <div className="metric-tile p-5">
                              <p className="section-label mb-2">Patient</p>
                              <div className="truncate text-[20px] font-mono font-semibold text-cyan-700 dark:text-cyan-200">
                                {patientIdFromEvents}
                              </div>
                              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/72">
                                Active patient record
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      <AssessmentHero
                        finalDiagnosis={state.finalDiagnosis}
                        clinicalSummary={state.clinicalSummary}
                        caveats={state.caveats}
                        evidence={state.evidence}
                        isRunning={state.isRunning}
                        iteration={state.iteration}
                        maxIterations={state.maxIterations}
                      />
                      {isComplete && differentials.length > 0 && (
                        <DifferentialList diagnoses={differentials} />
                      )}

                      {state.error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-[13px] text-red-400">
                          Error: {state.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* EVIDENCE VIEW */}
                  {visibleView === "evidence" && (
                    <div className="p-7">
                      <EvidencePanel events={state.events} evidence={state.evidence} />
                    </div>
                  )}

                  {/* WORKFLOW VIEW */}
                  {visibleView === "workflow" && (
                    <WorkflowView
                      events={state.events}
                      currentAgent={normalizedCurrentAgent}
                      isRunning={state.isRunning}
                      completedAgents={completedAgents}
                      iteration={state.iteration}
                      maxIterations={state.maxIterations}
                      criticScore={criticScore}
                      criticThreshold={criticThreshold}
                      isLooping={isLooping}
                      isComplete={isComplete}
                    />
                  )}

                  {/* CRITIC VIEW */}
                  {visibleView === "critic" && (
                    <div className="p-7">
                      <CriticPanel
                        criticFeedback={state.criticFeedback}
                        symptoms={state.symptoms}
                        patientId={patientIdFromEvents}
                        showComparison={showCritic}
                      />
                    </div>
                  )}

                  {/* MEMORY VIEW */}
                  {visibleView === "memory" && (
                    <MemoryView
                      patientId={patientIdFromEvents}
                      refreshTrigger={state.finalDiagnosis.length}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
