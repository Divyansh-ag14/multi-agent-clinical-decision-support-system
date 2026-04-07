"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, GitCompare, Loader2, ShieldAlert, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CompareResult {
  critic_enabled: boolean;
  final_diagnosis: { diagnosis?: string; confidence?: string | number; rank?: number }[];
  iterations: number;
  critic_feedback: Record<string, unknown>;
}

interface CriticToggleProps {
  symptoms: string[];
  patientId: string;
}

export function CriticToggle({ symptoms, patientId }: CriticToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withCritic, setWithCritic] = useState<CompareResult | null>(null);
  const [withoutCritic, setWithoutCritic] = useState<CompareResult | null>(null);

  if (symptoms.length === 0) return null;

  const runComparison = async () => {
    setIsLoading(true);
    setError(null);
    setWithCritic(null);
    setWithoutCritic(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/diagnose/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          patient_id: patientId,
          symptoms,
          max_iterations: 3,
        }),
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();

      setWithCritic(data.with_critic ?? null);
      setWithoutCritic(data.without_critic ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Comparison failed";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="card-inset shadow-[var(--shadow-sm)]" style={{ borderRadius: 24 }}>
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <GitCompare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          Critic Impact Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Button
          onClick={runComparison}
          disabled={isLoading}
          variant="outline"
          className="w-full mb-4 border-border/60 hover:bg-accent transition-all duration-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running both workflows...
            </>
          ) : (
            <>
              <GitCompare className="h-4 w-4 mr-2" />
              Compare With vs Without Critic
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-4 text-[12px] text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {withCritic && withoutCritic && (
          <div className="grid grid-cols-2 gap-4">
            {/* With Critic */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-[12px] font-medium text-orange-600 dark:text-orange-400">With Critic</span>
                <Badge variant="outline" className="text-[9px] border-border/60 bg-card/50 font-mono">
                  {withCritic.iterations} iter
                </Badge>
              </div>
              {(withCritic.final_diagnosis ?? []).slice(0, 3).map((d, i) => (
                <div key={i} className="text-[12px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[11px] truncate flex-1 text-muted-foreground">{d.diagnosis}</span>
                    <span className="text-[10px] font-medium ml-2 text-muted-foreground/70">
                      {typeof d.confidence === "string" ? d.confidence.replace("_", " ") : `${((d.confidence || 0) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Without Critic */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-medium text-muted-foreground">Without Critic</span>
                <Badge variant="outline" className="text-[9px] border-border/60 bg-card/50 font-mono">
                  {withoutCritic.iterations} iter
                </Badge>
              </div>
              {(withoutCritic.final_diagnosis ?? []).slice(0, 3).map((d, i) => (
                <div key={i} className="text-[12px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[11px] truncate flex-1 text-muted-foreground">{d.diagnosis}</span>
                    <span className="text-[10px] font-medium ml-2 text-muted-foreground/70">
                      {typeof d.confidence === "string" ? d.confidence.replace("_", " ") : `${((d.confidence || 0) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
