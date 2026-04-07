"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  Brain,
  ClipboardCheck,
  Database,
  Play,
  RotateCcw,
  Square,
  Stethoscope,
  Waves,
} from "lucide-react";

const QUICK_SYMPTOMS = [
  "fever", "cough", "shortness of breath", "chest pain", "headache",
  "fatigue", "nausea", "dizziness", "weight loss", "weight gain",
  "abdominal pain", "back pain", "joint pain", "rash", "swelling",
  "vomiting", "diarrhea", "constipation", "insomnia", "anxiety",
];

interface SymptomInputProps {
  onStart: (symptoms: string[], patientId: string, criticEnabled: boolean, maxIterations: number) => void;
  onStop: () => void;
  onReset: () => void;
  isRunning: boolean;
}

export function SymptomInput({ onStart, onStop, onReset, isRunning }: SymptomInputProps) {
  const [text, setText] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [patientId] = useState(() => `session_${Date.now().toString(36)}`);
  const [criticEnabled, setCriticEnabled] = useState(true);
  const [maxIterations, setMaxIterations] = useState(3);

  const textSymptoms = text
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const totalSymptoms = selectedSymptoms.length + textSymptoms.length;

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSubmit = () => {
    const allSymptoms = [...new Set([...selectedSymptoms, ...textSymptoms])];
    if (allSymptoms.length === 0) return;
    onStart(allSymptoms, patientId, criticEnabled, maxIterations);
  };

  const handleReset = () => {
    setText("");
    setSelectedSymptoms([]);
    setCriticEnabled(true);
    setMaxIterations(3);
    onReset();
  };

  return (
    <Card className="border-transparent bg-transparent shadow-none ring-0" style={{ borderRadius: 24 }}>
      <CardHeader className="px-7 pb-5 pt-7 sm:px-8 sm:pt-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/16 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Waves className="h-3 w-3" />
              Intake workspace
            </div>
            <div className="flex flex-wrap gap-2">
              {["Guided intake", "Evidence-backed workflow", "Critic-aware review"].map((item) => (
                <div key={item} className="premium-pill inline-flex items-center rounded-full px-3.5 py-2 text-[12px] font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
            <div className="space-y-4">
              <CardTitle className="flex items-start gap-4 text-[40px] font-semibold tracking-[-0.07em] text-foreground sm:text-[48px]">
                <div className="brand-mark mt-1 flex h-13 w-13 items-center justify-center rounded-[20px]">
                  <Stethoscope className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                </div>
                <span>Shape the case before the workflow runs.</span>
              </CardTitle>

              <p className="panel-copy max-w-4xl text-[18px] leading-9">
                Capture the story once, add structured signals, and tune how reflective the system should be before it returns a ranked clinical assessment.
              </p>

              <div className="flex flex-wrap gap-3 xl:max-w-[920px]">
                {[
                  {
                    label: "Selected symptoms",
                    value: String(totalSymptoms),
                    copy: "Narrative and structured symptom count combined.",
                  },
                  {
                    label: "Reasoning mode",
                    value: criticEnabled ? "Critic on" : "Critic off",
                    copy: criticEnabled
                      ? "The workflow will challenge itself before finalizing."
                      : "The graph will move directly to the decision pass.",
                  },
                  {
                    label: "Loop depth",
                    value: `${maxIterations} pass${maxIterations === 1 ? "" : "es"}`,
                    copy: "Maximum refinement passes for this case.",
                  },
                ].map(({ label, value, copy }) => (
                  <div
                    key={label}
                    className="min-w-[190px] flex-1 metric-tile px-5 py-4"
                  >
                    <div className="section-label mb-2">{label}</div>
                    <div className="text-[22px] font-semibold tracking-[-0.045em] text-foreground">
                      {value}
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-muted-foreground/72">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-inset rounded-[30px] p-5">
              <p className="section-label mb-2 text-primary/90">What the system does next</p>
              <p className="text-[16px] leading-8 text-foreground/82">
                Once intake is launched, the workspace moves through clarification, differentials, evidence review, critique, decision, and patient-linked memory.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { icon: Brain, title: "Hypothesis pass", copy: "Generate and rank differentials before retrieval begins." },
                  { icon: ClipboardCheck, title: "Decision synthesis", copy: "Assemble the final ranked brief with caveats and tests." },
                  { icon: Database, title: "Memory update", copy: "Store this visit so future runs can reuse the context." },
                ].map(({ icon: Icon, title, copy }) => (
                  <div key={title} className="flex items-start gap-4 rounded-[22px] border border-border/50 bg-card/50 px-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/14 bg-primary/8 shadow-[var(--glow-blue)]">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.03em] text-foreground">{title}</p>
                      <p className="mt-1 text-[13px] leading-6 text-muted-foreground/74">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-7 px-7 pb-7 sm:px-8 sm:pb-8">
        <div className="soft-divider" />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_360px]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[34px] card-inset p-6 shadow-[var(--shadow-sm)] sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <label className="section-label mb-2 block">Presenting symptoms</label>
                    <p className="panel-copy max-w-2xl text-[16px] leading-8">
                      Describe the case in natural language. This becomes the anchor for the interview, evidence pass, critique, and final recommendation.
                    </p>
                  </div>
                  <Badge className="hidden sm:inline-flex bg-background/70 border border-border/55 px-3 py-1.5 text-[11px] text-muted-foreground">
                    Clinical narrative
                  </Badge>
                </div>

                <div className="mb-5 flex flex-wrap gap-2">
                  {[
                    "Presentation",
                    "Timeline",
                    "Severity",
                    "Context",
                  ].map((item) => (
                    <div key={item} className="premium-pill rounded-full px-3 py-1.5 text-[12px] font-medium">
                      {item}
                    </div>
                  ))}
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={11}
                  className="premium-textarea min-h-[360px] resize-none px-5 py-5 text-[19px] leading-9 placeholder:text-muted-foreground/58"
                  placeholder="Example: 54-year-old patient with three days of fever, productive cough, pleuritic chest discomfort, worsening fatigue, and shortness of breath on exertion."
                  disabled={isRunning}
                />

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {selectedSymptoms.length > 0 ? (
                    selectedSymptoms.slice(0, 8).map((symptom) => (
                      <Badge key={symptom} variant="outline" className="rounded-full border-primary/18 bg-primary/8 px-3 py-1.5 text-[12px] font-medium text-primary dark:text-cyan-100/90">
                        {symptom}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-[13px] text-muted-foreground/66">
                      Add structured symptom tags below to sharpen the intake signal.
                    </p>
                  )}

                  {selectedSymptoms.length > 8 && (
                    <span className="premium-pill inline-flex rounded-full px-3 py-1.5 text-[12px] text-muted-foreground/74">
                      +{selectedSymptoms.length - 8} more
                    </span>
                  )}
                </div>
            </div>

            <div className="rounded-[28px] border border-border/50 bg-card/40 px-5 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <label className="section-label mb-2 block">Symptom library</label>
                    <p className="panel-copy text-[16px] leading-8">
                      Seed the case quickly with structured tags, then let the interview refine the differential.
                    </p>
                  </div>
                  <Badge className="bg-cyan-500/10 border border-cyan-500/18 px-3 py-1 text-cyan-700 dark:text-cyan-300">
                    {selectedSymptoms.length} selected
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {QUICK_SYMPTOMS.map((symptom) => (
                    <Badge
                      key={symptom}
                      variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                      className={`cursor-pointer rounded-full px-4 py-2.5 text-[13px] transition-all duration-200 ${
                        selectedSymptoms.includes(symptom)
                          ? "bg-cyan-600 hover:-translate-y-0.5 hover:bg-cyan-500 border-cyan-500 text-white shadow-sm dark:bg-cyan-500 dark:border-cyan-400 dark:text-slate-950"
                          : "premium-pill hover:-translate-y-0.5 hover:bg-accent border-border bg-background text-muted-foreground"
                      } ${isRunning ? "pointer-events-none opacity-40" : ""}`}
                      onClick={() => toggleSymptom(symptom)}
                    >
                      {symptom}
                    </Badge>
                  ))}
                </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-border/50 bg-card/40 p-5 xl:pt-6">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label mb-2">Critic review</p>
                  <p className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">Reflect before finalizing</p>
                  <p className="panel-copy mt-1 text-[14px] leading-7">
                    Run an explicit self-critique step so the workflow can challenge its own reasoning before the final handoff.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCriticEnabled((prev) => !prev)}
                  aria-pressed={criticEnabled}
                  disabled={isRunning}
                  className={`relative inline-flex h-8 w-14 shrink-0 rounded-full border transition-all duration-200 ${
                    criticEnabled
                      ? "border-emerald-400/25 bg-emerald-500/18"
                      : "border-border/60 bg-background/60"
                  } ${isRunning ? "opacity-40" : "hover:scale-[1.02]"}`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-all duration-200 ${
                      criticEnabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="soft-divider" />

              <div>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="section-label mb-2">Max iterations</p>
                    <p className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">Loop depth</p>
                    <p className="panel-copy mt-1 text-[14px] leading-7">
                      Set how many hypothesis, evidence, and critic loops the graph can complete for this case.
                    </p>
                  </div>
                  <div className="premium-pill rounded-full px-3 py-1.5 text-[12px] font-semibold text-foreground">
                    {maxIterations} loops
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxIterations(n)}
                      disabled={isRunning}
                      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border px-4 text-[14px] font-semibold transition-all duration-200 ${
                        maxIterations === n
                          ? "border-foreground bg-foreground text-background shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                          : "border-border/60 bg-background/58 text-foreground/80 hover:-translate-y-0.5 hover:bg-background/76"
                      } ${isRunning ? "opacity-40" : ""}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="soft-divider" />

              <div>
                <div className="section-label mb-2">Workflow outline</div>
                <div className="space-y-2 text-[14px] leading-7 text-muted-foreground/76">
                  <p>1. Intake story becomes the case anchor.</p>
                  <p>2. Interview sharpens missing context.</p>
                  <p>3. Evidence, critique, decision, and memory update in one workspace.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="soft-divider" />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="premium-pill inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px]">
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
            Ready to hand off into guided interview
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isRunning ? (
              <Button
                onClick={handleSubmit}
                className="btn-primary h-[58px] min-w-[320px] rounded-2xl px-6 text-[16px] shadow-md hover:shadow-lg transition-all duration-200"
                disabled={selectedSymptoms.length === 0 && text.trim() === ""}
              >
                <Play className="mr-2 h-4 w-4" />
                Launch intake and begin assessment
              </Button>
            ) : (
              <Button onClick={onStop} variant="destructive" className="h-[58px] min-w-[220px] rounded-2xl shadow-sm text-[16px]">
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            )}

            <Button onClick={handleReset} variant="outline" size="icon" className="h-[58px] w-[58px] rounded-2xl border-border/60 bg-card/70 hover:bg-accent">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
