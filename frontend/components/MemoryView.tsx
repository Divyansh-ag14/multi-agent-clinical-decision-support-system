"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

import {
  Database,
  Clock,
  ChevronDown,
  Stethoscope,
  Activity,
  AlertCircle,
  IterationCcw,
  ShieldAlert,
  TrendingUp,
  User,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Visit {
  id: number;
  patient_id: string;
  timestamp: string;
  symptoms: string[];
  diagnoses: { diagnosis?: string; confidence?: string | number }[];
  confidence: string | number;
  iterations: number;
  critic_score: number;
}

interface MemoryViewProps {
  patientId: string;
  refreshTrigger?: number;
}

/* ------------------------------------------------------------------ */
/*  Visit card                                                         */
/* ------------------------------------------------------------------ */

function VisitCard({ visit, index }: { visit: Visit; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const primaryDiagnosis = visit.diagnoses?.[0];
  const date = new Date(visit.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="group w-full text-left card-elevated p-5 transition-all duration-200 hover:border-border/60"
      >
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Visit number indicator */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl">
              <span className="text-[13px] font-bold text-cyan-700 dark:text-cyan-400/90 font-mono">
                {index + 1}
              </span>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {primaryDiagnosis?.diagnosis && (
                  <span className="text-[15px] font-semibold text-foreground/90 truncate">
                    {primaryDiagnosis.diagnosis}
                  </span>
                )}
                {primaryDiagnosis?.confidence != null && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 font-medium ${
                      typeof primaryDiagnosis.confidence === "string"
                        ? primaryDiagnosis.confidence === "strong"
                          ? "border-emerald-500/15 text-emerald-700 dark:text-emerald-400/85"
                          : primaryDiagnosis.confidence === "moderate"
                          ? "border-blue-500/15 text-sky-700 dark:text-blue-400/85"
                          : "border-orange-500/15 text-amber-700 dark:text-orange-400/85"
                        : (primaryDiagnosis.confidence as number) >= 0.7
                        ? "border-emerald-500/15 text-emerald-700 dark:text-emerald-400/85"
                        : (primaryDiagnosis.confidence as number) >= 0.4
                        ? "border-blue-500/15 text-sky-700 dark:text-blue-400/85"
                        : "border-orange-500/15 text-amber-700 dark:text-orange-400/85"
                    }`}
                  >
                    {typeof primaryDiagnosis.confidence === "string"
                      ? primaryDiagnosis.confidence.replace("_", " ")
                      : `${((primaryDiagnosis.confidence as number) * 100).toFixed(0)}%`}
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                } group-hover:text-muted-foreground/70`}
              />
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Clock className="h-3 w-3" />
                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1">
                <IterationCcw className="h-3 w-3" />
                {visit.iterations} iter
              </span>
              {visit.critic_score > 0 && (
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  {visit.critic_score.toFixed(2)}
                </span>
              )}
            </div>

            {/* Symptoms preview */}
            {visit.symptoms?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {visit.symptoms.slice(0, expanded ? undefined : 4).map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex px-2 py-0.5 rounded-md bg-cyan-500/8 border border-cyan-500/12 text-[10px] text-cyan-700 dark:text-cyan-300/85"
                  >
                    {s}
                  </span>
                ))}
                {!expanded && visit.symptoms.length > 4 && (
                  <span className="text-[10px] text-muted-foreground/60 self-center">
                    +{visit.symptoms.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border/70 ml-[56px]">
                {/* All diagnoses */}
                {visit.diagnoses?.length > 0 && (
                  <div className="mb-4">
                    <span className="section-label block mb-2">Diagnoses</span>
                    <div className="space-y-2.5">
                      {visit.diagnoses.map((d, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground/60">
                                #{i + 1}
                              </span>
                              <span className="text-[13px] text-foreground/88 font-medium">
                                {d.diagnosis}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium text-muted-foreground/70">
                              {typeof d.confidence === "string"
                                ? d.confidence.replace("_", " ")
                                : `${((d.confidence || 0) * 100).toFixed(0)}%`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="metric-tile p-3 text-center">
                    <div className="text-[16px] font-bold text-foreground/85 font-mono tabular-nums">
                      {visit.iterations}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Iterations
                    </div>
                  </div>
                  <div className="metric-tile p-3 text-center">
                    <div className={`text-[16px] font-bold font-mono tabular-nums ${
                      visit.critic_score >= 0.7 ? "text-amber-700 dark:text-orange-400/85" : "text-emerald-700 dark:text-emerald-400/85"
                    }`}>
                      {visit.critic_score > 0 ? visit.critic_score.toFixed(2) : "N/A"}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Critic Score
                    </div>
                  </div>
                  <div className="metric-tile p-3 text-center">
                    <div className="text-[16px] font-bold text-foreground/85 font-mono tabular-nums">
                      {visit.diagnoses?.length || 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Differentials
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats summary header                                               */
/* ------------------------------------------------------------------ */

function StatsSummary({ visits, totalVisits }: { visits: Visit[]; totalVisits: number }) {
  if (visits.length === 0) return null;

  const visibleVisitCount = visits.length;

  // For avg confidence, count visits by qualitative level (skip numeric legacy)
  const levelCounts = { strong: 0, moderate: 0, low: 0, insufficient_evidence: 0, numeric: 0 };
  let numericSum = 0;
  let numericCount = 0;
  visits.forEach((v) => {
    const c = v.diagnoses?.[0]?.confidence;
    if (typeof c === "string" && c in levelCounts) {
      levelCounts[c as keyof typeof levelCounts]++;
    } else if (typeof c === "number") {
      numericSum += c;
      numericCount++;
      levelCounts.numeric++;
    }
  });
  const hasQualitative = levelCounts.strong + levelCounts.moderate + levelCounts.low + levelCounts.insufficient_evidence > 0;
  const mostCommonLevel = hasQualitative
    ? (["strong", "moderate", "low", "insufficient_evidence"] as const)
        .reduce((a, b) => (levelCounts[a] >= levelCounts[b] ? a : b))
    : null;
  const avgConfidenceNumeric = numericCount > 0 ? numericSum / numericCount : 0;
  const avgIterations =
    visits.reduce((sum, v) => sum + (v.iterations || 0), 0) / visibleVisitCount;

  const allDiagnoses = visits.flatMap((v) => v.diagnoses?.map((d) => d.diagnosis) || []).filter(Boolean);
  const uniqueDiagnoses = new Set(allDiagnoses).size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-3 md:grid-cols-4"
    >
      <div className="metric-tile p-4 text-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/8 border border-blue-500/10 mx-auto mb-2">
          <Activity className="h-4 w-4 text-blue-400" />
        </div>
        <div className="text-[20px] font-bold text-foreground/90 font-mono tabular-nums">
          {totalVisits}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
          Total Visits
        </div>
      </div>

      <div className="metric-tile p-4 text-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/8 border border-emerald-500/10 mx-auto mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="text-[20px] font-bold text-foreground/90">
          {mostCommonLevel
            ? mostCommonLevel.replace("_", " ").charAt(0).toUpperCase() + mostCommonLevel.replace("_", " ").slice(1)
            : `${(avgConfidenceNumeric * 100).toFixed(0)}%`}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
          {mostCommonLevel ? "Typical Level" : "Avg Confidence"}
        </div>
      </div>

      <div className="metric-tile p-4 text-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/8 border border-purple-500/10 mx-auto mb-2">
          <Stethoscope className="h-4 w-4 text-violet-600 dark:text-purple-400" />
        </div>
        <div className="text-[20px] font-bold text-foreground/90 font-mono tabular-nums">
          {uniqueDiagnoses}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
          Unique Diagnoses
        </div>
      </div>

      <div className="metric-tile p-4 text-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500/8 border border-orange-500/10 mx-auto mb-2">
          <IterationCcw className="h-4 w-4 text-amber-600 dark:text-orange-400" />
        </div>
        <div className="text-[20px] font-bold text-foreground/90 font-mono tabular-nums">
          {avgIterations.toFixed(1)}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
          Avg Iterations
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function MemoryView({ patientId, refreshTrigger }: MemoryViewProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const controller = new AbortController();

    const fetchMemory = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_URL}/api/memory/${patientId}`, {
          signal: controller.signal,
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        setVisits(data.visits || []);
        setTotalVisits(data.total_visits || 0);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load patient history");
      } finally {
        setLoading(false);
      }
    };

    fetchMemory();
    return () => controller.abort();
  }, [patientId, refreshTrigger]);

  /* Loading state */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-500/8 border border-blue-500/10 mb-4">
            <Database className="h-6 w-6 text-blue-400 animate-pulse" />
          </div>
          <p className="text-[16px] text-muted-foreground/78">Loading patient history...</p>
        </div>
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-red-500/8 border border-red-500/10 mb-4">
            <AlertCircle className="h-6 w-6 text-red-400/80" />
          </div>
          <p className="text-[15px] text-red-600 dark:text-red-400/80">{error}</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            Make sure the backend is running
          </p>
        </div>
      </div>
    );
  }

  /* Empty state */
  if (visits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-card/80 border border-border mb-4 shadow-sm">
            <Database className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-[16px] text-muted-foreground/80 font-medium">
            No visit history
          </p>
          <p className="text-[14px] text-muted-foreground/65 mt-1">
            Previous assessments for this patient will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl space-y-6 p-7">
        {/* Patient header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="card-elevated p-6 sm:p-7"
        >
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="flex items-center gap-4">
              <div className="brand-mark flex h-12 w-12 items-center justify-center rounded-2xl">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="section-label mb-2">Patient history</div>
                <h2 className="text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  Longitudinal visit memory
                </h2>
                <p className="mt-2 text-[15px] leading-7 text-muted-foreground/78">
                  Review prior diagnostic sessions, confidence patterns, and repeated differential outcomes for this patient.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-tile p-4">
                <p className="section-label mb-2">Patient</p>
                <div className="truncate text-[20px] font-mono font-semibold tracking-[-0.03em] text-primary">
                  {patientId}
                </div>
              </div>
              <div className="metric-tile p-4">
                <p className="section-label mb-2">Visits stored</p>
                <div className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                  {totalVisits}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats summary */}
        <StatsSummary visits={visits} totalVisits={totalVisits} />

        {/* Visit list */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Visit Timeline</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2.5">
            {visits.map((visit, index) => (
              <VisitCard key={visit.id} visit={visit} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
