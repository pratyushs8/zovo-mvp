import { LogoSpinner } from "@/components/ui/LogoSpinner";

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
  const label = isLast ? "Find my stay →" : "Continue →";
  const blocked = !hasSelection && !isLoading;

  return (
    <div className="mt-8 flex flex-col">
      <button
        onClick={onContinue}
        disabled={!hasSelection || isLoading}
        aria-describedby={blocked ? "nav-hint" : undefined}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-medium text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#E84B2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] focus-visible:outline-none ${
          hasSelection && !isLoading
            ? "bg-[#E84B2B] hover:bg-[#c73b1f]"
            : "cursor-not-allowed bg-zinc-800 text-zinc-500"
        }`}
      >
        {isLoading ? (
          <>
            <LogoSpinner size={18} color="white" />
            <span>Finding stays…</span>
          </>
        ) : (
          label
        )}
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
          className="mt-6 w-full rounded py-2 text-sm text-zinc-600 transition-colors hover:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:outline-none disabled:opacity-40"
        >
          Skip — I&apos;ll leave this one open
        </button>
      )}
    </div>
  );
}
