interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  selected: string | undefined;
  onSelect: (value: string) => void;
}

export function ChipGrid({ options, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={`rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors ${
            selected === opt.value
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
