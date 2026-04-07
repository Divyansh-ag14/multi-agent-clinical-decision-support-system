"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Info,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MetricInfoTooltip } from "@/components/MetricInfoTooltip";

type ConfidenceLevel = "strong" | "moderate" | "low" | "insufficient_evidence";

interface Diagnosis {
  rank?: number;
  diagnosis?: string;
  confidence?: ConfidenceLevel | number;
  explanation?: string;
  key_evidence?: string[];
  recommended_tests?: string[];
  urgency?: string;
}

interface EvidenceAnalysis {
  hypothesis?: string;
  support_level?: string;
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
  relevance_score?: number;
  key_findings?: string;
}

interface AssessmentHeroProps {
  finalDiagnosis: Record<string, unknown>[];
  clinicalSummary: string;
  caveats: string[];
  evidence: Record<string, unknown>[];
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
}

function urgencyConfig(urgency: string) {
  switch (urgency) {
    case "high":
      return {
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-500/12",
        border: "border-red-500/20",
        icon: AlertCircle,
        label: "High Urgency",
        glow: "shadow-[0_0_15px_oklch(0.65_0.2_25/15%)]",
      };
    case "medium":
      return {
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/12",
        border: "border-amber-500/20",
        icon: AlertTriangle,
        label: "Medium Urgency",
        glow: "shadow-[0_0_15px_oklch(0.7_0.15_80/12%)]",
      };
    default:
      return {
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-500/12",
        border: "border-sky-500/20",
        icon: Info,
        label: "Low Urgency",
        glow: "",
      };
  }
}

function normalizeConfidence(raw: ConfidenceLevel | number | undefined): ConfidenceLevel {
  if (typeof raw === "string") {
    if (["strong", "moderate", "low", "insufficient_evidence"].includes(raw)) return raw as ConfidenceLevel;
    return "moderate";
  }
  // Backwards-compat: convert legacy numeric values
  if (typeof raw === "number") {
    if (raw >= 0.7) return "strong";
    if (raw >= 0.4) return "moderate";
    return "low";
  }
  return "moderate";
}

function confidenceLevelConfig(level: ConfidenceLevel) {
  switch (level) {
    case "strong":
      return {
        label: "Strong suspicion",
        description: "Classic presentation with strong evidence support",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/12",
        border: "border-emerald-500/20",
        gradient: "from-emerald-500 via-teal-400 to-cyan-400",
        ringColor: "oklch(0.7 0.18 160)",
        barWidth: "83%",
        icon: CheckCircle2,
      };
    case "moderate":
      return {
        label: "Moderate suspicion",
        description: "Partial symptom fit or mixed evidence support",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/12",
        border: "border-amber-500/20",
        gradient: "from-amber-500 via-yellow-400 to-orange-400",
        ringColor: "oklch(0.75 0.15 80)",
        barWidth: "55%",
        icon: AlertTriangle,
      };
    case "low":
      return {
        label: "Low suspicion",
        description: "Possible but limited supporting evidence",
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-500/12",
        border: "border-orange-500/20",
        gradient: "from-orange-500 via-red-400 to-rose-400",
        ringColor: "oklch(0.7 0.18 30)",
        barWidth: "28%",
        icon: Info,
      };
    case "insufficient_evidence":
      return {
        label: "Insufficient evidence",
        description: "No relevant evidence retrieved — clinical judgment required",
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-500/12",
        border: "border-red-500/20",
        gradient: "from-red-500/60 via-rose-400/60 to-orange-400/60",
        ringColor: "oklch(0.6 0.2 25)",
        barWidth: "10%",
        icon: AlertCircle,
      };
  }
}

function findPrimaryEvidence(
  primaryName: string | undefined,
  evidence: Record<string, unknown>[]
): EvidenceAnalysis | null {
  if (!primaryName || evidence.length === 0) return null;
  const analyses = evidence as unknown as EvidenceAnalysis[];
  return analyses.find(
    (e) => e.hypothesis?.toLowerCase().trim() === primaryName.toLowerCase().trim()
  ) || null;
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = confidenceLevelConfig(level);
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex flex-col items-center gap-3"
    >
      <div className={`flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 ${config.border} ${config.bg}`}>
        <Icon className={`h-8 w-8 ${config.color}`} />
      </div>
      <div className="text-center">
        <div className={`text-[20px] font-bold tracking-[-0.03em] ${config.color}`}>
          {config.label}
        </div>
      </div>
    </motion.div>
  );
}

export function AssessmentHero({
  finalDiagnosis,
  clinicalSummary,
  caveats,
  evidence,
  isRunning,
  iteration,
  maxIterations,
}: AssessmentHeroProps) {
  const diagnoses = finalDiagnosis as Diagnosis[];

  if (isRunning && diagnoses.length === 0) {
    return (
      <div className="card-gradient-blue rounded-[30px] p-6">
        <div className="flex items-center gap-5">
          <div className="brand-mark flex h-12 w-12 items-center justify-center rounded-2xl">
            <Loader2 className="h-6 w-6 text-cyan-300 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[15px] font-semibold text-foreground">
              AI Clinical Team Analyzing
            </span>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Multiple specialist agents are collaborating on this case
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {Array.from({ length: maxIterations }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                className={`h-2 w-8 rounded-full origin-left ${
                  i < iteration ? "bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_8px_oklch(0.6_0.12_205/30%)]" : "bg-muted"
                }`}
              />
            ))}
            <span className="text-[12px] text-muted-foreground ml-1 font-mono tabular-nums">
              {iteration}/{maxIterations}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (diagnoses.length === 0) return null;

  const primary = diagnoses[0];
  const urg = urgencyConfig(primary.urgency || "low");
  const UrgencyIcon = urg.icon;
  const primaryEvidence = findPrimaryEvidence(primary.diagnosis, evidence);
  const confidenceLevel = normalizeConfidence(primary.confidence);
  const confConfig = confidenceLevelConfig(confidenceLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="card-elevated overflow-hidden">
        <motion.div
          initial={{ scaleX: 0, opacity: 0.45 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="h-1 origin-left bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 px-7 py-6">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl">
              <Shield className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[28px] font-bold text-foreground tracking-[-0.04em] flex items-center gap-2">
                Clinical Assessment Complete
                <Sparkles className="h-4 w-4 text-emerald-500/70 dark:text-emerald-400/60" />
              </h2>
              <p className="text-[14px] text-muted-foreground leading-none mt-1">
                {diagnoses.length} diagnos{diagnoses.length === 1 ? "is" : "es"} identified
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[12px] gap-1.5 px-3 py-1.5 border-border/60 bg-card/70 font-mono">
            <TrendingUp className="h-3 w-3" />
            {iteration} iteration{iteration === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="p-7 space-y-7">
          {clinicalSummary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="metric-tile p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="section-label">Clinical Summary</span>
              </div>
              <p className="text-[16px] text-foreground/84 leading-8">
                {clinicalSummary}
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-background to-cyan-500/[0.03] p-6 shadow-[var(--shadow-sm)]"
          >
            <div className="absolute inset-0 opacity-40 animate-gradient bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-emerald-500/[0.04] pointer-events-none" />

            <div className="relative grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
              <div className="surface-tint-cyan min-w-0 rounded-[28px] border border-border/60 p-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="section-label text-emerald-600 dark:text-emerald-400/80">
                    Primary Diagnosis
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          className={`${urg.bg} ${urg.color} ${urg.border} border text-[12px] gap-1 px-2.5 py-1 font-semibold ${urg.glow}`}
                        >
                          <UrgencyIcon className="h-3 w-3" />
                          {urg.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Clinical urgency — how dangerous this condition is if present
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <h3 className="mt-4 max-w-[12ch] text-[44px] font-bold leading-[0.94] tracking-[-0.055em] text-foreground sm:text-[56px]">
                  {primary.diagnosis}
                </h3>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/62">
                    <span>Evidence strength</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={confConfig.color}>
                            {confConfig.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Suspicion level — how well the symptoms and evidence match this diagnosis
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: confConfig.barWidth }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full bg-gradient-to-r ${confConfig.gradient}`}
                      style={{ boxShadow: `0 0 12px ${confConfig.ringColor}40` }}
                    />
                  </div>
                </div>

                {primary.explanation && (
                  <p className="mt-6 max-w-[65ch] text-[18px] leading-9 text-foreground/82">
                    {primary.explanation}
                  </p>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="metric-tile p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                      <span className="section-label">Urgency</span>
                    </div>
                    <div className={`mt-2 text-[16px] font-semibold ${urg.color}`}>
                      {urg.label}
                    </div>
                    <p className="mt-1 text-[14px] leading-7 text-muted-foreground/74">
                      Escalation guidance based on the current top-ranked assessment.
                    </p>
                  </div>
                  <div className="metric-tile p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                      <span className="section-label">Iterations</span>
                    </div>
                    <div className="mt-2 text-[16px] font-semibold font-mono tabular-nums text-foreground/90">
                      {iteration}/{maxIterations}
                    </div>
                    <p className="mt-1 text-[14px] leading-7 text-muted-foreground/74">
                      Final decision after the workflow refinement loop.
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="surface-tint-emerald rounded-[28px] border border-border/60 p-6 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <ConfidenceBadge level={confidenceLevel} />
                    <div>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                          Evidence assessment
                        </div>
                        <MetricInfoTooltip
                          label="Evidence assessment"
                          description="This level reflects how well the retrieved medical evidence and symptom presentation support the leading diagnosis. It is a qualitative assessment, not a statistical probability."
                        />
                      </div>
                      <p className="mt-2 text-[15px] leading-7 text-muted-foreground/78">
                        {confConfig.description}
                      </p>
                    </div>
                  </div>
                </div>

                {primary.recommended_tests && primary.recommended_tests.length > 0 && (
                  <div className="metric-tile p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical className="h-4 w-4 text-blue-500/90 dark:text-blue-400/90" />
                      <span className="section-label">Recommended next tests</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {primary.recommended_tests.slice(0, 6).map((test, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="border-border bg-card/70 px-2.5 py-1 text-[12px] font-normal text-muted-foreground"
                        >
                          {test}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="metric-tile p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-cyan-500 dark:text-cyan-300" />
                    <span className="section-label">Decision note</span>
                  </div>
                  <p className="text-[15px] leading-7 text-foreground/82">
                    This recommendation reflects the final synthesis after evidence review and {iteration} workflow iteration{iteration === 1 ? "" : "s"}.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="surface-tint-emerald rounded-[28px] border border-border/60 p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span className="section-label text-emerald-600 dark:text-emerald-400/80">Supporting Findings</span>
              </div>
              <ul className="space-y-2.5">
                {primary.key_evidence?.map((ev, i) => (
                  <li key={`key-${i}`} className="flex items-start gap-2.5 text-[14px] text-foreground/82 leading-7">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/80 mt-0.5 shrink-0" />
                    <span>{ev}</span>
                  </li>
                ))}
                {primaryEvidence?.supporting_evidence
                  ?.filter((se) => !primary.key_evidence?.some((ke) => ke.toLowerCase() === se.toLowerCase()))
                  .slice(0, 3)
                  .map((ev, i) => (
                    <li key={`sup-${i}`} className="flex items-start gap-2.5 text-[14px] text-foreground/82 leading-7">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/80 mt-0.5 shrink-0" />
                      <span>{ev}</span>
                    </li>
                  ))}
                {(!primary.key_evidence || primary.key_evidence.length === 0) &&
                  (!primaryEvidence?.supporting_evidence || primaryEvidence.supporting_evidence.length === 0) && (
                    <li className="text-[14px] text-muted-foreground italic">No supporting evidence available</li>
                  )}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="space-y-4"
            >
              <div className="surface-tint-amber rounded-[28px] border border-border/60 p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <span className="section-label text-amber-600 dark:text-amber-400/80">Caution Points</span>
                </div>
                {primaryEvidence?.contradicting_evidence && primaryEvidence.contradicting_evidence.length > 0 ? (
                  <ul className="space-y-2">
                    {primaryEvidence.contradicting_evidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-foreground/82 leading-7">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-muted-foreground italic">No contradicting evidence found</p>
                )}
              </div>
            </motion.div>
          </div>

          {caveats && caveats.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-[24px] bg-amber-500/[0.06] border border-amber-500/15 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span className="section-label text-amber-600 dark:text-amber-400/80">Important Limitations</span>
              </div>
              <ul className="space-y-1.5">
                {caveats.map((caveat, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] text-foreground/78 leading-7">
                    <span className="text-amber-400/60 mt-px shrink-0">&bull;</span>
                    <span>{caveat}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          <p className="text-[12px] text-muted-foreground/72 leading-7 text-center pt-2">
            This AI-assisted assessment is for clinical decision support only. It does not replace professional medical judgment.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
