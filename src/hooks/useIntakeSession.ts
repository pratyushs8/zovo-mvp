"use client";

import { useState, useEffect, useTransition } from "react";
import type { RecommendationRequest } from "@/types/api";
export { buildRequest } from "@/lib/buildRequest";

// Bump this whenever IntakeSession shape changes so stale localStorage is
// discarded rather than silently misread.
const SCHEMA_VERSION = 1;

export type IntakeAnswers = Partial<Omit<RecommendationRequest, "sessionId">>;

export interface IntakeSession {
  version: number;
  sessionId: string;
  answers: IntakeAnswers;
  currentStep: number;
}

const STORAGE_KEY = "zoco_intake_session";

function createSession(): IntakeSession {
  return {
    version: SCHEMA_VERSION,
    sessionId: crypto.randomUUID(),
    answers: {},
    currentStep: 0,
  };
}

function isValidSession(raw: unknown): raw is IntakeSession {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as IntakeSession).version === SCHEMA_VERSION &&
    typeof (raw as IntakeSession).sessionId === "string" &&
    typeof (raw as IntakeSession).answers === "object" &&
    typeof (raw as IntakeSession).currentStep === "number"
  );
}

function loadSession(): IntakeSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidSession(parsed)) return parsed;
      // stale schema — discard and start fresh
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // corrupted storage — start fresh
  }
  return createSession();
}

function writeStorage(session: IntakeSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage full — continue in-memory only
  }
}

export function useIntakeSession() {
  const [session, setSession] = useState<IntakeSession>(createSession);
  // isLoaded prevents the page from rendering with the ephemeral initial state
  // (new UUID) before localStorage has been read on the client.
  const [isLoaded, setIsLoaded] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      setSession(loadSession());
      setIsLoaded(true);
    });
  }, []);

  // Generic overload: each field only accepts its correct union type.
  // The cast in intake/page.tsx is the one place where string→union narrowing
  // happens; Zod validation in buildRequest() is the runtime safety net.
  function setAnswer<K extends keyof IntakeAnswers>(field: K, value: Required<IntakeAnswers>[K]) {
    setSession((prev) => {
      const next = { ...prev, answers: { ...prev.answers, [field]: value } };
      writeStorage(next);
      return next;
    });
  }

  function goToStep(step: number) {
    setSession((prev) => {
      const next = { ...prev, currentStep: step };
      writeStorage(next);
      return next;
    });
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = createSession();
    setSession(fresh);
  }

  // Dev-only helper — replaces the full answer set and jumps to a step.
  // Used by IntakeDebugPanel; not part of the production flow.
  function fillAnswers(answers: IntakeAnswers, step: number) {
    setSession((prev) => {
      const next = { ...prev, answers, currentStep: step };
      writeStorage(next);
      return next;
    });
  }

  return { session, isLoaded, setAnswer, goToStep, clearSession, fillAnswers };
}
