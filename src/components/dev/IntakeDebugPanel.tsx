"use client";

import { useState } from "react";
import { QUESTIONS } from "@/config/questions";
import { buildRequest, type IntakeSession, type IntakeAnswers } from "@/hooks/useIntakeSession";

// ── Preset fixtures ────────────────────────────────────────────────────────────
// Each preset covers a realistic user persona for manual testing.

const PRESETS: Array<{ label: string; answers: IntakeAnswers; step: number }> = [
  {
    label: "Solo social (full)",
    step: 4,
    answers: {
      personaKey: "solo_social",
      priority: "social_vibe",
      socialEnergy: "very_social",
      roomType: "dorm",
      budget: "moderate",
    },
  },
  {
    label: "Couple retreat",
    step: 4,
    answers: {
      personaKey: "couple_retreat",
      priority: "scenic_views",
      socialEnergy: "mostly_private",
      roomType: "private",
      budget: "flexible",
    },
  },
  {
    label: "Budget backpacker (no budget)",
    step: 3,
    answers: {
      personaKey: "budget_backpacker",
      priority: "best_value",
      socialEnergy: "very_social",
      roomType: "dorm",
    },
  },
  {
    label: "Workation (required only)",
    step: 3,
    answers: {
      personaKey: "workation",
      priority: "work_setup",
      socialEnergy: "mostly_private",
      roomType: "private",
    },
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  session: IntakeSession;
  sessionSynced: boolean | null;
  onFill: (answers: IntakeAnswers, step: number) => void;
  onGoToStep: (step: number) => void;
  onClear: () => void;
}

export function IntakeDebugPanel({ session, sessionSynced, onFill, onGoToStep, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const req = buildRequest(session);
  const syncLabel =
    sessionSynced === true ? "✓ synced" : sessionSynced === false ? "✗ failed" : "… pending";
  const syncColor =
    sessionSynced === true
      ? "text-emerald-400"
      : sessionSynced === false
        ? "text-red-400"
        : "text-yellow-400";

  const storageRaw =
    typeof window !== "undefined" ? localStorage.getItem("zoco_intake_session") : null;

  return (
    <div
      className="fixed right-0 bottom-0 left-0 z-50 font-mono text-xs"
      aria-label="Developer debug panel"
    >
      {open ? (
        <div className="border-t border-zinc-700 bg-zinc-900 text-zinc-300 shadow-2xl">
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
            <span className="font-semibold text-zinc-100">DEV — Intake Debug</span>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-100"
              aria-label="Collapse debug panel"
            >
              ▼ collapse
            </button>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-700">
            {/* Left column — state */}
            <div className="space-y-3 p-4">
              <div>
                <p className="mb-1 text-zinc-500">Session</p>
                <p className="break-all text-zinc-200">{session.sessionId}</p>
                <p className={`mt-0.5 ${syncColor}`}>sync: {syncLabel}</p>
              </div>

              <div>
                <p className="mb-1 text-zinc-500">
                  Step {session.currentStep + 1} / {QUESTIONS.length} —{" "}
                  {QUESTIONS[session.currentStep]?.requestField ?? "done"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUESTIONS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => onGoToStep(i)}
                      className={`rounded px-2 py-0.5 ${
                        i === session.currentStep
                          ? "bg-zinc-100 text-zinc-900"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2 text-zinc-500">
                  <span>Answers</span>
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-zinc-600 hover:text-zinc-400"
                  >
                    {showRaw ? "[parsed]" : "[raw]"}
                  </button>
                </div>
                <pre className="max-h-28 overflow-y-auto rounded bg-zinc-800 p-2 text-zinc-200">
                  {showRaw ? (storageRaw ?? "(empty)") : JSON.stringify(session.answers, null, 2)}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-zinc-500">buildRequest()</p>
                {req ? (
                  <span className="text-emerald-400">✓ valid</span>
                ) : (
                  <span className="text-red-400">✗ null — required fields missing</span>
                )}
              </div>
            </div>

            {/* Right column — presets + actions */}
            <div className="space-y-3 p-4">
              <div>
                <p className="mb-2 text-zinc-500">Presets</p>
                <div className="flex flex-col gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => onFill(preset.answers, preset.step)}
                      className="rounded bg-zinc-700 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-600"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClear}
                  className="rounded bg-red-900 px-3 py-1.5 text-red-200 hover:bg-red-800"
                >
                  Clear session + reload
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-end px-3 py-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-zinc-800 px-3 py-1 text-zinc-400 shadow-md hover:bg-zinc-700 hover:text-zinc-200"
            aria-label="Open developer debug panel"
          >
            DEV
          </button>
        </div>
      )}
    </div>
  );
}
