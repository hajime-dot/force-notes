import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  describeFriction,
  fmt1,
  fmtN,
  stepFriction,
  type FrictionMode,
  type FrictionParams,
} from "@/lib/physics";

type Snap = {
  x: number;
  v: number;
  F: number;
  friction: number;
  a: number;
  mode: FrictionMode;
  fsMax: number;
  fk: number;
  normal: number;
};

function way(n: number): string {
  if (Math.abs(n) < 0.05) return "none";
  return n > 0 ? "to the right" : "to the left";
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function FrictionSim() {
  const [mass, setMass] = useState(4);
  const [muS, setMuS] = useState(0.5);
  const [muK, setMuK] = useState(0.3);
  const [g, setG] = useState(10);
  const [F, setF] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [snap, setSnap] = useState<Snap>(() => {
    const p = { mass: 4, g: 10, muS: 0.5, muK: 0.3 };
    return { ...describeFriction(0, 0, p), x: 0, v: 0, F: 0 };
  });

  const phys = useRef({ x: 0, v: 0 });
  const FRef = useRef(0);
  const sweepRef = useRef(false);
  const paramsRef = useRef<FrictionParams>({ mass: 4, g: 10, muS: 0.5, muK: 0.3 });
  paramsRef.current = { mass, g, muS, muK: Math.min(muK, muS) };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const p = paramsRef.current;
      const fs = p.muS * p.mass * p.g;
      if (sweepRef.current) {
        const target = fs * 2.15;
        const next = Math.min(target, FRef.current + Math.max(fs, 4) * 0.42 * dt);
        FRef.current = next;
        setF(next);
        if (next >= target - 0.05) {
          sweepRef.current = false;
          setSweeping(false);
        }
      }
      const stepped = stepFriction(phys.current.v, phys.current.x, FRef.current, p, dt);
      phys.current = { x: stepped.x, v: stepped.v };
      setSnap({ ...stepped, F: FRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function applyForce(next: number) {
    sweepRef.current = false;
    setSweeping(false);
    const p = paramsRef.current;
    const limit = Math.max(50, p.muS * p.mass * p.g * 2.5);
    const clamped = Math.max(-limit, Math.min(limit, next));
    FRef.current = clamped;
    setF(clamped);
    const d = describeFriction(phys.current.v, clamped, p);
    setSnap({ ...d, x: phys.current.x, v: phys.current.v, F: clamped });
  }

  function runExperiment() {
    phys.current = { x: 0, v: 0 };
    FRef.current = 0;
    setF(0);
    sweepRef.current = true;
    setSweeping(true);
    const d = describeFriction(0, 0, paramsRef.current);
    setSnap({ ...d, x: 0, v: 0, F: 0 });
  }

  function resetBlock() {
    sweepRef.current = false;
    setSweeping(false);
    phys.current = { x: 0, v: 0 };
    FRef.current = 0;
    setF(0);
    const d = describeFriction(0, 0, paramsRef.current);
    setSnap({ ...d, x: 0, v: 0, F: 0 });
  }

  const fsMax = snap.fsMax;
  const limit = Math.max(50, fsMax * 2.5);
  const story = storyFor(snap);
  const muKShown = Math.min(muK, muS);

  return (
    <div data-layout="friction" className="flex flex-col gap-4">
      <PanelBench snap={snap} mass={mass} />
      <section className="friction-controls rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl leading-tight text-fg">{story.title}</h2>
        <p className="friction-story mt-2 text-sm leading-6 text-muted">{story.body}</p>
        <div className="friction-readouts mt-4 grid grid-cols-2 gap-3">
          <Readout
            label="Applied force"
            value={`${fmtN(Math.abs(snap.F))} N`}
            detail={way(snap.F)}
            tone="text-primary"
          />
          <Readout
            label={snap.mode === "static" ? "Static friction" : "Kinetic friction"}
            value={`${fmtN(Math.abs(snap.friction))} N`}
            detail={way(snap.friction)}
            tone="text-accent"
          />
        </div>
        <p className="friction-equal mt-3 text-sm leading-6 text-fg">
          {snap.mode === "static"
            ? snap.F === 0
              ? "Both are zero."
              : "They are equal and opposite, so the block stays still."
            : "They are not equal. Kinetic friction stays at μₖN while the block is moving."}
        </p>
        <dl className="friction-minis mt-3 grid grid-cols-3 gap-2 text-sm">
          <Mini k="Net force" v={`${fmtN(snap.F + snap.friction)} N`} d={way(snap.F + snap.friction)} />
          <Mini k="Acceleration" v={`${fmt1(snap.a)} m s⁻²`} d={way(snap.a)} />
          <Mini k="Velocity" v={`${fmt1(snap.v)} m s⁻¹`} d={way(snap.v)} />
        </dl>

        <div className="friction-force mt-4">
          <SliderFieldInline
            label="Applied force, either direction"
            display={`${fmtN(F)} N ${F > 0.05 ? "right" : F < -0.05 ? "left" : ""}`}
            min={-limit}
            max={limit}
            step={0.1}
            value={Math.max(-limit, Math.min(limit, F))}
            onChange={applyForce}
          />
          <div className="flex justify-between text-xs font-semibold tracking-wide text-muted uppercase">
            <span>Left</span>
            <span>Right</span>
          </div>
        </div>

        <div className="friction-actions mt-3 grid grid-cols-2 gap-2">
          <Ghost onClick={() => applyForce(-1.8 * fsMax)}>Hard push left</Ghost>
          <Ghost onClick={() => applyForce(1.8 * fsMax)}>Hard push right</Ghost>
          <Ghost onClick={() => applyForce(-0.55 * fsMax)}>Gentle left</Ghost>
          <Ghost onClick={() => applyForce(0.55 * fsMax)}>Gentle right</Ghost>
          <Ghost onClick={() => applyForce(0)}>Release</Ghost>
          <button
            type="button"
            onClick={runExperiment}
            aria-pressed={sweeping}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-fg"
          >
            {sweeping ? "Increasing the push…" : "Run the experiment"}
          </button>
          <button
            type="button"
            onClick={resetBlock}
            className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-fg"
          >
            Stop and reset
          </button>
        </div>
      </section>

      <section className="friction-chart-card rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl leading-tight text-fg">Friction against applied force</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Magnitudes, as in the note. The slanted part is static friction, equal to the push. After the
          block slips, friction drops to μₖN and the line is flat.
        </p>
        <FrictionChart fsMax={fsMax} fk={snap.fk} applied={snap.F} friction={snap.friction} />
        <p className="friction-dot mt-2 text-sm leading-6 text-fg">{dotSentence(snap)}</p>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
          <li className="flex items-center gap-2">
            <span className="inline-block h-1 w-6 bg-primary" />
            Static: f = F, up to μₛN = {fmtN(fsMax)} N
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-1 w-6 bg-accent" />
            Kinetic: f = μₖN = {fmtN(snap.fk)} N, constant
          </li>
        </ul>
      </section>

      <section className="friction-coeffs rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl leading-tight text-fg">Surface and coefficients</h2>
        <div className="coeff-grid mt-3 grid gap-4 sm:grid-cols-2">
          <SliderFieldInline
            label="Mass"
            display={`${mass} kg`}
            min={1}
            max={12}
            step={1}
            value={mass}
            onChange={setMass}
            hint={`Normal reaction N = mg = ${fmtN(mass * g)} N`}
          />
          <div>
            <p className="mb-1 text-sm font-semibold text-fg">g</p>
            <div className="flex rounded-lg border border-line bg-canvas p-1">
              {[
                { value: 10, label: "10 m s⁻²" },
                { value: 9.81, label: "9.81 m s⁻²" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={g === option.value}
                  onClick={() => setG(option.value)}
                  className={
                    g === option.value
                      ? "min-h-11 flex-1 rounded-md bg-primary px-2 text-sm font-semibold text-primary-fg"
                      : "min-h-11 flex-1 rounded-md px-2 text-sm font-semibold text-muted"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <SliderFieldInline
            label="Coefficient of static friction μₛ"
            display={muS.toFixed(2)}
            min={0.1}
            max={1}
            step={0.01}
            value={muS}
            onChange={(value) => {
              setMuS(value);
              setMuK((current) => Math.min(current, value));
            }}
            hint={`Maximum static friction μₛN = ${fmtN(muS * mass * g)} N`}
          />
          <SliderFieldInline
            label="Coefficient of kinetic friction μₖ"
            display={muKShown.toFixed(2)}
            min={0.05}
            max={muS}
            step={0.01}
            value={muKShown}
            onChange={setMuK}
            hint={`Kinetic friction μₖN = ${fmtN(muKShown * mass * g)} N, and it does not depend on the push`}
          />
        </div>
      </section>
    </div>
  );
}

function storyFor(s: Snap): { title: string; body: string } {
  const absF = Math.abs(s.F);
  if (s.mode === "static") {
    if (absF < 0.05) {
      return {
        title: "No push, no friction",
        body: "Nothing is trying to slide the block, so static friction is zero. It will rise to equal whatever push you apply, until the maximum.",
      };
    }
    if (Math.abs(absF - s.fsMax) <= Math.max(0.3, s.fsMax * 0.04)) {
      return {
        title: "Static friction is at its maximum",
        body: "Friction still equals the applied force, and it has reached μₛN. A slightly harder push and the block will slip.",
      };
    }
    return {
      title: "Static friction equals the applied force",
      body: "The block is at rest. Static friction matches the push and acts the opposite way, so the net force is zero.",
    };
  }
  const opposing =
    Math.abs(s.v) > 0.05 && s.F !== 0 && Math.sign(s.F) !== Math.sign(s.v);
  if (Math.abs(s.F) < s.fk - 0.3 || opposing || Math.abs(s.F) < 0.05) {
    return {
      title: "Kinetic friction stays constant while it slows",
      body: "The block is still sliding, so friction is still the kinetic value μₖN. It does not shrink to match a smaller push. It keeps opposing the velocity until the block stops — then static friction can match the push again.",
    };
  }
  return {
    title: "Kinetic friction is constant",
    body: "The block has slipped. Friction dropped from μₛN to μₖN, and it stays at that value however hard you push. A harder push increases the acceleration, not the friction.",
  };
}

function dotSentence(s: Snap): string {
  const absF = Math.abs(s.F);
  if (s.mode === "static") {
    return "The dot is on the slanted line: friction equals the applied force.";
  }
  if (absF + 0.2 < s.fsMax) {
    return "The dot is off the slanted line because the block is already moving. Kinetic friction is still μₖN, not equal to the smaller push.";
  }
  return "The dot is on the flat line: kinetic friction is constant, past the slip point.";
}

function PanelBench({ snap, mass }: { snap: Snap; mass: number }) {
  const shift = ((snap.x * 56) % 56 + 56) % 56;
  const moving = Math.abs(snap.v) > 0.08;
  const scale = Math.max(Math.abs(snap.F), Math.abs(snap.friction), snap.fsMax, 1);
  const sameSide =
    Math.abs(snap.F) > 0.05 &&
    Math.abs(snap.friction) > 0.05 &&
    Math.sign(snap.F) === Math.sign(snap.friction);

  return (
    <section className="friction-bench overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-sm font-semibold text-fg">{moving ? "Sliding" : "At rest"}</p>
        <p className="text-sm tabular-nums text-muted">
          v = {fmt1(snap.v)} m s⁻¹ {snap.v > 0.08 ? "right" : snap.v < -0.08 ? "left" : ""}
        </p>
      </div>
      <div
        className="stage-well relative mt-2 h-72 sm:h-80"
        role="img"
        aria-label={`${moving ? "Sliding block" : "Block at rest"}. Applied force ${fmtN(snap.F)} newtons ${way(snap.F)}. Friction ${fmtN(snap.friction)} newtons ${way(snap.friction)}.`}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-16 bg-canvas"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--color-line) 0 2px, transparent 2px 56px)",
            backgroundPositionX: `${-shift}px`,
          }}
        />
        <p className="absolute bottom-3 left-4 text-xs font-semibold tracking-widest text-muted uppercase">
          Rough horizontal surface
        </p>
        <ForceArrow
          value={snap.F}
          scale={scale}
          label={`${fmtN(Math.abs(snap.F))} N`}
          tone="text-primary"
          lift={sameSide ? "top-8" : "top-16"}
        />
        <ForceArrow
          value={snap.friction}
          scale={scale}
          label={`${fmtN(Math.abs(snap.friction))} N`}
          tone="text-accent"
          lift={sameSide ? "top-24" : "top-16"}
        />
        {moving ? (
        <div
          className="absolute bottom-20 flex flex-col gap-1"
          style={{
            opacity: Math.min(0.7, Math.abs(snap.v) / 6),
            ...(Math.sign(snap.v) > 0
              ? { right: "calc(50% + 4.5rem)" }
              : { left: "calc(50% + 4.5rem)" }),
          }}
        >
          <span className="h-0.5 w-10 bg-fg" />
          <span className="h-0.5 w-6 bg-fg" />
          <span className="h-0.5 w-8 bg-fg" />
        </div>
      ) : null}
        <div className="absolute bottom-16 left-1/2 flex h-16 w-28 -translate-x-1/2 items-center justify-center rounded-lg bg-primary font-semibold text-primary-fg">
          <span className="text-center leading-tight">
            {mass} kg
            <span className="mt-0.5 block text-xs font-semibold tracking-wide uppercase">
              {moving ? (snap.v > 0 ? "moving right" : "moving left") : "not moving"}
            </span>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-primary">
          <span className="inline-block h-1 w-6 bg-primary" />
          Applied force
        </span>
        <span className="flex items-center gap-2 text-accent">
          <span className="inline-block h-1 w-6 bg-accent" />
          Friction
        </span>
      </div>
    </section>
  );
}

function ForceArrow({
  value,
  scale,
  label,
  tone,
  lift,
}: {
  value: number;
  scale: number;
  label: string;
  tone: string;
  lift: string;
}) {
  if (Math.abs(value) < 0.05) return null;
  const right = value > 0;
  const width = `${(Math.abs(value) / scale) * 30}%`;
  return (
    <div className={`absolute ${lift} ${tone} flex items-center`} style={right ? { left: "calc(50% + 3.5rem)", width } : { right: "calc(50% + 3.5rem)", width }}>
      {right ? (
        <>
          <span className="h-1 min-w-2 flex-1 bg-current" />
          <span className="h-0 w-0 border-y-8 border-l-8 border-y-transparent border-l-current" />
          <span className="absolute -top-5 left-0 text-sm font-semibold whitespace-nowrap tabular-nums">{label}</span>
        </>
      ) : (
        <>
          <span className="h-0 w-0 border-y-8 border-r-8 border-y-transparent border-r-current" />
          <span className="h-1 min-w-2 flex-1 bg-current" />
          <span className="absolute -top-5 right-0 text-sm font-semibold whitespace-nowrap tabular-nums">{label}</span>
        </>
      )}
    </div>
  );
}

const FrictionChart = memo(function FrictionChart({
  fsMax,
  fk,
  applied,
  friction,
}: {
  fsMax: number;
  fk: number;
  applied: number;
  friction: number;
}) {
  const mounted = useMounted();
  const plotF = Math.abs(applied);
  const plotf = Math.abs(friction);
  const axisMax = Math.max(fsMax * 1.75, plotF * 1.08, fsMax + 6);
  const yMax = Math.max(fsMax, fk, plotf) * 1.2;
  const data = useMemo(() => {
    const rows: { F: number; staticF: number | null; kineticF: number | null }[] = [];
    const n = 48;
    for (let i = 0; i <= n; i += 1) {
      const x = (axisMax * i) / n;
      rows.push({
        F: x,
        staticF: x <= fsMax + 1e-6 ? x : null,
        kineticF: x >= fsMax - 1e-6 ? fk : null,
      });
    }
    return rows;
  }, [axisMax, fsMax, fk]);

  return (
    <div className="fill-chart mt-3 h-64 w-full min-w-0">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="F"
              type="number"
              domain={[0, axisMax]}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              stroke="var(--color-line)"
              tickFormatter={(v: number) => fmtN(v)}
            />
            <YAxis
              type="number"
              domain={[0, yMax]}
              width={40}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              stroke="var(--color-line)"
              tickFormatter={(v: number) => fmtN(v)}
            />
            <Line
              type="linear"
              dataKey="staticF"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="kineticF"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={Math.min(plotF, axisMax)}
              y={Math.min(plotf, yMax)}
              r={6}
              fill="var(--color-primary)"
              stroke="var(--color-canvas)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
});

function Readout({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="readout rounded-lg bg-canvas px-3 py-2">
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display text-3xl leading-tight tabular-nums ${tone}`}>{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}

function Mini({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-lg bg-canvas px-2 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold tabular-nums text-fg">{v}</dd>
      <dd className="text-muted">{d}</dd>
    </div>
  );
}

function Ghost({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface-2 px-2 text-sm font-semibold text-fg"
    >
      {children}
    </button>
  );
}

function SliderFieldInline({
  label,
  display,
  min,
  max,
  step,
  value,
  hint,
  onChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
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
