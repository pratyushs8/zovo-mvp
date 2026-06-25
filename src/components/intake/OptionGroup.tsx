"use client";

import { useRef, KeyboardEvent } from "react";

export interface OptionItem {
  value: string;
  label: string;
}

interface Props {
  groupLabel: string; // matches the question label — used for aria-label
  options: OptionItem[];
  selected: string | undefined;
  onSelect: (value: string) => void;
  layout: "grid" | "stack";
}

export function OptionGroup({ groupLabel, options, selected, onSelect, layout }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      next = (index + 1) % options.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      next = (index - 1 + options.length) % options.length;
    } else {
      return;
    }

    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className={layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}
    >
      {options.map((opt, i) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            // tabIndex follows roving-tabindex pattern: only the selected (or first) item
            // is in the tab sequence; others are reachable via arrow keys
            tabIndex={isSelected || (!selected && i === 0) ? 0 : -1}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#E84B2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] focus-visible:outline-none ${
              isSelected
                ? "border-[#E84B2B] bg-[#E84B2B]/10 text-[#E84B2B]"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
