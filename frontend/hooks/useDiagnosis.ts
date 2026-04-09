"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AgentEvent {
  type: string;
  agent?: string;
  node?: string;
  timestamp: string;
  output?: Record<string, unknown>;
  iteration?: number;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  clinical_relevance: string;
  type: string;
}

export interface InterviewResult {
  follow_up_questions: InterviewQuestion[];
  extracted_symptoms: string[];
  symptom_summary: string;
}

export interface DiagnosisState {
  events: AgentEvent[];
  isRunning: boolean;
  currentAgent: string;
  iteration: number;
  maxIterations: number;
  symptoms: string[];
  hypotheses: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  criticFeedback: Record<string, unknown>;
  finalDiagnosis: Record<string, unknown>[];
  clinicalSummary: string;
  caveats: string[];
  patientMemory: Record<string, unknown>[];
  error: string | null;
  criticEnabled: boolean;
  criticThreshold: number;
  // Interview phase
  phase: "input" | "interview" | "diagnosing" | "complete";
  interviewQuestions: InterviewQuestion[];
  interviewLoading: boolean;
}

const initialState: DiagnosisState = {
  events: [],
  isRunning: false,
  currentAgent: "",
  iteration: 0,
  maxIterations: 3,
  symptoms: [],
  hypotheses: [],
  evidence: [],
  criticFeedback: {},
  finalDiagnosis: [],
  clinicalSummary: "",
  caveats: [],
  patientMemory: [],
  error: null,
  criticEnabled: true,
  criticThreshold: 0.3,
  phase: "input",
  interviewQuestions: [],
  interviewLoading: false,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function log(label: string, ...args: unknown[]) {
  console.log(`[CDSS ${new Date().toISOString()}] ${label}`, ...args);
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export function useDiagnosis() {
  const [state, setState] = useState<DiagnosisState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const configRef = useRef<{
    patientId: string;
    criticEnabled: boolean;
    maxIterations: number;
    symptoms: string[];
  }>({ patientId: "anonymous", criticEnabled: true, maxIterations: 3, symptoms: [] });

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState(initialState);
  }, []);

  // Phase 1: Submit symptoms and get interview questions
  const startInterview = useCallback(
    async (
      symptoms: string[],
      patientId: string = "anonymous",
      criticEnabled: boolean = true,
      maxIterations: number = 3
    ) => {
      reset();
      configRef.current = { patientId, criticEnabled, maxIterations, symptoms };
      log("startInterview", { symptoms, patientId, criticEnabled, maxIterations });

      setState((prev) => ({
        ...prev,
        symptoms,
        criticEnabled,
        maxIterations,
        interviewLoading: true,
        phase: "interview",
        error: null,
      }));

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/interview`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            patient_id: patientId,
            symptoms,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result: InterviewResult = await response.json();
        log("interview response", { questions: result.follow_up_questions?.length, result });

        setState((prev) => ({
          ...prev,
          interviewQuestions: result.follow_up_questions || [],
          interviewLoading: false,
        }));
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          interviewLoading: false,
          phase: "input",
          error: err instanceof Error ? err.message : "Failed to generate interview questions",
        }));
      }
    },
    [reset]
  );

  // Phase 2: Submit answers and run full diagnosis
  const submitAnswersAndDiagnose = useCallback(
    async (answers: { question_id: string; question: string; answer: string }[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { patientId, criticEnabled, maxIterations, symptoms } = configRef.current;
      log("submitAnswersAndDiagnose", { answers: answers.length, symptoms, patientId });

      setState((prev) => ({
        ...prev,
        isRunning: true,
        phase: "diagnosing",
        error: null,
      }));

      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/diagnose`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            patient_id: patientId,
            symptoms,
            critic_enabled: criticEnabled,
            max_iterations: maxIterations,
            interview_answers: answers,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          let done: boolean;
          let value: Uint8Array | undefined;
          try {
            ({ done, value } = await reader.read());
          } catch (readErr) {
            if (readErr instanceof Error && readErr.name === "AbortError") break;
            log("SSE stream read error", readErr);
            setState((prev) => ({
              ...prev,
              isRunning: false,
              phase: "complete",
              error: "Connection lost during diagnosis. Please try again.",
            }));
            return;
          }
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              // Capture eventType in a block-scoped const so it's not
              // mutated before React processes the batched setState callback.
              const currentEventType = eventType;
              try {
                const data = JSON.parse(line.slice(6));
                const event: AgentEvent = { ...data, type: currentEventType };

                log(`SSE event: ${currentEventType}`, currentEventType === "state_update" ? { node: data.node, keys: Object.keys(data) } : { agent: data.agent });

                setState((prev) => {
                  const newState = { ...prev, events: [...prev.events, event] };

                  if (currentEventType === "start") {
                    if (typeof data.critic_threshold === "number") {
                      newState.criticThreshold = data.critic_threshold;
                    }
                  }

                  if (currentEventType === "agent_update") {
                    newState.currentAgent = data.agent || "";
                  }

                  if (currentEventType === "state_update") {
                    if (data.hypotheses) newState.hypotheses = data.hypotheses;
                    if (data.evidence) newState.evidence = data.evidence;
                    if (data.critic_feedback) newState.criticFeedback = data.critic_feedback;
                    if (data.final_diagnosis) {
                      log("Setting finalDiagnosis", data.final_diagnosis.length, "entries");
                      newState.finalDiagnosis = data.final_diagnosis;
                    }
                    if (data.clinical_summary) newState.clinicalSummary = data.clinical_summary;
                    if (data.caveats) newState.caveats = data.caveats;
                    if (data.patient_memory) newState.patientMemory = data.patient_memory;
                    if (data.iterations !== undefined) newState.iteration = data.iterations;
                    if (data.symptoms) newState.symptoms = data.symptoms;
                  }

                  if (currentEventType === "complete") {
                    log("Diagnosis complete", { finalDiagnosis: newState.finalDiagnosis.length, phase: "complete" });
                    newState.isRunning = false;
                    newState.currentAgent = "";
                    newState.phase = "complete";
                  }

                  if (currentEventType === "error") {
                    log("Diagnosis error", data.message);
                    newState.isRunning = false;
                    newState.error = data.message || "Unknown error";
                    newState.phase = "complete";
                  }

                  return newState;
                });
              } catch {
                // skip malformed JSON
              }
              eventType = "";
            }
          }
        }

        setState((prev) => ({ ...prev, isRunning: false, phase: "complete" }));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isRunning: false,
          phase: "complete",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    []
  );

  // Skip interview and go straight to diagnosis (no answers)
  const skipInterview = useCallback(async () => {
    await submitAnswersAndDiagnose([]);
  }, [submitAnswersAndDiagnose]);

  const stopDiagnosis = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setState((prev) => ({ ...prev, isRunning: false, phase: "complete" }));
    }
  }, []);

  return {
    state,
    startInterview,
    submitAnswersAndDiagnose,
    skipInterview,
    stopDiagnosis,
    reset,
  };
}
