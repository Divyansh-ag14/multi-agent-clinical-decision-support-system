"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, SkipForward, Loader2, HelpCircle, CheckCircle2 } from "lucide-react";
import type { InterviewQuestion } from "@/hooks/useDiagnosis";

interface InterviewFormProps {
  questions: InterviewQuestion[];
  isLoading: boolean;
  symptoms: string[];
  onSubmit: (answers: { question_id: string; question: string; answer: string }[]) => void;
  onSkip: () => void;
}

export function InterviewForm({ questions, isLoading, symptoms, onSubmit, onSkip }: InterviewFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    const formattedAnswers = questions.map((q) => ({
      question_id: q.id,
      question: q.question,
      answer: answers[q.id] || "Not answered",
    }));
    onSubmit(formattedAnswers);
  };

  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;

  if (isLoading) {
    return (
      <Card className="hero-surface shadow-[var(--shadow-md)]" style={{ borderRadius: 28 }}>
        <CardContent className="py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="brand-mark flex h-18 w-18 items-center justify-center rounded-[24px]">
              <Loader2 className="h-8 w-8 text-cyan-600 dark:text-cyan-300 animate-spin" />
            </div>
            <div>
              <h3 className="text-[28px] font-semibold text-foreground tracking-[-0.03em]">Preparing Your Interview</h3>
              <p className="panel-copy mt-3 max-w-lg text-[16px] leading-8">
                The workflow is analyzing the intake signal and generating targeted follow-up questions to improve diagnostic precision.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card className="hero-surface shadow-[var(--shadow-md)]" style={{ borderRadius: 32 }}>
      <CardHeader className="pb-6 px-8 pt-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-[36px] font-semibold tracking-[-0.05em]">
              <div className="brand-mark flex h-12 w-12 items-center justify-center rounded-2xl">
                <MessageCircle className="h-5.5 w-5.5 text-cyan-700 dark:text-cyan-300" />
              </div>
              Follow-Up Questions
            </CardTitle>
            <p className="panel-copy mt-3 max-w-3xl text-[18px] leading-9">
              Based on <span className="text-foreground/90 font-medium">{symptoms.join(", ")}</span>, answer these prompts so the diagnosis graph can reason with stronger intake context.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {symptoms.map((symptom) => (
                <Badge key={symptom} variant="outline" className="px-3.5 py-1.5 text-[13px] bg-card/70 border-border/60 text-muted-foreground">
                  {symptom}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="metric-tile p-4">
              <p className="section-label mb-2">Progress</p>
              <div className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                {answeredCount}/{questions.length}
              </div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/74">
                Questions answered so far
              </p>
            </div>
            <div className="metric-tile p-4">
              <p className="section-label mb-2">Current step</p>
              <div className="text-[18px] font-semibold text-foreground">Intake refinement</div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground/74">
                Improving the symptom profile before diagnosis
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-8 pb-8">
        {questions.map((q, index) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[30px] border border-border/60 bg-background/60 p-6 shadow-[var(--shadow-sm)]"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
              <div className="flex items-start gap-4">
                <div className="brand-mark mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                  <span className="text-[15px] font-bold text-cyan-700 dark:text-cyan-300 font-mono">{index + 1}</span>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <label className="text-[24px] font-medium leading-9 block text-foreground">
                      {q.question}
                    </label>
                    {answers[q.id]?.trim() ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Answered
                      </div>
                    ) : null}
                  </div>
                  {q.clinical_relevance && (
                    <div className="surface-tint-cyan flex items-start gap-2 rounded-[22px] border border-cyan-500/12 px-4 py-3 text-[15px] text-muted-foreground/80 leading-8">
                      <HelpCircle className="h-4 w-4 mt-1 shrink-0 opacity-80" />
                      <span>{q.clinical_relevance}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="surface-tint-emerald rounded-[24px] border border-border/60 p-4 lg:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="section-label">Answer</span>
                  <span className="text-[12px] text-muted-foreground/70">
                    {answers[q.id]?.trim().length ? "Ready" : "Required for stronger context"}
                  </span>
                </div>
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  rows={4}
                  className="premium-textarea resize-none px-5 py-5 text-[17px] leading-9 placeholder:text-muted-foreground/50"
                  placeholder="Type your answer here..."
                />
              </div>
            </div>
          </motion.div>
        ))}

        <div className="flex gap-3 pt-5 border-t border-border/70">
          <Button
            onClick={handleSubmit}
            className="flex-1 h-[60px] btn-primary shadow-md hover:shadow-lg transition-all duration-200 text-[16px]"
            disabled={answeredCount === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit and continue to diagnosis
          </Button>
          <Button
            onClick={onSkip}
            variant="outline"
            className="h-[60px] text-muted-foreground border-border bg-card/70 hover:bg-accent text-[16px]"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip interview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
