import type { RefObject } from "react";
import type { IntakeQuestion } from "@/config/questions";
import { OptionGroup } from "./OptionGroup";

interface Props {
  question: IntakeQuestion;
  selected: string | undefined;
  onSelect: (value: string) => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function QuestionRenderer({ question, selected, onSelect, headingRef }: Props) {
  const opts = question.options.map((o) => ({ value: o.value, label: o.label }));
  const layout = opts.length >= 4 ? "grid" : "stack";

  return (
    <div>
      <div className="mb-5">
        {!question.required && (
          <span className="inline-block mb-2 text-xs text-zinc-400">
            Optional
          </span>
        )}
        {/* tabIndex={-1} lets programmatic focus() work without adding to tab order */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-white focus-visible:outline-none"
        >
          {question.label}
        </h2>
      </div>
      <OptionGroup
        groupLabel={question.label}
        options={opts}
        selected={selected}
        onSelect={onSelect}
        layout={layout}
      />
    </div>
  );
}
