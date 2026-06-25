"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QUESTIONS } from "@/config/questions";
import { useIntakeSession, buildRequest, type IntakeAnswers } from "@/hooks/useIntakeSession";
import { createSession, updateSessionProgress, submitRecommendation } from "@/lib/api";
import { ProgressIndicator } from "@/components/intake/ProgressIndicator";
import { QuestionRenderer } from "@/components/intake/QuestionRenderer";
import { NavControls } from "@/components/intake/NavControls";
import { IntakeDebugPanel } from "@/components/dev/IntakeDebugPanel";
import { LogoSpinner } from "@/components/ui/LogoSpinner";

const TOTAL = QUESTIONS.length;

const LOADER_LINES = [
  "Asking the mountains which hostel has the best chai…",
  "Bribing a retired backpacker for insider tips…",
  "Consulting a yak on the best dorm vibes…",
  "Speed-running 47 hostel reviews so you don't have to…",
  "Negotiating with the WiFi gods on your behalf…",
  "Cross-referencing rooftop sunsets with your vibe…",
  "Filtering out the places with suspiciously lumpy mattresses…",
  "Almost there — the mountains have opinions too…",
];

function LoadingScreen() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOADER_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-8">
      <LogoSpinner size={48} />
      <p key={idx} className="animate-fadeIn max-w-xs text-center text-sm text-zinc-500">
        {LOADER_LINES[idx]}
      </p>
    </main>
  );
}

function friendlyError(raw: string): string {
  if (raw === "internal_error") return "Something went wrong on our end. Please try again.";
  if (raw === "validation_failed")
    return "Some answers look invalid. Please go back and check them.";
  if (raw.startsWith("HTTP 5")) return "Our server had a hiccup. Please try again in a moment.";
  if (raw.startsWith("HTTP 4")) return "Your session may have expired. Try refreshing the page.";
  // fetch throws TypeError("Failed to fetch") when offline or DNS fails
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("networkerror"))
    return "No internet connection. Check your network and try again.";
  return "Something went wrong. Please try again.";
}

export default function IntakePage() {
  const router = useRouter();
  const { session, isLoaded, setAnswer, goToStep, clearSession, fillAnswers } = useIntakeSession();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // null = not yet attempted, true = succeeded, false = failed
  const [sessionSynced, setSessionSynced] = useState<boolean | null>(null);
  const [syncWarningDismissed, setSyncWarningDismissed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stepIndex = session.currentStep;
  const question = QUESTIONS[stepIndex];
  const isLast = stepIndex === TOTAL - 1;
  const currentAnswer = question
    ? (session.answers[question.requestField] as string | undefined)
    : undefined;

  // Ensure the session row exists in the DB once localStorage has resolved.
  // Tracks success so the submit path can retry if this silently failed.
  useEffect(() => {
    if (!isLoaded) return;
    createSession(session.sessionId, {
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
    })
      .then(() => setSessionSynced(true))
      .catch(() => setSessionSynced(false));
  }, [isLoaded, session.sessionId]);

  // Focus the question heading on each step change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  function goBack() {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }

  async function advance(skipCurrentField?: boolean) {
    if (!question) return;
    if (!skipCurrentField && !currentAnswer) return;
    if (isLast) {
      await submit();
      return;
    }
    const nextStep = stepIndex + 1;
    goToStep(nextStep);
    updateSessionProgress(session.sessionId, nextStep, session.answers);
  }

  async function submit() {
    const req = buildRequest(session);
    if (!req) {
      // Should not be reachable normally — CTA is blocked until all required
      // fields are answered. Defensive guard for edge cases (stale storage).
      setSubmitError("Some answers look incomplete. Please go back and check each step.");
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    // Retry session creation if it failed or never resolved (null = still pending).
    // /api/recommend will hit a FK violation if the session row is absent.
    if (sessionSynced !== true) {
      try {
        await createSession(session.sessionId, {
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
        });
        setSessionSynced(true);
      } catch {
        setIsLoading(false);
        setSubmitError("We couldn't reach the server. Check your connection and try again.");
        return;
      }
    }

    try {
      const response = await submitRecommendation(req);
      const sid = session.sessionId;
      clearSession();
      sessionStorage.setItem("zoco_results", JSON.stringify(response));
      router.push(`/results?s=${sid}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "internal_error";
      setSubmitError(friendlyError(raw));
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isLoaded || !question) {
    return (
      <main className="flex min-h-screen flex-col px-6 py-8" aria-hidden="true">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-4 h-0.5 w-full rounded-full bg-zinc-100" />
          <div className="mb-8 ml-auto h-4 w-16 rounded bg-zinc-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <ProgressIndicator
          current={stepIndex + 1}
          total={TOTAL}
          onBack={stepIndex > 0 ? goBack : undefined}
          isLoading={isLoading}
        />

        {sessionSynced === false && !syncWarningDismissed && (
          <div
            role="status"
            className="mb-4 flex items-start justify-between gap-2 rounded-md bg-amber-950/40 px-3 py-2 text-xs text-amber-400"
          >
            <span>Your answers are saved locally. We&apos;ll sync them when you submit.</span>
            <button
              onClick={() => setSyncWarningDismissed(true)}
              aria-label="Dismiss warning"
              className="shrink-0 text-amber-500 hover:text-amber-300"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1">
          <QuestionRenderer
            question={question}
            selected={currentAnswer}
            onSelect={(value) => {
              type F = typeof question.requestField;
              setAnswer(question.requestField, value as Required<IntakeAnswers>[F]);
            }}
            headingRef={headingRef}
          />
        </div>

        {submitError && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {submitError}
          </p>
        )}

        <NavControls
          isLast={isLast}
          isRequired={question.required}
          hasSelection={!!currentAnswer}
          onContinue={() => advance()}
          onSkip={!question.required ? () => advance(true) : undefined}
          isLoading={isLoading}
        />
      </div>

      {process.env.NODE_ENV === "development" && (
        <IntakeDebugPanel
          session={session}
          sessionSynced={sessionSynced}
          onFill={(answers, step) => fillAnswers(answers, step)}
          onGoToStep={goToStep}
          onClear={() => {
            clearSession();
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}
