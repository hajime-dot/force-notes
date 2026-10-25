import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      {title ? <h3 className="mb-3 font-display text-xl leading-tight text-fg">{title}</h3> : null}
      {children}
    </section>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-fg">{label}</span>
        <span className="tabular-nums text-primary">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <span className="text-sm leading-6 text-muted">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-fg">{label}</p>
      <div className="flex rounded-lg border border-line bg-canvas p-1">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.value)}
              className={
                on
                  ? "min-h-11 flex-1 rounded-md bg-primary px-2 text-sm font-semibold text-primary-fg"
                  : "min-h-11 flex-1 rounded-md px-2 text-sm font-semibold text-muted"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
