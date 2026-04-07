"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Brain,
  Search,
  ShieldAlert,
  ClipboardCheck,
  Database,
  CheckCircle2,
  Loader2,
  ChevronDown,
  IterationCcw,
  Clock,
  Zap,
  Activity,
} from "lucide-react";
import type { AgentEvent } from "@/hooks/useDiagnosis";

/* ------------------------------------------------------------------ */
/*  Agent node config                                                   */
/* ------------------------------------------------------------------ */

interface NodeDef {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  accent: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

const NODES: NodeDef[] = [
  {
    id: "interviewer",
    label: "Interviewer",
    description: "Clarifies intake and follow-up context",
    icon: Mic,
    color: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500/16 to-teal-500/8",
    bgColor: "bg-green-500/8",
    borderColor: "border-green-500/15",
    dotColor: "bg-green-500",
  },
  {
    id: "hypothesis",
    label: "Hypothesis",
    description: "Generates differential diagnoses",
    icon: Brain,
    color: "text-violet-600 dark:text-violet-400",
    accent: "from-violet-500/16 to-fuchsia-500/8",
    bgColor: "bg-purple-500/8",
    borderColor: "border-purple-500/15",
    dotColor: "bg-purple-500",
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Checks candidates against retrieved knowledge",
    icon: Search,
    color: "text-cyan-600 dark:text-cyan-400",
    accent: "from-cyan-500/16 to-sky-500/8",
    bgColor: "bg-cyan-500/8",
    borderColor: "border-cyan-500/15",
    dotColor: "bg-cyan-500",
  },
  {
    id: "critic",
    label: "Critic",
    description: "Challenges gaps before a decision is made",
    icon: ShieldAlert,
    color: "text-amber-600 dark:text-amber-400",
    accent: "from-amber-500/16 to-orange-500/8",
    bgColor: "bg-orange-500/8",
    borderColor: "border-orange-500/15",
    dotColor: "bg-orange-500",
  },
  {
    id: "decision",
    label: "Decision",
    description: "Synthesizes the ranked assessment",
    icon: ClipboardCheck,
    color: "text-teal-600 dark:text-teal-400",
    accent: "from-teal-500/16 to-emerald-500/8",
    bgColor: "bg-emerald-500/8",
    borderColor: "border-emerald-500/15",
    dotColor: "bg-emerald-500",
  },
  {
    id: "memory_update",
    label: "Memory",
    description: "Stores this visit for future context",
    icon: Database,
    color: "text-sky-600 dark:text-sky-400",
    accent: "from-sky-500/16 to-blue-500/8",
    bgColor: "bg-blue-500/8",
    borderColor: "border-blue-500/15",
    dotColor: "bg-blue-500",
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface WorkflowViewProps {
  events: AgentEvent[];
  currentAgent: string;
  isRunning: boolean;
  completedAgents: string[];
  iteration: number;
  maxIterations: number;
  criticScore: number;
  criticThreshold: number;
  isLooping: boolean;
  isComplete: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeAgentId(agent?: string): string {
  if (!agent) return "";
  if (agent === "memory") return "memory_update";
  if (agent === "skip_critic") return "critic";
  return agent;
}

function computeAgentDurations(events: AgentEvent[]): Record<string, number> {
  const durations: Record<string, number> = {};
  const agentEvents = events.filter((e) => e.type === "agent_update");

  for (let i = 0; i < agentEvents.length; i++) {
    const current = agentEvents[i];
    const next = agentEvents[i + 1];
    const agent = normalizeAgentId(current.agent || "");
    if (agent && next) {
      const start = new Date(current.timestamp).getTime();
      const end = new Date(next.timestamp).getTime();
      durations[agent] = (durations[agent] || 0) + (end - start);
    }
  }
  return durations;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTotalDuration(events: AgentEvent[]): number {
  if (events.length < 2) return 0;
  const start = new Date(events[0].timestamp).getTime();
  const end = new Date(events[events.length - 1].timestamp).getTime();
  return end - start;
}

/* ------------------------------------------------------------------ */
/*  Step summary (for execution log)                                   */
/* ------------------------------------------------------------------ */

function StepSummary({ agent, output }: { agent: string; output: Record<string, unknown> }) {
  const cls = "text-[14px] text-muted-foreground/82 leading-8";

  switch (agent) {
    case "interviewer":
      return (
        <span className={cls}>
          Extracted {(output.extracted_symptoms as string[])?.length || 0} symptoms,
          generated {(output.follow_up_questions as unknown[])?.length || 0} follow-up questions
        </span>
      );
    case "hypothesis": {
      const hyps = (output.hypotheses as { diagnosis?: string; confidence?: number }[]) || [];
      const top = hyps[0];
      return (
        <span className={cls}>
          Generated {hyps.length} hypotheses
          {top ? ` — top: ${top.diagnosis} (${((top.confidence || 0) * 100).toFixed(0)}%)` : ""}
        </span>
      );
    }
    case "evidence":
      return (
        <span className={cls}>
          Analyzed {(output.evidence_analysis as unknown[])?.length || 0} hypotheses,
          retrieved {(output.retrieved_chunks as unknown[])?.length || 0} evidence chunks
        </span>
      );
    case "critic":
    case "skip_critic": {
      const score = output.score as number;
      return (
        <span className={cls}>
          Score:{" "}
          <span className={score >= 0.7 ? "text-orange-400/90" : "text-emerald-400/90"}>
            {typeof score === "number" ? score.toFixed(2) : "N/A"}
          </span>
          {" "}&middot; {(output.issues as unknown[])?.length || 0} issues
        </span>
      );
    }
    case "decision": {
      const diags = (output.final_diagnoses as { diagnosis?: string }[]) || [];
      return (
        <span className={cls}>
          {diags[0]?.diagnosis || "Pending"}
          {diags.length > 1 && ` (+${diags.length - 1} differentials)`}
        </span>
      );
    }
    case "memory_update":
      return (
        <span className={cls}>
          Visit saved &middot; {(output.total_visits as number) || 0} total records
        </span>
      );
    default:
      return null;
  }
}

function stepSummaryText(agent: string, output: Record<string, unknown>): string {
  switch (agent) {
    case "interviewer":
      return `Generated ${(output.follow_up_questions as unknown[])?.length || 0} follow-up prompts`;
    case "hypothesis":
      return `Built ${(output.hypotheses as unknown[])?.length || 0} candidate diagnoses`;
    case "evidence":
      return `Retrieved ${(output.retrieved_chunks as unknown[])?.length || 0} evidence chunks`;
    case "critic":
    case "skip_critic":
      return `Reviewed reasoning with ${(output.issues as unknown[])?.length || 0} flagged issues`;
    case "decision":
      return `Prepared ${(output.final_diagnoses as unknown[])?.length || 0} ranked diagnoses`;
    case "memory_update":
      return `Updated patient memory`;
    default:
      return "Waiting for execution";
  }
}

function getAgentInsightItems(agent: string, output: Record<string, unknown>): string[] {
  switch (agent) {
    case "interviewer": {
      const symptomCount = (output.extracted_symptoms as unknown[])?.length || 0;
      const questionCount = (output.follow_up_questions as unknown[])?.length || 0;
      return [
        `${symptomCount} symptoms extracted from intake`,
        `${questionCount} follow-up prompts generated`,
        "Interview context is ready for differential generation",
      ];
    }
    case "hypothesis": {
      const hyps = (output.hypotheses as { diagnosis?: string; confidence?: number }[]) || [];
      const top = hyps[0];
      return [
        `${hyps.length} candidate diagnoses ranked`,
        top?.diagnosis
          ? `${top.diagnosis} currently leads the differential`
          : "No leading diagnosis available yet",
        top?.confidence != null
          ? `${Math.round((top.confidence || 0) * 100)}% top confidence before evidence review`
          : "Confidence will update after evidence review",
      ];
    }
    case "evidence": {
      const chunks = (output.retrieved_chunks as unknown[])?.length || 0;
      const analysis = (output.evidence_analysis as unknown[])?.length || 0;
      return [
        `${chunks} knowledge chunks retrieved from the vector index`,
        `${analysis} diagnoses evaluated against grounded evidence`,
        "Support and contradiction signals are being assembled now",
      ];
    }
    case "critic":
    case "skip_critic": {
      const issues = (output.issues as unknown[])?.length || 0;
      const score = output.score as number;
      return [
        typeof score === "number"
          ? `Critic score is ${score.toFixed(2)}`
          : "Critic score not available yet",
        `${issues} reasoning issues flagged for review`,
        "Critic output determines whether the graph loops or proceeds",
      ];
    }
    case "decision": {
      const diags = (output.final_diagnoses as { diagnosis?: string }[]) || [];
      return [
        `${diags.length} ranked diagnoses included in the final assessment`,
        diags[0]?.diagnosis
          ? `${diags[0].diagnosis} is the current primary diagnosis`
          : "Primary diagnosis pending",
        "Decision output is ready for evidence and caveat review",
      ];
    }
    case "memory_update": {
      const visits = (output.total_visits as number) || 0;
      return [
        "The current visit is being persisted to long-term memory",
        `${visits} total patient records stored after this run`,
        "Future assessments can use this history as added context",
      ];
    }
    default:
      return ["Workflow activity will appear here once the next agent returns."];
  }
}

/* ------------------------------------------------------------------ */
/*  Execution log entry                                                */
/* ------------------------------------------------------------------ */

function LogEntry({
  event,
  index,
  isActive,
  duration,
}: {
  event: AgentEvent;
  index: number;
  isActive: boolean;
  duration?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const agent = event.agent || "unknown";
  const nodeDef = NODES.find((n) => n.id === agent);
  const Icon = nodeDef?.icon || Brain;
  const color = nodeDef?.color || "text-gray-400";
  const output = event.output || {};

  const hasExpandableContent =
    agent === "interviewer" || agent === "hypothesis" || agent === "evidence";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-4 rounded-[24px] border px-5 py-5 transition-all duration-200 ${
        isActive
          ? "bg-cyan-500/[0.07] border-cyan-500/15 shadow-[var(--shadow-sm)]"
          : "border-border/60 bg-card/46 hover:bg-accent/45"
      }`}
    >
      {/* Icon */}
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? "brand-mark" : "metric-tile"}`}>
          {isActive ? (
            <Loader2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 animate-spin" />
          ) : (
          <Icon className={`h-4 w-4 ${color} opacity-80`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[17px] font-semibold ${color}`}>
            {nodeDef?.label || agent}
          </span>
          {event.iteration != null && event.iteration > 1 && (
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border bg-card/70 font-mono">
              Iter {event.iteration}
            </Badge>
          )}
          {isActive && (
            <Badge className="bg-cyan-600/10 text-cyan-700 dark:text-cyan-400/80 text-[11px] border-cyan-600/15 px-2 py-0.5">
              Running
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {duration != null && (
              <span className="text-[13px] font-mono text-muted-foreground/68 tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
            <span className="text-[13px] font-mono text-muted-foreground/62 tabular-nums">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="mt-0.5">
          <StepSummary agent={agent} output={output} />
        </div>

        {/* Expandable details */}
        {hasExpandableContent && !isActive && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex items-center gap-1 mt-2 text-[13px] text-muted-foreground/68 hover:text-muted-foreground/80 transition-colors"
            >
              <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Less" : "Details"}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <ExpandedDetail agent={agent} output={output} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded detail content                                            */
/* ------------------------------------------------------------------ */

function ExpandedDetail({ agent, output }: { agent: string; output: Record<string, unknown> }) {
  if (agent === "interviewer") {
    const symptoms = (output.extracted_symptoms as string[]) || [];
    const questions = (output.follow_up_questions as { question?: string }[]) || [];
    return (
      <div className="mt-2 space-y-2.5 pl-0.5">
        {symptoms.length > 0 && (
          <div>
            <span className="section-label">Extracted Symptoms</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {symptoms.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[11px] bg-emerald-500/6 border-emerald-500/12 text-emerald-700 dark:text-emerald-300/70 font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {questions.length > 0 && (
          <div>
            <span className="section-label">Follow-up Questions</span>
            <ul className="mt-1 space-y-1">
              {questions.slice(0, 4).map((q, i) => (
                <li key={i} className="text-[13px] text-muted-foreground/78 leading-7">
                  <span className="text-emerald-600 dark:text-emerald-400/70 mr-1 font-mono">Q{i + 1}.</span>
                  {q.question}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (agent === "hypothesis") {
    const hyps = (output.hypotheses as { diagnosis?: string; confidence?: number; reasoning?: string }[]) || [];
    return (
      <div className="mt-2 space-y-1.5 pl-0.5">
        {hyps.map((h, i) => (
          <div key={i} className="text-[13px] text-muted-foreground/78 leading-7">
            <span className="text-violet-600 dark:text-violet-400/75 font-medium font-mono">
              #{i + 1} {h.diagnosis}
            </span>
            <span className="text-muted-foreground/60 ml-1">
              ({((h.confidence || 0) * 100).toFixed(0)}%)
            </span>
            {h.reasoning && (
              <span className="text-muted-foreground/60"> &mdash; {h.reasoning}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (agent === "evidence") {
    const analysis = (output.evidence_analysis as { condition?: string; support_level?: string }[]) || [];
    return (
      <div className="mt-2 space-y-1 pl-0.5">
        {analysis.slice(0, 4).map((a, i) => (
          <div key={i} className="text-[13px] text-muted-foreground/78 flex items-center gap-2">
            <span className="text-cyan-600 dark:text-cyan-400/70 font-medium">{a.condition}</span>
            {a.support_level && (
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border font-normal capitalize">
                {a.support_level}
              </Badge>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function WorkflowView({
  events,
  currentAgent,
  isRunning,
  completedAgents,
  iteration,
  maxIterations,
  criticScore,
  criticThreshold,
  isLooping,
  isComplete,
}: WorkflowViewProps) {
  const agentEvents = useMemo(
    () =>
      events
        .filter((e) => e.type === "agent_update")
        .map((event) => ({
          ...event,
          agent: normalizeAgentId(event.agent || ""),
        })),
    [events]
  );

  const durations = useMemo(() => computeAgentDurations(events), [events]);
  const totalTime = useMemo(() => getTotalDuration(events), [events]);
  const normalizedCurrentAgent = normalizeAgentId(currentAgent);
  const normalizedCompletedAgents = useMemo(
    () => completedAgents.map((agent) => normalizeAgentId(agent)),
    [completedAgents]
  );
  const completedCount = normalizedCompletedAgents.length;
  const progressPct = Math.round((completedCount / NODES.length) * 100);
  const activeNode = NODES.find((node) => node.id === normalizedCurrentAgent);
  const latestEvent = agentEvents[agentEvents.length - 1];
  const latestAgent = latestEvent?.agent || normalizedCurrentAgent;
  const latestOutput = latestEvent?.output || {};
  const averageStageDuration =
    Object.keys(durations).length > 0
      ? Math.round(
          Object.values(durations).reduce((a, b) => a + b, 0) / Object.keys(durations).length
        )
      : 0;

  function nodeStatus(id: string): "completed" | "active" | "pending" {
    if (normalizedCompletedAgents.includes(id)) return "completed";
    if (id === normalizedCurrentAgent && isRunning) return "active";
    return "pending";
  }

  const nextStage = NODES.find((node) => nodeStatus(node.id) === "pending");
  const remainingStages = NODES.filter((node) => nodeStatus(node.id) === "pending").length;
  const iterationsRemaining = Math.max(maxIterations - iteration, 0);

  /* Empty state */
  if (agentEvents.length === 0 && !isRunning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-[20px] bg-card/80 border border-border mb-4 shadow-sm">
            <Activity className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-[18px] text-muted-foreground/82 font-medium">
            Workflow visualization
          </p>
          <p className="text-[14px] text-muted-foreground/68 mt-2">
            Agent activity will appear here during analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-7 py-7">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="card-elevated p-7 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/18 bg-cyan-500/8 px-3 py-1 text-[12px] font-semibold text-cyan-700 dark:text-cyan-300">
                  <Activity className="h-3.5 w-3.5" />
                  Live workflow
                </div>
                <h3 className="mt-4 text-[34px] font-semibold tracking-[-0.05em] text-foreground">
                  {isComplete
                    ? "Clinical assessment finished"
                    : isRunning
                    ? `${activeNode?.label || "Workflow"} is running`
                    : "Workflow ready"}
                </h3>
                <p className="mt-3 max-w-2xl text-[17px] leading-8 text-muted-foreground/82">
                  {isComplete
                    ? "The agent graph completed its pass and the assessment is ready for review."
                    : isRunning
                    ? stepSummaryText(normalizedCurrentAgent, agentEvents[agentEvents.length - 1]?.output || {})
                    : "Once analysis starts, each specialist step will stream updates here in real time."}
                </p>
                <div className="mt-6 rounded-[22px] border border-border/70 bg-card/58 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                      Workflow progress
                    </span>
                    <span className="text-[14px] font-semibold text-foreground">
                      {completedCount}/{NODES.length} stages
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-500 to-emerald-500"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-muted-foreground/74">
                    <span>{isComplete ? "Run completed successfully" : isRunning ? "Stages update as each agent returns" : "Standing by"}</span>
                    <span className="font-mono tabular-nums">{progressPct}%</span>
                  </div>
                </div>
              </div>

              <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="metric-tile px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Current step
                  </div>
                  <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                    {activeNode?.label || "Waiting"}
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {isRunning ? "Receiving live updates" : isComplete ? "All stages complete" : "No step running"}
                  </div>
                </div>
                  <div className="metric-tile px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Elapsed
                  </div>
                  <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                    {totalTime > 0 ? formatDuration(totalTime) : "0s"}
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {agentEvents.length} logged agent updates
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="metric-tile px-4 py-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  <IterationCcw className="h-3.5 w-3.5" />
                  Iteration
                </div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                  {iteration}/{maxIterations}
                </div>
                <div className="mt-1 text-[14px] text-muted-foreground/74">
                  Review loops permitted in this run
                </div>
              </div>

              <div className="metric-tile px-4 py-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Critic score
                </div>
                <div
                  className={`mt-2 text-[22px] font-semibold tracking-[-0.04em] ${
                    criticScore >= criticThreshold
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {criticScore > 0 ? criticScore.toFixed(2) : "N/A"}
                </div>
                <div className="mt-1 text-[14px] text-muted-foreground/74">
                  Threshold {criticThreshold.toFixed(2)}
                </div>
              </div>

              <div className="metric-tile px-4 py-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  <Clock className="h-3.5 w-3.5" />
                  Pace
                </div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                  {averageStageDuration > 0 ? formatDuration(averageStageDuration) : "—"}
                </div>
                <div className="mt-1 text-[14px] text-muted-foreground/74">
                  Average time per completed stage
                </div>
              </div>
            </div>

            {isLooping && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface-tint-amber mt-5 rounded-[20px] border border-amber-500/18 px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <IterationCcw className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                  <div>
                    <div className="text-[15px] font-semibold text-amber-800 dark:text-amber-200">
                      Loop-back triggered
                    </div>
                    <div className="mt-1 text-[14px] leading-7 text-amber-800/84 dark:text-amber-100/78">
                      The critic found enough uncertainty to send the graph back for another refinement pass.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="surface-tint-cyan rounded-[30px] border border-border/60 p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  Stage tracker
                </div>
                <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                  {isComplete ? "All stages closed" : isRunning ? "Analysis in motion" : "Standing by"}
                </div>
              </div>
              {isRunning ? (
                <Badge className="bg-cyan-500/10 px-3 py-1 text-[12px] text-cyan-700 dark:text-cyan-300">
                  Streaming live
                </Badge>
              ) : isComplete ? (
                <Badge className="bg-emerald-500/10 px-3 py-1 text-[12px] text-emerald-700 dark:text-emerald-300">
                  Complete
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[14px] leading-7 text-muted-foreground/76">
              Each stage updates as the graph advances from intake clarification through memory persistence.
            </p>

            <div className="mt-6 space-y-3">
              {NODES.map((node, index) => {
                const status = nodeStatus(node.id);
                const isCurrent = status === "active";
                return (
                  <div
                    key={node.id}
                    className={`rounded-[18px] border px-4 py-4 transition-all ${
                      isCurrent
                        ? `${node.borderColor} bg-gradient-to-br ${node.accent}`
                        : status === "completed"
                        ? "border-border/80 bg-card/76"
                        : "border-border/65 bg-background/52"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            status === "active"
                              ? `${node.bgColor} border ${node.borderColor}`
                              : "border border-border/70 bg-card/80"
                          }`}
                        >
                          {status === "active" ? (
                            <Loader2 className={`h-4 w-4 animate-spin ${node.color}`} />
                          ) : status === "completed" ? (
                            <CheckCircle2 className={`h-4 w-4 ${node.color}`} />
                          ) : (
                            <node.icon className="h-4 w-4 text-muted-foreground/65" />
                          )}
                        </div>
                        <div>
                          <div className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">
                            {index + 1}. {node.label}
                          </div>
                          <div className="mt-0.5 text-[13px] leading-6 text-muted-foreground/74">
                            {node.description}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`px-2.5 py-1 text-[11px] ${
                          status === "active"
                            ? "border-cyan-500/18 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                            : status === "completed"
                            ? "border-emerald-500/18 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-card/72 text-muted-foreground/72"
                        }`}
                      >
                        {status === "active"
                          ? "Running"
                          : status === "completed"
                          ? durations[node.id] != null
                            ? formatDuration(durations[node.id])
                            : "Done"
                          : "Pending"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="card-elevated p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                <span className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                  Execution log
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border bg-card/72 px-2.5 py-1 text-[11px] text-muted-foreground/76">
                  {agentEvents.length} updates
                </Badge>
                <Badge variant="outline" className="border-border bg-card/72 px-2.5 py-1 text-[11px] text-muted-foreground/76">
                  {totalTime > 0 ? formatDuration(totalTime) : "0s"} total
                </Badge>
              </div>
            </div>
            <p className="mt-2 text-[15px] leading-7 text-muted-foreground/76">
              A live activity stream for each specialist agent as the workflow advances.
            </p>

            <div className="mt-5 space-y-3">
              {agentEvents.map((event, idx) => (
                <LogEntry
                  key={`${event.agent}-${event.timestamp}-${idx}`}
                  event={event}
                  index={idx}
                  isActive={isRunning && idx === agentEvents.length - 1}
                  duration={durations[event.agent || ""]}
                />
              ))}

              {isRunning && currentAgent && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-[20px] border border-cyan-500/14 bg-cyan-500/[0.06] px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <div>
                      <div className="text-[16px] font-semibold text-foreground">
                        Processing {normalizedCurrentAgent.replace("_", " ")}
                      </div>
                      <div className="mt-0.5 text-[14px] text-muted-foreground/76">
                        More structured output will appear here as soon as the current step returns.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  Current output
                </div>
                {latestAgent && (
                  <Badge variant="outline" className="border-border bg-card/72 px-2.5 py-1 text-[11px] text-muted-foreground/76">
                    {NODES.find((node) => node.id === latestAgent)?.label || latestAgent}
                  </Badge>
                )}
              </div>
              <div className="mt-3 text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                {latestAgent
                  ? stepSummaryText(latestAgent, latestOutput)
                  : "Waiting for workflow"}
              </div>
              <p className="mt-3 text-[15px] leading-7 text-muted-foreground/78">
                {latestEvent
                  ? `Latest update received at ${new Date(latestEvent.timestamp).toLocaleTimeString()}.`
                  : "The workflow will start updating here once the first agent returns output."}
              </p>
              <div className="mt-4 space-y-3">
                {getAgentInsightItems(latestAgent, latestOutput).map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-border/70 bg-card/62 px-4 py-4 text-[14px] leading-7 text-muted-foreground/78"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                Run diagnostics
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="card-inset px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Next stage
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                    {isComplete ? "Workflow closed" : nextStage?.label || "Awaiting update"}
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {remainingStages} stages remaining in this run
                  </div>
                </div>

                <div className="card-inset px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Loop state
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                    {isLooping ? "Refinement triggered" : isComplete ? "Resolved" : "Linear pass"}
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {iterationsRemaining} refinement pass{iterationsRemaining === 1 ? "" : "es"} left
                  </div>
                </div>

                <div className="card-inset px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Critic gate
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                    {criticScore > 0 ? `${criticScore.toFixed(2)} / ${criticThreshold.toFixed(2)}` : `Threshold ${criticThreshold.toFixed(2)}`}
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {criticScore >= criticThreshold && criticScore > 0
                      ? "Score is high enough to justify another pass"
                      : "Score is below the loop threshold"}
                  </div>
                </div>

                <div className="card-inset px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                    Feed health
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                    {agentEvents.length} events captured
                  </div>
                  <div className="mt-1 text-[14px] text-muted-foreground/74">
                    {averageStageDuration > 0
                      ? `${formatDuration(averageStageDuration)} average per completed step`
                      : "Timing will populate as stages finish"}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                <Activity className="h-3.5 w-3.5" />
                Workflow state
              </div>
              <div className="mt-3 text-[15px] leading-7 text-muted-foreground/78">
                {isComplete
                  ? "All workflow updates have been captured. The diagnosis, evidence, critic, and memory tabs are now stable for review."
                  : isRunning
                  ? `Streaming is active and ${activeNode?.label || "the current stage"} is the active agent. This panel will refresh as soon as the next result arrives.`
                  : "Waiting for the workflow to begin."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
