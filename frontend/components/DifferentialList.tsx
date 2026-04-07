"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Info,
} from "lucide-react";

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

interface DifferentialListProps {
  diagnoses: Record<string, unknown>[];
}

function urgencyConfig(urgency: string) {
  switch (urgency) {
    case "high":
      return { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertCircle };
    case "medium":
      return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle };
    default:
      return { color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: Info };
  }
}

function normalizeConfidence(raw: ConfidenceLevel | number | undefined): ConfidenceLevel {
  if (typeof raw === "string" && ["strong", "moderate", "low", "insufficient_evidence"].includes(raw)) return raw as ConfidenceLevel;
  if (typeof raw === "number") {
    if (raw >= 0.7) return "strong";
    if (raw >= 0.4) return "moderate";
    return "low";
  }
  return "moderate";
}

function confidenceLevelStyle(level: ConfidenceLevel) {
  switch (level) {
    case "strong":
      return { label: "Strong", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12", border: "border-emerald-500/20", barColor: "from-emerald-500 to-teal-400", barWidth: "83%" };
    case "moderate":
      return { label: "Moderate", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/12", border: "border-amber-500/20", barColor: "from-amber-500 to-yellow-400", barWidth: "55%" };
    case "low":
      return { label: "Low", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/12", border: "border-orange-500/20", barColor: "from-orange-500 to-red-400", barWidth: "28%" };
    case "insufficient_evidence":
      return { label: "Insufficient", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/12", border: "border-red-500/20", barColor: "from-red-500/60 to-rose-400/60", barWidth: "10%" };
  }
}

function DifferentialCard({ d, index }: { d: Diagnosis; index: number }) {
  const [open, setOpen] = useState(false);
  const urg = urgencyConfig(d.urgency || "low");
  const UrgencyIcon = urg.icon;
  const level = normalizeConfidence(d.confidence);
  const conf = confidenceLevelStyle(level);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="card-elevated overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/45 transition-colors duration-200"
      >
        <div className="metric-tile flex h-10 w-10 items-center justify-center rounded-2xl shrink-0">
          <span className="text-[13px] font-bold text-muted-foreground/84 font-mono">
            #{d.rank || index + 2}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[18px] font-semibold text-foreground truncate">
            {d.diagnosis}
          </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Badge
                    className={`${urg.bg} ${urg.color} ${urg.border} border text-[11px] gap-1 px-2 py-0.5`}
                  >
                    <UrgencyIcon className="h-2.5 w-2.5" />
                    {d.urgency}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Clinical urgency — how dangerous this condition is if present
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <div className="w-28 hidden sm:flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: conf.barWidth }}
                      transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full bg-gradient-to-r ${conf.barColor}`}
                    />
                  </div>
                  <span
                    className={`text-[12px] font-semibold ${conf.color}`}
                  >
                    {conf.label}
                  </span>
                </div>
                <span
                  className={`sm:hidden text-[13px] font-semibold ${conf.color}`}
                >
                  {conf.label}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Suspicion level — how well the symptoms match this diagnosis
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground/70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0 space-y-4 border-t border-border/70">
              {d.explanation && (
                <div className="metric-tile mt-4 p-4">
                  <p className="text-[15px] text-muted-foreground/84 leading-8">
                    {d.explanation}
                  </p>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {d.key_evidence && d.key_evidence.length > 0 && (
                  <div className="surface-tint-emerald rounded-[24px] border border-border/60 p-4">
                    <span className="section-label">
                      Key Evidence
                    </span>
                    <ul className="mt-2 space-y-2">
                      {d.key_evidence.map((ev, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 text-[14px] text-muted-foreground/82 leading-7"
                        >
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground/60 mt-0.5 shrink-0" />
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.recommended_tests && d.recommended_tests.length > 0 && (
                  <div className="surface-tint-cyan rounded-[24px] border border-border/60 p-4">
                    <span className="section-label">
                      Recommended Tests
                    </span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {d.recommended_tests.map((test, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[12px] bg-card/70 border-border text-muted-foreground px-2.5 py-1 font-normal"
                        >
                          <FlaskConical className="h-2.5 w-2.5 mr-1 opacity-80" />
                          {test}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function DifferentialList({ diagnoses }: DifferentialListProps) {
  const diffs = diagnoses as Diagnosis[];
  if (diffs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="card-elevated p-6 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-label mb-2">Alternative diagnoses</div>
            <div className="text-[28px] font-semibold tracking-[-0.05em] text-foreground">
              Differential review
            </div>
            <p className="mt-2 max-w-[44rem] text-[15px] leading-8 text-muted-foreground/78">
              Secondary candidates kept in consideration after the primary diagnosis was selected.
            </p>
          </div>
          <Badge className="w-fit border border-border/70 bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
            {diffs.length} alternative{diffs.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="mt-6 space-y-3">
          {diffs.map((d, i) => (
            <DifferentialCard key={i} d={d} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
