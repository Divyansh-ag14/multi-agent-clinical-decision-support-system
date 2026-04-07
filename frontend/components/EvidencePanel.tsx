"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  FileText,
  Search,
  AlertCircle,
} from "lucide-react";
import type { AgentEvent } from "@/hooks/useDiagnosis";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EvidenceAnalysis {
  hypothesis?: string;
  support_level?: string;
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
  relevance_score?: number;
  key_findings?: string;
  citations?: RagChunk[];
}

interface RagChunk {
  source?: string;
  source_title?: string;
  source_path?: string;
  source_type?: string;
  document_type?: string;
  condition?: string;
  section?: string;
  page?: number;
  chunk_index?: number;
  retrieval_strategy?: string;
  retrieval_query?: string;
  content?: string;
}

interface EvidencePanelProps {
  events: AgentEvent[];
  evidence: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function supportLevelConfig(level: string) {
  switch (level) {
    case "strong":
      return {
        color: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-400/20",
        bg: "bg-emerald-500/8",
        label: "Strong support",
      };
    case "moderate":
      return {
        color: "text-amber-700 dark:text-amber-400",
        border: "border-amber-400/20",
        bg: "bg-amber-500/8",
        label: "Moderate support",
      };
    default:
      return {
        color: "text-red-700 dark:text-red-400",
        border: "border-red-400/20",
        bg: "bg-red-500/8",
        label: "Weak support",
      };
  }
}

function strongestAnalysis(analyses: EvidenceAnalysis[]) {
  return [...analyses].sort(
    (a, b) => (b.relevance_score || 0) - (a.relevance_score || 0)
  )[0];
}

/* ------------------------------------------------------------------ */
/*  DiagnosisEvidenceCard                                              */
/* ------------------------------------------------------------------ */

function DiagnosisEvidenceCard({
  analysis,
  index,
}: {
  analysis: EvidenceAnalysis;
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  const support = supportLevelConfig(analysis.support_level || "weak");

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
        className="w-full flex items-center gap-3 px-5 py-5 text-left transition-colors duration-200 hover:bg-accent/45"
      >
        <Search className="h-4 w-4 text-cyan-500 dark:text-cyan-400/85 shrink-0" />
        <span className="flex-1 truncate text-[18px] font-semibold text-foreground">
          {analysis.hypothesis || "Unknown"}
        </span>
        <Badge
          variant="outline"
          className={`px-2.5 py-1 text-[12px] font-medium ${support.color} ${support.border} ${support.bg}`}
        >
          {support.label}
        </Badge>
        {analysis.relevance_score != null && (
          <span className="text-[13px] font-mono tabular-nums text-muted-foreground/72">
            {(analysis.relevance_score * 100).toFixed(0)}%
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground/70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180" : ""
          }`}
        />
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
            <div className="space-y-4 border-t border-border/70 px-5 pb-5">
              {/* Key findings */}
              {analysis.key_findings && (
                <p className="pt-3 text-[15px] italic leading-7 text-muted-foreground/84">
                  {analysis.key_findings}
                </p>
              )}

              {/* Two-column: supporting vs contradicting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Supporting */}
                <div className="surface-tint-emerald rounded-[22px] border border-emerald-500/15 p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400/80" />
                    <span className="section-label text-emerald-400/70">
                      Supporting
                    </span>
                  </div>
                  {analysis.supporting_evidence &&
                  analysis.supporting_evidence.length > 0 ? (
                    <ul className="space-y-1.5">
                      {analysis.supporting_evidence.map((ev, i) => (
                        <li
                          key={i}
                          className="text-[14px] text-muted-foreground/82 leading-7 flex items-start gap-2"
                        >
                          <span className="text-emerald-500/60 mt-px shrink-0">&bull;</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-muted-foreground/72 italic">
                      None identified
                    </p>
                  )}
                </div>

                {/* Contradicting */}
                <div className="surface-tint-amber rounded-[22px] border border-amber-500/15 p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <AlertTriangle className="h-3 w-3 text-amber-400/80" />
                    <span className="section-label text-amber-400/70">
                      Contradicting
                    </span>
                  </div>
                  {analysis.contradicting_evidence &&
                  analysis.contradicting_evidence.length > 0 ? (
                    <ul className="space-y-1.5">
                      {analysis.contradicting_evidence.map((ev, i) => (
                        <li
                          key={i}
                          className="text-[14px] text-muted-foreground/82 leading-7 flex items-start gap-2"
                        >
                          <span className="text-amber-500/60 mt-px shrink-0">&bull;</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-muted-foreground/72 italic">
                      None identified
                    </p>
                  )}
                </div>
              </div>

              {analysis.citations && analysis.citations.length > 0 && (
                <div className="metric-tile rounded-[22px] p-4">
                  <div className="mb-3 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-cyan-500 dark:text-cyan-400/80" />
                    <span className="section-label">Supporting sources</span>
                  </div>
                  <div className="space-y-3">
                    {analysis.citations.map((citation, citationIndex) => (
                      <div
                        key={`${citation.source_path || citation.source}-${citation.page || "na"}-${citationIndex}`}
                        className="rounded-[18px] border border-border/60 bg-background/58 px-4 py-4 shadow-[inset_0_1px_0_oklch(1_0_0/0.25)]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-foreground">
                            {citation.source}
                          </span>
                          {citation.page != null && (
                            <Badge
                              variant="outline"
                              className="border-border bg-card/70 px-2 py-0.5 text-[11px] font-normal"
                            >
                              Page {citation.page}
                            </Badge>
                          )}
                          {citation.section && (
                            <Badge
                              variant="outline"
                              className="border-border bg-card/70 px-2 py-0.5 text-[11px] font-normal"
                            >
                              {citation.section}
                            </Badge>
                          )}
                          {citation.document_type && (
                            <Badge
                              variant="outline"
                              className="border-border bg-card/70 px-2 py-0.5 text-[11px] font-normal uppercase"
                            >
                              {citation.document_type}
                            </Badge>
                          )}
                          {citation.retrieval_strategy && (
                            <Badge
                              variant="outline"
                              className="border-border bg-card/70 px-2 py-0.5 text-[11px] font-normal"
                            >
                              {citation.retrieval_strategy}
                            </Badge>
                          )}
                        </div>
                        {citation.source_title && citation.source_title !== citation.source && (
                          <p className="mt-2 text-[12px] text-muted-foreground/68">
                            {citation.source_title}
                          </p>
                        )}
                        {citation.source_path && (
                          <p className="mt-2 text-[12px] text-muted-foreground/68">
                            {citation.source_path}
                          </p>
                        )}
                        {citation.retrieval_query && (
                          <p className="mt-2 text-[12px] text-muted-foreground/62">
                            Retrieved for: <span className="font-mono">{citation.retrieval_query}</span>
                          </p>
                        )}
                        {citation.content && (
                          <p className="mt-2 text-[13px] leading-7 text-muted-foreground/78">
                            {citation.content.slice(0, 260)}
                            {citation.content.length > 260 ? "..." : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  RAG Source Group                                                    */
/* ------------------------------------------------------------------ */

function RagSourceGroup({
  label,
  chunks,
  index,
}: {
  label: string;
  chunks: RagChunk[];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="card-elevated overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-accent/55 transition-colors duration-200"
      >
        <FileText className="h-4 w-4 text-cyan-500 dark:text-cyan-400/80 shrink-0" />
        <span className="text-[15px] font-medium text-foreground/92 flex-1 truncate">
          {label}
        </span>
        <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border bg-card/70 font-mono">
          {chunks.length}
        </Badge>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/65 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/70 divide-y divide-border/60">
              {chunks.map((chunk, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="text-[11px] px-2 py-0.5 border-cyan-500/15 text-cyan-600 dark:text-cyan-400/80 font-normal"
                    >
                      {chunk.section || "General"}
                    </Badge>
                    {chunk.page != null && (
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 border-border bg-card/70 font-normal"
                      >
                        Page {chunk.page}
                      </Badge>
                    )}
                    {chunk.source && (
                      <span className="text-[11px] text-muted-foreground/68">
                        {chunk.source}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-muted-foreground/82 leading-7 whitespace-pre-wrap">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function EvidencePanel({ events, evidence }: EvidencePanelProps) {
  const analyses = evidence as unknown as EvidenceAnalysis[];

  /* Extract RAG chunks and evidence gaps from events */
  const evidenceEvent = events
    .filter((e) => e.type === "agent_update" && e.agent === "evidence")
    .pop();
  const output = evidenceEvent?.output || {};
  const rawChunks = (output.retrieved_chunks as RagChunk[]) || [];
  const gaps = (output.evidence_gaps as string[]) || [];
  const overallAssessment = output.overall_assessment as string;
  const leadAnalysis = strongestAnalysis(analyses);

  /* Group chunks by condition */
  const groupedChunks: Record<string, RagChunk[]> = {};
  for (const chunk of rawChunks) {
    const key = chunk.source_path || chunk.source || chunk.condition || "Other";
    if (!groupedChunks[key]) groupedChunks[key] = [];
    groupedChunks[key].push(chunk);
  }

  if (analyses.length === 0 && rawChunks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-card/80 border border-border mb-4 shadow-sm">
          <Search className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-[16px] text-muted-foreground/82">
          Evidence will appear here after the analysis completes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="card-elevated p-6 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="section-label">Evidence overview</span>
              </div>
              <h3 className="text-[30px] font-semibold tracking-[-0.05em] text-foreground sm:text-[34px]">
                {leadAnalysis?.hypothesis
                  ? `${leadAnalysis.hypothesis} has the clearest support`
                  : "Evidence review completed"}
              </h3>
              {overallAssessment && (
                <p className="mt-3 max-w-3xl text-[16px] leading-8 text-muted-foreground/84">
                  {overallAssessment}
                </p>
              )}
            </div>

            {leadAnalysis && (
              <div className="metric-tile min-w-[220px] px-4 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/62">
                  Top evidence signal
                </div>
                <div className="mt-2 text-[19px] font-semibold tracking-[-0.03em] text-foreground">
                  {leadAnalysis.hypothesis}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`px-2.5 py-1 text-[12px] ${supportLevelConfig(leadAnalysis.support_level || "weak").color} ${supportLevelConfig(leadAnalysis.support_level || "weak").border} ${supportLevelConfig(leadAnalysis.support_level || "weak").bg}`}
                  >
                    {supportLevelConfig(leadAnalysis.support_level || "weak").label}
                  </Badge>
                  <span className="text-[13px] font-mono tabular-nums text-muted-foreground/72">
                    {leadAnalysis.relevance_score != null
                      ? `${(leadAnalysis.relevance_score * 100).toFixed(0)}% relevance`
                      : "No score"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="metric-tile p-4">
              <p className="section-label mb-2">Diagnoses reviewed</p>
              <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{analyses.length}</p>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">
                Candidate diagnoses checked against retrieved evidence.
              </p>
            </div>
            <div className="metric-tile p-4">
              <p className="section-label mb-2">Retrieved chunks</p>
              <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{rawChunks.length}</p>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">
                Grounding passages pulled from the local vector store.
              </p>
            </div>
            <div className="metric-tile p-4">
              <p className="section-label mb-2">Evidence gaps</p>
              <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">{gaps.length}</p>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/76">
                Unresolved questions or missing context identified by retrieval.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-5">
          {gaps.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="surface-tint-amber rounded-[24px] border border-amber-500/15 p-5"
            >
              <div className="mb-3 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400/80" />
                <span className="section-label text-amber-600 dark:text-amber-400/70">
                  Evidence gaps
                </span>
              </div>
              <ul className="space-y-1.5">
                {gaps.map((gap, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[14px] leading-7 text-muted-foreground/82"
                  >
                    <span className="mt-px shrink-0 text-amber-400/30">&bull;</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          <div className="surface-tint-cyan rounded-[28px] border border-border/60 p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400/80" />
              <span className="section-label">Source coverage</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {Object.entries(groupedChunks)
                .sort(([, a], [, b]) => b.length - a.length)
                .slice(0, 4)
                .map(([label, chunks]) => (
                  <div key={label} className="metric-tile px-4 py-4">
                    <div className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                      {label}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-muted-foreground/74">
                      {chunks.length} retrieved chunk{chunks.length === 1 ? "" : "s"}
                    </div>
                  </div>
                ))}
              {Object.keys(groupedChunks).length === 0 && (
                <p className="text-[14px] italic text-muted-foreground/72">
                  Source coverage will appear once retrieval returns chunks.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {analyses.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400/80" />
            <span className="section-label">Evidence by diagnosis</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {analyses.map((analysis, i) => (
              <DiagnosisEvidenceCard key={i} analysis={analysis} index={i} />
            ))}
          </div>
        </div>
      )}

      {Object.keys(groupedChunks).length > 0 && (
        <div className="card-elevated p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400/80" />
            <span className="section-label">Retrieved sources</span>
            <Badge
              variant="outline"
              className="ml-auto border-border bg-card/70 px-2 py-0.5 text-[11px] font-mono"
            >
              {rawChunks.length} chunks
            </Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(groupedChunks).map(([label, chunks], i) => (
              <RagSourceGroup
                key={label}
                label={label}
                chunks={chunks}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
