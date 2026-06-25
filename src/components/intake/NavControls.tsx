interface Props {
  isLast: boolean;
  isRequired: boolean;
  hasSelection: boolean;
  onContinue: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export function NavControls({
  isLast,
  isRequired,
  hasSelection,
  onContinue,
  onSkip,
  isLoading,
}: Props) {
  const label = isLoading ? "Finding stays…" : isLast ? "Find my stay →" : "Continue →";
  const blocked = !hasSelection && !isLoading;

  return (
    <div className="mt-8 flex flex-col">
      <button
        onClick={onContinue}
        disabled={!hasSelection || isLoading}
        aria-describedby={blocked ? "nav-hint" : undefined}
        className={`w-full rounded-lg px-6 py-3.5 text-sm font-medium text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84B2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] ${
          hasSelection && !isLoading
            ? "bg-[#E84B2B] hover:bg-[#c73b1f]"
            : "bg-zinc-800 cursor-not-allowed text-zinc-500"
        }`}
      >
        {label}
      </button>

      {/* Guidance shown only when a required question is unanswered */}
      {blocked && isRequired && (
        <p id="nav-hint" className="mt-2 text-center text-xs text-zinc-600">
          Pick one of the options above to continue
        </p>
      )}

      {!isRequired && onSkip && (
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="mt-6 w-full py-2 text-sm text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 rounded disabled:opacity-40"
        >
          Skip — I&apos;ll leave this one open
        </button>
      )}
    </div>
  );
}
