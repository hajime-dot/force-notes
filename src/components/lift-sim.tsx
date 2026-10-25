import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { fmtN } from "@/lib/physics";
import {
  MOTIONS,
  durationOf,
  familyOf,
  fmtG,
  fmtTrim,
  motionsJourney,
  readingOf,
  segmentAt,
  seriesOf,
  storyLine,
  yMaxOf,
  type Family,
  type MotionId,
  type VSign,
} from "@/lib/lift";

type Apparatus = "balance" | "spring";

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function relationText(a: number, g: number, symbol: string): string {
  const family = familyOf(a, g);
  if (family === "up") return `${symbol} > mg`;
  if (family === "zero") return `${symbol} = mg`;
  if (family === "down") return `${symbol} < mg`;
  return `${symbol} = 0`;
}

function accelPhrase(a: number, g: number): string {
  const family = familyOf(a, g);
  if (family === "zero") return "zero";
  if (family === "free") return `g down (${fmtG(g)} m s⁻²)`;
  return `${fmtTrim(Math.abs(a))} m s⁻² ${a > 0 ? "up" : "down"}`;
}

export function LiftSim() {
  const [apparatus, setApparatus] = useState<Apparatus>("balance");
  const [mass, setMass] = useState(60);
  const [g, setG] = useState(10);
  const [aMag, setAMag] = useState(2);
  const [uniformWay, setUniformWay] = useState<1 | -1>(1);
  const [motionId, setMotionId] = useState<MotionId>("uniform");

  const symbol = apparatus === "balance" ? "R" : "T";
  const journey = useMemo(
    () => motionsJourney(mass, g, aMag, uniformWay),
    [mass, g, aMag, uniformWay],
  );
  const duration = durationOf(journey);
  const segment = journey.segments.find((item) => item.motion === motionId) ?? journey.segments[0];
  const markerT = (segment.t0 + segment.t1) / 2;

  const weight = journey.mass * journey.g;
  const reading = readingOf(journey.mass, journey.g, segment.a);
  const net = journey.mass * segment.a;

  function showMotion(id: MotionId) {
    setMotionId(id);
  }

  const series = useMemo(() => seriesOf(journey), [journey]);
  const yMax = yMaxOf(journey);
  const netLine =
    Math.abs(net) < 0.05
      ? "Fnet = 0"
      : `Fnet = ma = ${fmtN(Math.abs(net))} N ${segment.a > 0 ? "upward" : "downward"}`;

  return (
    <div data-layout="lift" className="flex flex-col gap-4">
      <section className="lift-scene rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl leading-tight text-fg">
            {apparatus === "balance" ? "Person on a balance" : "Mass on a spring balance"}
          </h2>
          <p className="text-sm tabular-nums text-muted">
            {symbol} = {fmtN(reading)} N
          </p>
        </div>
        {segment.motion === "uniform" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Choice pressed={uniformWay === 1} onClick={() => setUniformWay(1)}>
              Moving up
            </Choice>
            <Choice pressed={uniformWay === -1} onClick={() => setUniformWay(-1)}>
              Moving down
            </Choice>
          </div>
        ) : null}
        <LiftScene
          apparatus={apparatus}
          reading={reading}
          weight={weight}
          a={segment.a}
          v={segment.v}
          g={journey.g}
          symbol={symbol}
        />
        <p className="text-sm leading-6 text-muted">
          {apparatus === "balance"
            ? "The balance reads the normal reaction R. You feel R, not mg."
            : "The spring balance reads the tension T. For a hanging mass, T plays the role of R."}{" "}
          The up arrow is the reading. The down arrow is the true weight. Both change only when the acceleration changes.
        </p>
      </section>

      <section className="lift-side flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="lift-apparatus grid grid-cols-2 gap-2">
          <Choice pressed={apparatus === "balance"} onClick={() => setApparatus("balance")}>
            Balance
          </Choice>
          <Choice pressed={apparatus === "spring"} onClick={() => setApparatus("spring")}>
            Spring balance
          </Choice>
        </div>
        <div className="lift-families">
          <h2 className="font-display text-xl leading-tight text-fg">Six cases</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MOTIONS.map((item) => {
              const step = journey.segments.find((part) => part.motion === item.id);
              const active = segment.motion === item.id;
              const value = step ? readingOf(journey.mass, journey.g, step.a) : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => showMotion(item.id)}
                  className={
                    active
                      ? "family-card min-h-11 rounded-lg border border-primary bg-primary px-2 py-2 text-left text-primary-fg"
                      : "family-card min-h-11 rounded-lg border border-line bg-canvas px-2 py-2 text-left text-fg"
                  }
                >
                  <span className={`block text-sm font-semibold ${active ? "text-primary-fg" : "text-fg"}`}>
                    {item.chip}
                  </span>
                  <span className={`block text-sm tabular-nums ${active ? "text-primary-fg" : "text-muted"}`}>
                    {symbol} = {fmtN(value)} N
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="lift-readouts">
          <div className="grid grid-cols-3 gap-2">
            <Readout label="True weight mg" value={`${fmtN(weight)} N`} detail="downward" />
            <Readout
              label={apparatus === "balance" ? "Reading R" : "Reading T"}
              value={`${fmtN(reading)} N`}
              detail={relationText(segment.a, journey.g, symbol)}
              tone="text-primary"
            />
            <Readout
              label="Net force"
              value={Math.abs(net) < 0.05 ? "0 N" : `${fmtN(Math.abs(net))} N`}
              detail={Math.abs(net) < 0.05 ? "balanced" : segment.a > 0 ? "upward" : "downward"}
              tone="text-accent"
            />
          </div>
          <p className="lift-story mt-2 text-sm leading-6 text-fg">{storyLine(segment.v, segment.a, journey.g, symbol)}</p>
          <p className="lift-formula mt-2 text-sm tabular-nums leading-6 text-muted">
            a = {accelPhrase(segment.a, journey.g)}. {netLine}. {symbol} = m(g + a) = {fmtN(reading)} N
          </p>
        </div>
      </section>

      <section className="lift-graph rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl leading-tight text-fg">{symbol} against t</h2>
        <ReadingChart
          series={series}
          duration={duration}
          yMax={yMax}
          t={markerT}
          reading={reading}
          symbol={symbol}
          onSeek={(next) => {
            const step = segmentAt(journey, Math.min(Math.max(next, 0), Math.max(duration - 0.001, 0)));
            setMotionId(step.motion);
          }}
        />
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li className="flex items-center gap-2">
            <span className="inline-block h-1 w-6 bg-primary" />
            {symbol} against t
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-1 w-6 bg-muted" />
            mg, the true weight (dashed)
          </li>
        </ul>
      </section>

      <div className="lift-hand flex flex-col gap-3">
        <SliderField
          label="Mass"
          display={`${mass} kg`}
          min={30}
          max={90}
          step={1}
          value={mass}
          onChange={setMass}
          hint={`True weight mg = ${fmtN(mass * g)} N`}
        />
        <SliderField
          label="Size of acceleration |a|"
          display={`${fmtTrim(aMag)} m s⁻²`}
          min={0.5}
          max={6}
          step={0.1}
          value={aMag}
          onChange={setAMag}
          hint="Used for accelerating and decelerating. Uniform velocity and free fall ignore it."
        />
        <div>
          <p className="mb-1 text-sm font-semibold text-fg">g</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 10, label: "10 m s⁻²" },
              { value: 9.81, label: "9.81 m s⁻²" },
            ].map((option) => (
              <Choice key={option.label} pressed={g === option.value} onClick={() => setG(option.value)}>
                {option.label}
              </Choice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ReadingChart = memo(function ReadingChart({
  series,
  duration,
  yMax,
  t,
  reading,
  symbol,
  onSeek,
}: {
  series: { t: number; reading: number; mg: number }[];
  duration: number;
  yMax: number;
  t: number;
  reading: number;
  symbol: string;
  onSeek: (t: number) => void;
}) {
  const mounted = useMounted();
  return (
    <div className="fill-chart mt-3 h-64 w-full min-w-0 sm:h-72">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
            onClick={(state) => {
              const raw = state?.activeLabel;
              const label = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
              if (Number.isFinite(label)) onSeek(label);
            }}
          >
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, duration]}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              stroke="var(--color-line)"
              tickFormatter={(value: number) => fmtTrim(value)}
            />
            <YAxis
              type="number"
              domain={[0, yMax]}
              width={44}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              stroke="var(--color-line)"
              tickFormatter={(value: number) => fmtN(value)}
            />
            <Line
              type="stepAfter"
              dataKey="mg"
              name="mg"
              stroke="var(--color-muted)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="reading"
              name={symbol}
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine x={t} stroke="var(--color-accent)" strokeWidth={1.5} />
            <ReferenceDot
              x={t}
              y={Math.min(reading, yMax)}
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

function LiftScene({
  apparatus,
  reading,
  weight,
  a,
  v,
  g,
  symbol,
}: {
  apparatus: Apparatus;
  reading: number;
  weight: number;
  a: number;
  v: VSign;
  g: number;
  symbol: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const cabinRef = useRef<SVGGElement>(null);
  const speedTextRef = useRef<SVGTextElement>(null);
  const physRef = useRef({ a: 0, v: 1 as VSign, g: 10 });
  physRef.current = { a, v, g };
  const family = familyOf(a, g);

  useEffect(() => {
    const node = cabinRef.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let y = 120;
    let vel = 0;
    let key = "";
    let raf = 0;
    let last = performance.now();

    const boot = (accel: number, sign: VSign, gravity: number) => {
      const dir: 1 | -1 = sign === -1 ? -1 : 1;
      const run = runKind(accel, sign, gravity);
      if (run === "uniform") vel = 7 * dir;
      else if (run === "decel") vel = 14 * dir;
      else if (run === "free") vel = -1.5;
      else vel = 1.4 * dir;
      y = dir > 0 ? 190 : 28;
    };

    const draw = () => {
      node.setAttribute("transform", `translate(18 ${y.toFixed(2)})`);
      const label = speedTextRef.current;
      if (label) label.textContent = speedCaption(vel);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { a: accel, v: sign, g: gravity } = physRef.current;
      const nextKey = `${accel}|${sign}|${gravity}`;
      if (nextKey !== key) {
        key = nextKey;
        boot(accel, sign, gravity);
      }
      if (!media.matches && sign !== 0) {
        const dir: 1 | -1 = sign === -1 ? -1 : 1;
        const run = runKind(accel, sign, gravity);
        if (run === "uniform") vel = 7 * dir;
        else vel += accel * dt;
        if (run === "accel" && Math.abs(vel) > 15) {
          vel = 1.4 * dir;
          y = dir > 0 ? 190 : 28;
        } else if (run === "free" && vel < -26) {
          vel = -1.5;
          y = 28;
        } else if (run === "decel" && (Math.abs(vel) < 1.3 || vel * dir <= 0)) {
          vel = 14 * dir;
          y = dir > 0 ? 190 : 28;
        }
        y -= vel * 18 * dt;
        if (y < 16) y = 200;
        if (y > 200) y = 16;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    draw();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const aTone = family === "up" ? "primary" : family === "zero" ? "muted" : "accent";
  const aria = `${apparatus === "balance" ? "Balance" : "Spring balance"} in a lift. Reading ${fmtN(reading)} newtons, true weight ${fmtN(weight)} newtons. ${storyLine(v, a, g, symbol)}`;

  return (
    <svg viewBox="0 0 300 480" className="lift-svg mt-1 h-96 w-full sm:h-[32rem]" role="img" aria-label={aria}>
      <defs>
        <clipPath id={clipId}>
          <rect x="14" y="12" width="172" height="456" rx="12" />
        </clipPath>
      </defs>
      <rect x="8" y="8" width="184" height="464" rx="16" fill="var(--color-canvas)" stroke="var(--color-line)" />
      <g clipPath={`url(#${clipId})`}>
        {[90, 180, 270, 360].map((y) => (
          <line
            key={y}
            x1="14"
            x2="186"
            y1={y}
            y2={y}
            stroke="var(--color-line)"
            strokeDasharray="3 5"
          />
        ))}
        <g ref={cabinRef}>
          <line x1="82" y1="0" x2="82" y2="-70" stroke="var(--color-muted)" strokeWidth="2" />
          <rect x="6" y="0" width="156" height="250" rx="14" fill="var(--color-surface-2)" stroke="var(--color-line)" />
          {apparatus === "balance" ? (
            <BalanceFig reading={reading} weight={weight} symbol={symbol} />
          ) : (
            <SpringFig reading={reading} weight={weight} symbol={symbol} />
          )}
        </g>
      </g>
      <text ref={speedTextRef} x="198" y="26" fill="var(--color-muted)" fontSize="12" fontWeight="700">
        v
      </text>
      <ForcePair x={246} baseline={240} maxPx={150} reading={reading} weight={weight} symbol={symbol} />
      <text x="204" y="462" fill={`var(--color-${aTone})`} fontSize="13" fontWeight="700">
        a · {aWord(family, a, g)}
      </text>
    </svg>
  );
}

function runKind(a: number, v: VSign, g: number): "uniform" | "accel" | "decel" | "free" {
  if (a <= -g + 0.05) return "free";
  if (Math.abs(a) < 0.05) return "uniform";
  const dir = v === -1 ? -1 : 1;
  return a * dir > 0 ? "accel" : "decel";
}

function speedCaption(vel: number): string {
  const mag = Math.abs(vel);
  if (mag < 0.25) return "v = 0";
  return `v = ${mag.toFixed(1)} ${vel > 0 ? "up" : "down"}`;
}

function aWord(family: Family, a: number, g: number): string {
  if (family === "free") return "g down";
  if (family === "zero") return "zero";
  return `${fmtTrim(Math.abs(a))} ${family === "up" ? "up" : "down"}`;
}

function BalanceFig({ reading, weight, symbol }: { reading: number; weight: number; symbol: string }) {
  const liftOff = reading < 0.5 ? -16 : 0;
  return (
    <g>
      <g transform={`translate(0 ${liftOff})`}>
        <circle cx="72" cy="78" r="20" fill="var(--color-surface)" stroke="var(--color-fg)" strokeWidth="2" />
        <rect x="52" y="100" width="40" height="58" rx="12" fill="var(--color-surface)" stroke="var(--color-fg)" strokeWidth="2" />
      </g>
      <rect x="36" y="176" width="76" height="18" rx="5" fill="var(--color-canvas)" stroke="var(--color-primary)" strokeWidth="2" />
    </g>
  );
}

function SpringFig({ reading, weight, symbol }: { reading: number; weight: number; symbol: string }) {
  const span = weight > 0 ? reading / weight : 0;
  const len = 28 + Math.min(span, 1.6) * 48;
  const y0 = 18;
  const y1 = y0 + len;
  const slack = reading < 0.5;
  const blockY = slack ? y1 + 18 : y1;
  return (
    <g>
      <Coil x={72} y0={y0} y1={y1} />
      <rect
        x="46"
        y={blockY}
        width="52"
        height="36"
        rx="8"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeWidth="2"
      />
    </g>
  );
}

function Coil({ x, y0, y1 }: { x: number; y0: number; y1: number }) {
  const n = 8;
  const h = Math.max(12, y1 - y0);
  let d = `M ${x} ${y0}`;
  for (let i = 1; i <= n; i += 1) {
    const y = y0 + (h * i) / n;
    const side = i % 2 === 0 ? x + 11 : x - 11;
    d += ` L ${side} ${y - h / (2 * n)}`;
  }
  d += ` L ${x} ${y0 + h}`;
  return <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2" />;
}

function ForcePair({
  x,
  baseline,
  maxPx,
  reading,
  weight,
  symbol,
}: {
  x: number;
  baseline: number;
  maxPx: number;
  reading: number;
  weight: number;
  symbol: string;
}) {
  const peak = Math.max(reading, weight, 1);
  const scale = maxPx / peak;
  const rLen = reading * scale;
  const wLen = weight * scale;
  const rx = x - 18;
  const mx = x + 18;
  return (
    <g>
      <line x1={x - 34} y1={baseline} x2={x + 34} y2={baseline} stroke="var(--color-line)" strokeWidth="1.5" />
      <Shaft x={rx} y={baseline} len={rLen} up color="var(--color-primary)" label={symbol} />
      <Shaft x={mx} y={baseline} len={wLen} up={false} color="var(--color-accent)" label="mg" />
      {rLen > wLen + 4 ? (
        <line
          x1={rx - 11}
          x2={rx + 11}
          y1={baseline - wLen}
          y2={baseline - wLen}
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeDasharray="2 2"
        />
      ) : null}
      {wLen > rLen + 4 && rLen > 4 ? (
        <line
          x1={mx - 11}
          x2={mx + 11}
          y1={baseline + rLen}
          y2={baseline + rLen}
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeDasharray="2 2"
        />
      ) : null}
    </g>
  );
}

function Shaft({
  x,
  y,
  len,
  up,
  color,
  label,
}: {
  x: number;
  y: number;
  len: number;
  up: boolean;
  color: string;
  label: string;
}) {
  if (len < 3) {
    return (
      <text x={x} y={up ? y - 8 : y + 14} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">
        {label}
      </text>
    );
  }
  const y2 = up ? y - len : y + len;
  const head = up ? 1 : -1;
  const labelX = up ? x - 10 : x + 10;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y2} stroke={color} strokeWidth="5" strokeLinecap="round" />
      <polyline
        points={`${x - 7},${y2 + head * 9} ${x},${y2} ${x + 7},${y2 + head * 9}`}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={labelX}
        y={y2 + 4}
        textAnchor={up ? "end" : "start"}
        fill={color}
        fontSize="14"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-fg"
          : "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold text-fg"
      }
    >
      {children}
    </button>
  );
}

function Readout({
  label,
  value,
  detail,
  tone = "text-fg",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="readout rounded-lg bg-canvas px-2 py-2 sm:px-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display text-2xl leading-tight tabular-nums sm:text-3xl ${tone}`}>{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}

function SliderField({
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
