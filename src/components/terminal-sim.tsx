import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  STAGES,
  advanceDiver,
  fmt1,
  fmtN,
  kEffective,
  readDiver,
  replayTo,
  sampleOf,
  stageOf,
  terminalSpeed,
  zeroDiver,
  RAMP_S,
  type DiverParams,
  type DiverState,
  type Sample,
  type StageId,
} from "@/lib/physics";

type View = {
  t: number;
  y: number;
  v: number;
  a: number;
  drag: number;
  net: number;
  weight: number;
  opened: boolean;
  phase: number;
  tOpen: number | null;
  stage: StageId;
};

const INITIAL: DiverParams = { mass: 80, g: 10, kBody: 0.25, kChute: 10 };

function makeView(s: DiverState, p: DiverParams): View {
  const reading = readDiver(s.v, kEffective(p, s), p);
  return {
    t: s.t,
    y: s.y,
    v: s.v,
    a: reading.a,
    drag: reading.drag,
    net: reading.net,
    weight: reading.weight,
    opened: s.opened,
    phase: s.phase,
    tOpen: s.tOpen,
    stage: stageOf(s, p),
  };
}

function vertical(n: number, zero: string): string {
  if (Math.abs(n) < 0.4) return zero;
  return n > 0 ? "downward" : "upward";
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function TerminalSim() {
  const [mass, setMass] = useState(INITIAL.mass);
  const [g, setG] = useState(INITIAL.g);
  const [kBody, setKBody] = useState(INITIAL.kBody);
  const [kChute, setKChute] = useState(INITIAL.kChute);
  const [speed, setSpeed] = useState(2);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<View>(() => makeView(zeroDiver(), INITIAL));
  const stateRef = useRef<DiverState>(zeroDiver());
  const pointsRef = useRef<Sample[]>([sampleOf(zeroDiver(), INITIAL)]);
  const [points, setPoints] = useState<Sample[]>(() => [...pointsRef.current]);
  const paramsRef = useRef<DiverParams>(INITIAL);
  const playingRef = useRef(true);
  const speedRef = useRef(2);

  paramsRef.current = { mass, g, kBody, kChute };
  playingRef.current = playing;
  speedRef.current = speed;

  function publish(replacePoints: boolean) {
    const s = stateRef.current;
    const p = paramsRef.current;
    setView(makeView(s, p));
    if (replacePoints) {
      const copy = pointsRef.current.slice();
      setPoints(copy);
    }
  }

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let bucket = 0;
    let sinceSample = 0;
    const tick = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!playingRef.current) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const simDt = real * speedRef.current;
      const p = paramsRef.current;
      const s = stateRef.current;
      let left = simDt;
      while (left > 1e-4) {
        const h = Math.min(0.02, left);
        advanceDiver(s, p, h, false);
        left -= h;
      }
      sinceSample += simDt;
      bucket += real;
      let pushed = false;
      if (sinceSample >= 0.12) {
        sinceSample = 0;
        pointsRef.current.push(sampleOf(s, p));
        if (pointsRef.current.length > 700) {
          pointsRef.current.splice(0, pointsRef.current.length - 550);
        }
        pushed = true;
      }
      if (bucket >= 0.05 || pushed) {
        bucket = 0;
        publish(pushed);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (playingRef.current) return;
    const s = stateRef.current;
    if (s.t < 0.001) {
      pointsRef.current = [sampleOf(s, paramsRef.current)];
      setPoints(pointsRef.current.slice());
    }
    setView(makeView(s, paramsRef.current));
  }, [mass, g, kBody, kChute]);

  function resetFall() {
    const s = zeroDiver();
    stateRef.current = s;
    pointsRef.current = [sampleOf(s, paramsRef.current)];
    setPoints(pointsRef.current.slice());
    setView(makeView(s, paramsRef.current));
    playingRef.current = true;
    setPlaying(true);
  }

  function jump(id: StageId) {
    const result = replayTo(paramsRef.current, id);
    stateRef.current = result.state;
    pointsRef.current = result.points.slice();
    playingRef.current = true;
    setPlaying(true);
    setPoints(pointsRef.current.slice());
    setView(makeView(result.state, paramsRef.current));
  }

  function togglePlay() {
    setPlaying((on) => {
      const next = !on;
      playingRef.current = next;
      if (!next) {
        pointsRef.current.push(sampleOf(stateRef.current, paramsRef.current));
        setPoints(pointsRef.current.slice());
        setView(makeView(stateRef.current, paramsRef.current));
      }
      return next;
    });
  }

  function openNow() {
    const s = stateRef.current;
    if (!s.opened) {
      s.opened = true;
      s.tOpen = s.t;
      s.phase = 0;
    }
    pointsRef.current.push(sampleOf(s, paramsRef.current));
    setPoints(pointsRef.current.slice());
    setView(makeView(s, paramsRef.current));
  }

  const stage = STAGES.find((item) => item.id === view.stage) ?? STAGES[0];
  const vt1 = terminalSpeed(mass, g, kBody);
  const vt2 = terminalSpeed(mass, g, kChute);
  const kNow = kEffective(paramsRef.current, {
    t: view.t,
    y: view.y,
    v: view.v,
    opened: view.opened,
    phase: view.phase,
    tOpen: view.tOpen,
  });

  return (
    <div data-layout="terminal" className="flex min-w-0 flex-col gap-4">
      <div className="terminal-top grid min-w-0 gap-4 lg:grid-cols-5">
        <Scene view={view} />
        <section className="terminal-stage flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:col-span-2">
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Stage</p>
            <h2 className="font-display text-2xl leading-tight text-fg">{stage.title}</h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="stage-speed font-display text-4xl leading-none tabular-nums text-fg">{fmt1(view.v)}</p>
                <p className="text-sm text-muted">m s⁻¹ downward</p>
              </div>
              <div className="text-right text-sm tabular-nums text-muted">
                <p>{fmt1(view.t)} s</p>
                <p>{fmtN(view.y)} m fallen</p>
              </div>
            </div>
            <p className="stage-body mt-3 text-sm leading-6 text-muted">{stage.body}</p>
          </div>
          <div className="stage-jumps flex w-full min-w-0 gap-2 overflow-x-auto">
            {STAGES.map((item) => {
              const on = item.id === view.stage;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jump(item.id)}
                  aria-pressed={on}
                  className={
                    on
                      ? "inline-flex min-h-11 shrink-0 items-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-fg"
                      : "inline-flex min-h-11 shrink-0 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-fg"
                  }
                >
                  {item.short}
                </button>
              );
            })}
          </div>
          <dl className="stage-stats grid grid-cols-2 gap-2 text-sm">
            <Stat k="Weight W" v={`${fmtN(view.weight)} N`} d="downward" />
            <Stat k="Air resistance R" v={`${fmtN(view.drag)} N`} d={view.drag < 0.5 ? "negligible" : "upward"} />
            <Stat k="Net force" v={`${fmtN(Math.abs(view.net))} N`} d={vertical(view.net, "zero — balanced")} />
            <Stat k="Acceleration" v={`${fmt1(view.a)} m s⁻²`} d={vertical(view.a, "zero")} />
          </dl>
          <div className="stage-actions grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-fg"
            >
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {playing ? "Pause" : "Play the fall"}
            </button>
            <button
              type="button"
              onClick={resetFall}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-fg"
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={openNow}
              disabled={view.opened && view.phase >= 0.99}
              className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-accent bg-accent px-3 text-sm font-semibold text-primary-fg disabled:opacity-50"
            >
              {view.opened ? (view.phase >= 0.99 ? "Parachute open" : "Parachute opening…") : "Open parachute now"}
            </button>
          </div>
          <div className="terminal-tools flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-fg">Playback</p>
            <div className="flex rounded-lg border border-line bg-canvas p-1">
              {[1, 2, 8].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={speed === rate}
                  onClick={() => setSpeed(rate)}
                  className={
                    speed === rate
                      ? "min-h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-fg"
                      : "min-h-11 flex-1 rounded-md text-sm font-semibold text-muted"
                  }
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>
          </div>
        </section>
      </div>

      <div className="terminal-charts grid min-w-0 gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Velocity–time"
          caption="Downward speed. Amber dashed: body terminal speed. Coral dashed: parachute terminal speed."
        >
          <SpeedChart points={points} view={view} vt1={vt1} vt2={vt2} tOpen={view.tOpen} />
        </ChartCard>
        <ChartCard
          className="lg:col-span-2"
          title="Acceleration–time"
          caption="Starts at g, falls to zero, then jumps upward when the parachute opens."
        >
          <AccelChart points={points} view={view} g={g} tOpen={view.tOpen} />
        </ChartCard>
      </div>
      <p className="terminal-note text-sm leading-6 text-muted">
        Downward is positive. A negative acceleration is upward — the fall is slowing, not reversing.
      </p>

      <section className="terminal-model rounded-xl border border-line bg-surface p-4">
        <div className="terminal-essay">
          <h2 className="font-display text-xl leading-tight text-fg">The model in the note</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Weight mg is constant. Air resistance is R = k v², opposite the velocity. Terminal speed is the
            steady speed where R = mg, so vₜ = √(mg / k). The parachute is a larger k, drawn opening over {RAMP_S} s so the slowing shows as a curve.
          </p>
          <p className="mt-2 text-sm leading-6 tabular-nums text-fg">
            Now k = {kNow.toFixed(2)}. Body terminal √({fmtN(mass * g)} / {kBody.toFixed(2)}) = {fmt1(vt1)} m
            s⁻¹. Parachute terminal √({fmtN(mass * g)} / {kChute.toFixed(2)}) = {fmt1(vt2)} m s⁻¹.
          </p>
        </div>
        <div className="terminal-sliders mt-4 grid gap-4 sm:grid-cols-2">
          <Range label="Mass" display={`${mass} kg`} min={50} max={110} step={1} value={mass} onChange={setMass} />
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
          <Range
            label="Body k"
            display={kBody.toFixed(2)}
            min={0.12}
            max={0.45}
            step={0.01}
            value={kBody}
            onChange={setKBody}
            hint={`Terminal speed ${fmt1(vt1)} m s⁻¹`}
          />
          <Range
            label="Parachute k"
            display={kChute.toFixed(1)}
            min={4}
            max={24}
            step={0.5}
            value={kChute}
            onChange={setKChute}
            hint={`New terminal speed ${fmt1(vt2)} m s⁻¹`}
          />
        </div>
      </section>
    </div>
  );
}

function Scene({ view }: { view: View }) {
  const grid = ((view.y * 6) % 29 + 29) % 29;
  return (
    <section className="terminal-scene relative h-80 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-2 sm:h-96 lg:col-span-3"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0 28px, var(--color-line) 28px 29px)",
        backgroundPositionY: `${-grid}px`,
      }}
      aria-label={`Diver falling at ${fmt1(view.v)} metres per second. Weight ${fmtN(view.weight)} newtons. Air resistance ${fmtN(view.drag)} newtons. Net force ${fmtN(view.net)} newtons.`}
    >
      {[24, 110, 190].map((seed) => {
        const top = ((seed - view.y * 6) % 380 + 380) % 380;
        return <span key={seed} className="absolute left-4 h-3 w-16 rounded-full bg-fg/10" style={{ top }} />;
      })}
      <div className="absolute top-3 left-4 rounded-lg bg-canvas/80 px-3 py-2">
        <p className="text-sm font-semibold text-fg">{view.opened ? "Parachute" : "Still falling"}</p>
        <p className="text-sm text-muted">{fmt1(view.t)} s</p>
      </div>
      <div className="flex h-full items-center justify-center px-3">
        <DiverFigure view={view} />
      </div>
    </section>
  );
}

function DiverFigure({ view }: { view: View }) {
  const chute = view.opened ? view.phase : 0;
  const hung = view.opened && view.phase > 0.12;
  const peak = Math.max(view.weight, view.drag, Math.abs(view.net), 1);
  const px = 74 / peak;
  const chestY = hung ? 164 : 128;
  return (
    <svg viewBox="0 0 250 250" className="diver-art h-64 w-auto sm:h-80" aria-hidden>
      <g transform="translate(-18 8)">
        <g opacity={Math.min(1, chute * 1.4)}>
          <path d="M16 108 Q85 36 154 108 Q85 126 16 108" fill="var(--color-accent)" />
          <path d="M38 108 L84 150 M85 104 L85 150 M132 108 L86 150" stroke="var(--color-fg)" strokeWidth="1.5" fill="none" />
        </g>
        {hung ? (
          <g fill="var(--color-primary)" stroke="var(--color-primary)" strokeLinecap="round">
            <circle cx="85" cy="132" r="13" />
            <ellipse cx="85" cy="134" rx="7" ry="3.5" fill="var(--color-canvas)" stroke="none" />
            <rect x="72" y="146" width="26" height="36" rx="8" stroke="none" />
            <path d="M74 156 L62 124 M96 156 L108 124" fill="none" strokeWidth="10" />
            <path d="M80 180 L76 214 M90 180 L94 214" fill="none" strokeWidth="10" />
          </g>
        ) : (
          <g fill="var(--color-primary)" stroke="var(--color-primary)" strokeLinecap="round">
            <circle cx="85" cy="92" r="14" />
            <ellipse cx="85" cy="94" rx="8" ry="4" fill="var(--color-canvas)" stroke="none" />
            <rect x="71" y="108" width="28" height="44" rx="8" stroke="none" />
            <path d="M72 120 L28 104 M98 120 L142 104" fill="none" strokeWidth="11" />
            <path d="M80 150 L48 196 M90 150 L122 196" fill="none" strokeWidth="11" />
          </g>
        )}
      </g>
      <BodyArrow x={168} y={chestY} len={view.weight * px} down color="var(--color-fg)" label="W" />
      <BodyArrow x={196} y={chestY} len={view.drag * px} down={false} color="var(--color-accent)" label="R" />
      <BodyArrow
        x={228}
        y={chestY}
        len={Math.abs(view.net) * px}
        down={view.net >= -0.4}
        color="var(--color-primary)"
        label="F"
      />
    </svg>
  );
}

function BodyArrow({
  x,
  y,
  len,
  down,
  color,
  label,
}: {
  x: number;
  y: number;
  len: number;
  down: boolean;
  color: string;
  label: string;
}) {
  if (len < 4) {
    return (
      <text x={x} y={y + 4} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">
        {label}
      </text>
    );
  }
  const y2 = down ? y + len : y - len;
  const head = down ? 1 : -1;
  const labelY = down ? Math.min(y2 + 14, 246) : Math.max(y2 - 6, 14);
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y2 - head * 8} stroke={color} strokeWidth="5" strokeLinecap="round" />
      <polyline
        points={`${x - 7},${y2 - head * 10} ${x},${y2} ${x + 7},${y2 - head * 10}`}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={x} y={labelY} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">
        {label}
      </text>
    </g>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-lg bg-canvas px-2 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold tabular-nums text-fg">{v}</dd>
      <dd className="text-muted">{d}</dd>
    </div>
  );
}

function ChartCard({
  title,
  caption,
  className,
  children,
}: {
  title: string;
  caption: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-4 ${className ?? ""}`}>
      <h2 className="font-display text-xl leading-tight text-fg">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>
      <div className="chart-well mt-2 h-56 w-full min-w-0">{children}</div>
    </section>
  );
}

function chartData(points: Sample[], view: View): Sample[] {
  const head: Sample = {
    t: view.t,
    v: view.v,
    a: view.a,
    drag: view.drag,
    net: view.net,
    weight: view.weight,
  };
  const last = points[points.length - 1];
  if (!last || Math.abs(last.t - head.t) > 0.02) return [...points, head];
  return points;
}

function SpeedChart({
  points,
  view,
  vt1,
  vt2,
  tOpen,
}: {
  points: Sample[];
  view: View;
  vt1: number;
  vt2: number;
  tOpen: number | null;
}) {
  const mounted = useMounted();
  const data = useMemo(() => chartData(points, view), [points, view]);
  const vMax = Math.max(vt1 * 1.15, ...data.map((p) => p.v), 1);
  if (!mounted) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} syncId="fall">
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, "auto"]}
          tick={{ fill: "var(--color-muted)", fontSize: 12 }}
          stroke="var(--color-line)"
          tickFormatter={(v: number) => fmt1(v)}
        />
        <YAxis
          domain={[0, vMax]}
          width={42}
          tick={{ fill: "var(--color-muted)", fontSize: 12 }}
          stroke="var(--color-line)"
          tickFormatter={(v: number) => fmtN(v)}
        />
        <Tooltip content={<ChartTip />} />
        <ReferenceLine y={vt1} stroke="var(--color-primary)" strokeDasharray="5 4" />
        <ReferenceLine y={vt2} stroke="var(--color-accent)" strokeDasharray="5 4" />
        {tOpen !== null ? <ReferenceLine x={tOpen} stroke="var(--color-accent)" strokeDasharray="2 4" /> : null}
        <Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AccelChart({
  points,
  view,
  g,
  tOpen,
}: {
  points: Sample[];
  view: View;
  g: number;
  tOpen: number | null;
}) {
  const mounted = useMounted();
  const data = useMemo(() => chartData(points, view), [points, view]);
  const aMin = Math.min(0, ...data.map((p) => p.a));
  const aMax = Math.max(g, ...data.map((p) => p.a));
  const pad = Math.max(1, (aMax - aMin) * 0.12);
  if (!mounted) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} syncId="fall">
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, "auto"]}
          tick={{ fill: "var(--color-muted)", fontSize: 12 }}
          stroke="var(--color-line)"
          tickFormatter={(v: number) => fmt1(v)}
        />
        <YAxis
          domain={[aMin - pad, aMax + pad]}
          width={42}
          tick={{ fill: "var(--color-muted)", fontSize: 12 }}
          stroke="var(--color-line)"
          tickFormatter={(v: number) => fmtN(v)}
        />
        <Tooltip content={<ChartTip />} />
        <ReferenceLine y={0} stroke="var(--color-muted)" />
        <ReferenceLine y={g} stroke="var(--color-fg)" strokeDasharray="5 4" />
        {tOpen !== null ? <ReferenceLine x={tOpen} stroke="var(--color-accent)" strokeDasharray="2 4" /> : null}
        <Line type="monotone" dataKey="a" stroke="var(--color-accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Sample }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg">
      <p className="tabular-nums text-muted">{fmt1(p.t)} s</p>
      <p className="tabular-nums">v = {fmt1(p.v)} m s⁻¹</p>
      <p className="tabular-nums">a = {fmt1(p.a)} m s⁻²</p>
    </div>
  );
}

function Range({
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
      {hint ? <span className="hint text-sm leading-6 text-muted">{hint}</span> : null}
    </label>
  );
}
