export type VSign = 1 | -1 | 0 | null;

export type Family = "up" | "zero" | "down" | "free";

export type MotionId =
  | "uniform"
  | "up-accel"
  | "down-accel"
  | "up-decel"
  | "down-decel"
  | "freefall";

export type MotionDef = {
  id: MotionId;
  chip: string;
  title: string;
};

export const MOTIONS: MotionDef[] = [
  { id: "uniform", chip: "Uniform velocity", title: "Uniform velocity, up or down" },
  { id: "up-accel", chip: "Up, accelerating", title: "Upward with acceleration" },
  { id: "down-accel", chip: "Down, accelerating", title: "Downward with acceleration" },
  { id: "up-decel", chip: "Up, decelerating", title: "Upward with deceleration" },
  { id: "down-decel", chip: "Down, decelerating", title: "Downward with deceleration" },
  { id: "freefall", chip: "Free fall", title: "Free fall" },
];

export type Segment = {
  t0: number;
  t1: number;
  a: number;
  v: VSign;
  label: string;
  motion: MotionId;
};

export type Journey = {
  id: string;
  title: string;
  blurb: string;
  mass: number;
  g: number;
  segments: Segment[];
};

const STEP = 3;

export function motionsJourney(mass: number, g: number, aMag: number, uniformV: 1 | -1): Journey {
  const steps: { motion: MotionId; a: number; v: VSign; label: string }[] = [
    { motion: "uniform", a: 0, v: uniformV, label: "Uniform velocity" },
    { motion: "up-accel", a: aMag, v: 1, label: "Upward, accelerating" },
    { motion: "down-accel", a: -aMag, v: -1, label: "Downward, accelerating" },
    { motion: "up-decel", a: -aMag, v: 1, label: "Upward, decelerating" },
    { motion: "down-decel", a: aMag, v: -1, label: "Downward, decelerating" },
    { motion: "freefall", a: -g, v: -1, label: "Free fall" },
  ];
  return {
    id: "motions",
    title: "Six cases",
    blurb: "Each step holds one motion. The reading is level inside a step and jumps when the acceleration changes.",
    mass,
    g,
    segments: steps.map((step, index) => ({
      t0: index * STEP,
      t1: (index + 1) * STEP,
      a: step.a,
      v: step.v,
      label: step.label,
      motion: step.motion,
    })),
  };
}

export function fmtTrim(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const t = Math.round(n * 100) / 100;
  if (Math.abs(t) < 0.005) return "0";
  return String(t);
}

export function fmtG(g: number): string {
  return Math.abs(g - 10) < 1e-6 ? "10" : "9.81";
}

export function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.005) return "0";
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function readingOf(mass: number, g: number, aUp: number): number {
  if (mass <= 0) return 0;
  return Math.max(0, mass * (g + aUp));
}

export function familyOf(a: number, g: number): Family {
  if (a <= -g + 0.04) return "free";
  if (a < -0.04) return "down";
  if (a > 0.04) return "up";
  return "zero";
}

export function durationOf(journey: Journey): number {
  const last = journey.segments[journey.segments.length - 1];
  return last ? last.t1 : 0;
}

export function segmentAt(journey: Journey, t: number): Segment {
  const last = journey.segments[journey.segments.length - 1];
  if (!last || t >= last.t1) return last;
  return journey.segments.find((segment) => t >= segment.t0 && t < segment.t1) ?? last;
}

export type SeriesPoint = { t: number; reading: number; mg: number };

export function seriesOf(journey: Journey): SeriesPoint[] {
  const mg = journey.mass * journey.g;
  const points: SeriesPoint[] = journey.segments.map((segment) => ({
    t: segment.t0,
    reading: readingOf(journey.mass, journey.g, segment.a),
    mg,
  }));
  const last = journey.segments[journey.segments.length - 1];
  if (last) {
    points.push({
      t: last.t1,
      reading: readingOf(journey.mass, journey.g, last.a),
      mg,
    });
  }
  return points;
}

export function yMaxOf(journey: Journey): number {
  const mg = journey.mass * journey.g;
  let peak = mg;
  for (const segment of journey.segments) {
    peak = Math.max(peak, readingOf(journey.mass, journey.g, segment.a));
  }
  return Math.max(10, peak * 1.22);
}

export function insideOf(g: number, a: number): string {
  if (Math.abs(a) < 0.04) return `${fmtG(g)} + 0`;
  if (a > 0) return `${fmtG(g)} + ${fmtTrim(a)}`;
  return `${fmtG(g)} − ${fmtTrim(Math.abs(a))}`;
}

export function storyLine(v: VSign, a: number, g: number, symbol: string): string {
  const family = familyOf(a, g);
  if (family === "free") {
    return `Free fall: a = g downward and the net force is mg downward, so ${symbol} = 0. The true weight is still there.`;
  }
  if (family === "zero") {
    const way = v === -1 ? "downward" : "upward";
    return `Uniform velocity ${way}. a = 0 and the net force is zero, so ${symbol} = mg. Up or down, the steady speed does not change the reading.`;
  }
  const heavier = family === "up";
  const feel = heavier
    ? `${symbol} > mg. Net force and acceleration are upward.`
    : `${symbol} < mg. Net force and acceleration are downward.`;
  if (v === 1 && family === "down") {
    return `Moving up, but decelerating. ${feel}`;
  }
  if (v === -1 && family === "up") {
    return `Moving down, but decelerating. ${feel}`;
  }
  if (v === 1 && family === "up") return `Accelerating upward. ${feel}`;
  if (v === -1 && family === "down") return `Accelerating downward. ${feel}`;
  return feel;
}
