"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeartPulse, Loader2, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card-elevated w-full max-w-md p-8 space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            </div>
            <h1 className="text-[24px] font-bold tracking-[-0.04em] text-foreground">
              Check your email
            </h1>
            <p className="text-[14px] text-muted-foreground max-w-[30ch]">
              We sent a confirmation link to <span className="text-foreground font-medium">{email}</span>. Click it to activate your account.
            </p>
          </div>
          <Link
            href="/login"
            className="btn-primary inline-flex items-center justify-center w-full"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-elevated w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="brand-mark flex h-14 w-14 items-center justify-center rounded-2xl">
            <HeartPulse className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
          </div>
          <h1 className="text-[24px] font-bold tracking-[-0.04em] text-foreground">
            Create an account
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Clinical Decision Support System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="section-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="premium-input w-full px-4 py-3.5 text-[15px]"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="section-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="premium-input w-full px-4 py-3.5 text-[15px]"
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-[15px]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
