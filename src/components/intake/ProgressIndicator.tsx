interface Props {
  current: number; // 1-based
  total: number;
  onBack?: () => void; // if undefined, back button is hidden (step 1)
  isLoading?: boolean;
}

export function ProgressIndicator({ current, total, onBack, isLoading }: Props) {
  const pct = Math.round(((current - 1) / total) * 100);

  return (
    <header className="mb-8">
      {/* Full-width progress bar */}
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current} of ${total}`}
        className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-[#E84B2B] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step counter + back link on the same row */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            disabled={isLoading}
            aria-label="Go back to previous question"
            className="rounded text-sm text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:outline-none disabled:opacity-40"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-zinc-600" aria-hidden="true">
          {current} / {total}
        </span>
      </div>
    </header>
  );
}
