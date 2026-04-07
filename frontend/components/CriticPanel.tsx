"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Lightbulb,
  XCircle,
} from "lucide-react";
import { CriticToggle } from "@/components/CriticToggle";
import { MetricInfoTooltip } from "@/components/MetricInfoTooltip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CriticPanelProps {
  criticFeedback: Record<string, unknown>;
  symptoms: string[];
  patientId: string;
  showComparison: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function CriticPanel({
  criticFeedback,
  symptoms,
  patientId,
  showComparison,
}: CriticPanelProps) {
  const score = criticFeedback?.score as number;
  const issues =
    (criticFeedback?.issues as {
      severity?: string;
      description?: string;
      category?: string;
    }[]) || [];
  const strengths = (criticFeedback?.strengths as string[]) || [];
  const summary = criticFeedback?.summary as string;
  const missingData = (criticFeedback?.missing_data as string[]) || [];
  const contradictions = (criticFeedback?.contradictions as string[]) || [];
  const recommendations = (criticFeedback?.recommendations as string[]) || [];

  const hasFeedback =
    typeof score === "number" || issues.length > 0 || strengths.length > 0;

  if (!hasFeedback) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-card/80 border border-border mb-4 shadow-sm">
          <ShieldAlert className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-[16px] text-muted-foreground/80">
          Critic review will appear here after evaluation
        </p>
      </div>
    );
  }

  const scoreColor =
    score >= 0.7
      ? "text-amber-600 dark:text-amber-400"
      : score >= 0.4
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";
  const scoreBg =
    score >= 0.7
      ? "bg-orange-500"
      : score >= 0.4
      ? "bg-amber-500"
      : "bg-emerald-500";
  const scoreLabel =
    score >= 0.7
      ? "Needs improvement"
      : score >= 0.4
      ? "Acceptable with minor issues"
      : "Good quality reasoning";

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="card-elevated p-6 sm:p-7"
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="section-label">Critic review</span>
            </div>
            <h3 className="text-[30px] font-semibold tracking-[-0.05em] text-foreground sm:text-[34px]">
              {scoreLabel}
            </h3>
            <p className="mt-3 max-w-3xl text-[16px] leading-8 text-muted-foreground/82">
              Higher scores mean more unresolved issues, missing patient context, or weak differential coverage before the final decision.
            </p>
            {summary && (
              <p className="mt-4 rounded-[20px] border border-border/70 bg-card/58 px-4 py-4 text-[15px] leading-8 text-muted-foreground/84">
                {summary}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="card-inset p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="section-label">Critic score</p>
                <MetricInfoTooltip
                  label="Critic score"
                  description="The critic score measures how much unresolved risk remains in the reasoning chain. Lower is better. Higher values mean more missing patient context, weaker evidence support, or incomplete differential coverage. When the score crosses the workflow threshold, the graph may loop for another refinement pass."
                />
              </div>
              <div className={`text-[32px] font-bold font-mono tabular-nums tracking-tight ${scoreColor}`}>
                {typeof score === "number" ? score.toFixed(2) : "N/A"}
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(score || 0) * 100}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${scoreBg}`}
                  style={{ boxShadow: `0 0 8px currentColor` }}
                />
              </div>
            </div>
            <div className="card-inset p-4">
              <p className="section-label mb-2">Issues flagged</p>
              <div className="text-[26px] font-semibold tracking-[-0.04em] text-foreground">{issues.length}</div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/74">Problems found in the reasoning chain.</p>
            </div>
            <div className="card-inset p-4">
              <p className="section-label mb-2">Missing data</p>
              <div className="text-[26px] font-semibold tracking-[-0.04em] text-foreground">{missingData.length}</div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/74">Inputs still absent from the case state.</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-tile p-4">
          <p className="section-label mb-2">Recommendations</p>
          <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{recommendations.length}</p>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">Suggested ways to improve or refine the final decision.</p>
        </div>
        <div className="metric-tile p-4">
          <p className="section-label mb-2">Strengths</p>
          <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{strengths.length}</p>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">Reasoning qualities the critic considered solid.</p>
        </div>
        <div className="metric-tile p-4">
          <p className="section-label mb-2">Contradictions</p>
          <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{contradictions.length}</p>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">Signals that weaken the current interpretation.</p>
        </div>
      </div>

      {/* Two-column: Issues + Strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issues */}
        {issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="surface-tint-amber rounded-[28px] border border-border/60 p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80" />
              <span className="section-label text-amber-400/70">
                Issues Found
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 border-border bg-card/70 ml-auto font-mono"
              >
                {issues.length}
              </Badge>
            </div>
            <ul className="space-y-2.5">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <AlertTriangle
                    className={`h-3 w-3 shrink-0 mt-0.5 ${
                      issue.severity === "high"
                        ? "text-red-400/70"
                        : issue.severity === "medium"
                        ? "text-amber-400/70"
                        : "text-blue-400/70"
                    }`}
                  />
                  <div>
                    <span className="text-[14px] text-muted-foreground/82 leading-7">
                      {issue.description}
                    </span>
                    {issue.category && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5 border-border ml-2 text-muted-foreground/70 font-normal"
                      >
                        {issue.category}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="surface-tint-emerald rounded-[28px] border border-border/60 p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" />
              <span className="section-label text-emerald-400/70">
                Strengths
              </span>
            </div>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[14px] text-muted-foreground/82 leading-7"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-500/60 shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      {/* Missing data + Contradictions + Recommendations */}
      {(missingData.length > 0 ||
        contradictions.length > 0 ||
        recommendations.length > 0) && (
        <div className="space-y-3">
          {missingData.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="metric-tile p-5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3 w-3 text-blue-400/70" />
                <span className="section-label">
                  Missing Data
                </span>
              </div>
              <ul className="space-y-1">
                {missingData.map((d, i) => (
                  <li
                    key={i}
                    className="text-[14px] text-muted-foreground/78 leading-7"
                  >
                    &bull; {d}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {contradictions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="surface-tint-amber rounded-[24px] border border-border/60 p-5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <XCircle className="h-3 w-3 text-red-400/70" />
                <span className="section-label">
                  Contradictions
                </span>
              </div>
              <ul className="space-y-1">
                {contradictions.map((c, i) => (
                  <li
                    key={i}
                    className="text-[14px] text-muted-foreground/78 leading-7"
                  >
                    &bull; {c}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="surface-tint-cyan rounded-[24px] border border-border/60 p-5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3 w-3 text-amber-400/70" />
                <span className="section-label">
                  Recommendations
                </span>
              </div>
              <ul className="space-y-1">
                {recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="text-[14px] text-muted-foreground/78 leading-7"
                  >
                    &bull; {r}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      )}

      {/* Critic comparison toggle */}
      {showComparison && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <div className="flex items-center gap-2.5 mb-3 pt-2">
            <span className="section-label">
              Compare: With vs Without Critic
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <CriticToggle symptoms={symptoms} patientId={patientId} />
        </motion.div>
      )}
    </div>
  );
}
