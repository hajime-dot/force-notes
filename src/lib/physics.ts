export type FrictionParams = {
  mass: number;
  g: number;
  muS: number;
  muK: number;
};

export type FrictionMode = "static" | "kinetic";

export type FrictionView = {
  friction: number;
  a: number;
  mode: FrictionMode;
  fsMax: number;
  fk: number;
  normal: number;
};

const STICK = 0.05;

export function describeFriction(v: number, F: number, p: FrictionParams): FrictionView {
  const normal = p.mass * p.g;
  const muK = Math.min(Math.max(p.muK, 0), p.muS);
  const fsMax = p.muS * normal;
  const fk = muK * normal;
  const atRest = Math.abs(v) <= STICK;
  if (atRest && Math.abs(F) <= fsMax) {
    return { friction: -F, a: 0, mode: "static", fsMax, fk, normal };
  }
  const dir = atRest ? Math.sign(F) || 1 : Math.sign(v) || 1;
  const friction = -dir * fk;
  const a = p.mass > 0 ? (F + friction) / p.mass : 0;
  return { friction, a, mode: "kinetic", fsMax, fk, normal };
}

export function stepFriction(
  v: number,
  x: number,
  F: number,
  p: FrictionParams,
  dt: number,
): FrictionView & { v: number; x: number } {
  const safeDt = Math.max(0, Math.min(dt, 0.05));
  const d = describeFriction(v, F, p);
  if (d.mode === "static" || safeDt === 0) {
    return { ...d, v: d.mode === "static" ? 0 : v, x };
  }
  let nv = (Math.abs(v) <= STICK ? 0 : v) + d.a * safeDt;
  const crossed = Math.abs(v) > STICK && v * nv <= 0;
  const creptUnder = Math.abs(nv) <= STICK;
  if (crossed || creptUnder) {
    const held = describeFriction(0, F, p);
    if (held.mode === "static") return { ...held, v: 0, x };
    nv = Math.sign(held.a || F || 1) * Math.max(STICK * 1.01, Math.abs(held.a) * safeDt);
  }
  const v0 = Math.abs(v) <= STICK ? 0 : v;
  const nx = x + ((v0 + nv) / 2) * safeDt;
  const after = describeFriction(nv, F, p);
  return { ...after, v: nv, x: nx };
}

export type DiverParams = {
  mass: number;
  g: number;
  kBody: number;
  kChute: number;
};

/** Canopy opens over this many seconds so the v–t curve is a slope, not a cliff. */
export const RAMP_S = 4;

export type StageId = "jump" | "speeding" | "terminal" | "opening" | "settled";

export const STAGES: { id: StageId; short: string; title: string; body: string }[] = [
  {
    id: "jump",
    short: "Jump",
    title: "Just after jumping",
    body: "Speed is still almost zero, so air resistance is negligible. Weight is unbalanced. Net force equals the weight, downward, and the acceleration is g.",
  },
  {
    id: "speeding",
    short: "Speeding up",
    title: "Speeding up",
    body: "Air resistance grows with the square of the speed and acts upward. Net force is still downward, but smaller, so the acceleration is less than g. Speed is still rising.",
  },
  {
    id: "terminal",
    short: "Terminal",
    title: "Terminal speed",
    body: "Air resistance has grown to equal the weight. Net force is zero, so acceleration is zero. The diver falls at a steady terminal speed.",
  },
  {
    id: "opening",
    short: "Parachute",
    title: "Parachute opens",
    body: "The parachute increases k, so air resistance becomes larger than the weight. Net force is upward and the acceleration is upward. The diver is still falling, but slowing down.",
  },
  {
    id: "settled",
    short: "New speed",
    title: "New terminal speed",
    body: "As speed falls, air resistance falls too, until it again equals the weight. Acceleration returns to zero, at a much smaller terminal speed.",
  },
];

export type DiverState = {
  t: number;
  y: number;
  v: number;
  opened: boolean;
  phase: number;
  tOpen: number | null;
};

export type DiverReading = {
  weight: number;
  drag: number;
  net: number;
  a: number;
  k: number;
  v: number;
};

export type Sample = {
  t: number;
  v: number;
  a: number;
  drag: number;
  net: number;
  weight: number;
};

export function terminalSpeed(mass: number, g: number, k: number): number {
  if (k <= 0 || mass <= 0) return 0;
  return Math.sqrt((mass * g) / k);
}

export function zeroDiver(): DiverState {
  return { t: 0, y: 0, v: 0, opened: false, phase: 0, tOpen: null };
}

function smoothstep(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

export function kEffective(p: DiverParams, s: DiverState): number {
  if (!s.opened) return p.kBody;
  return p.kBody + (p.kChute - p.kBody) * smoothstep(s.phase);
}

export function readDiver(v: number, k: number, p: DiverParams): DiverReading {
  const weight = p.mass * p.g;
  const drag = k * v * v;
  const net = weight - drag;
  const a = p.mass > 0 ? net / p.mass : 0;
  return { weight, drag, net, a, k, v };
}

/** Integrate downward speed with R = k v². Downward is positive. */
export function stepVelocity(v: number, k: number, p: DiverParams, dt: number): number {
  let vel = Math.max(0, v);
  let left = Math.max(0, dt);
  const hMax = 0.004;
  const mass = Math.max(p.mass, 0.001);
  while (left > 1e-8) {
    const h = Math.min(hMax, left);
    const a = p.g - (k * vel * vel) / mass;
    vel = Math.max(0, vel + a * h);
    left -= h;
  }
  return vel;
}

export function advanceDiver(
  s: DiverState,
  p: DiverParams,
  dt: number,
  autoOpen: boolean,
): DiverReading {
  const vt1 = terminalSpeed(p.mass, p.g, p.kBody);
  if (autoOpen && !s.opened && s.t > 0.3 && vt1 > 0 && s.v >= 0.98 * vt1) {
    s.opened = true;
    s.tOpen = s.t;
  }
  if (s.opened) s.phase = Math.min(1, s.phase + dt / RAMP_S);
  const k = kEffective(p, s);
  s.v = stepVelocity(s.v, k, p, dt);
  s.y += s.v * dt;
  s.t += dt;
  return readDiver(s.v, k, p);
}

export function stageOf(s: DiverState, p: DiverParams): StageId {
  const vt1 = terminalSpeed(p.mass, p.g, p.kBody);
  const vt2 = terminalSpeed(p.mass, p.g, p.kChute);
  if (!s.opened) {
    if (s.v < 0.12 * vt1) return "jump";
    if (s.v < 0.93 * vt1) return "speeding";
    return "terminal";
  }
  const close = Math.abs(s.v - vt2) <= 0.005;
  if (s.phase < 0.98 || !close) return "opening";
  return "settled";
}

export function sampleOf(s: DiverState, p: DiverParams): Sample {
  const reading = readDiver(s.v, kEffective(p, s), p);
  return {
    t: s.t,
    v: s.v,
    a: reading.a,
    drag: reading.drag,
    net: reading.net,
    weight: reading.weight,
  };
}

export function replayTo(p: DiverParams, target: StageId): { state: DiverState; points: Sample[] } {
  const s = zeroDiver();
  const points: Sample[] = [sampleOf(s, p)];
  if (target === "jump") return { state: s, points };

  const vt1 = terminalSpeed(p.mass, p.g, p.kBody);
  const vt2 = terminalSpeed(p.mass, p.g, p.kChute);
  const goalV = target === "speeding" ? 0.45 * vt1 : 0.985 * vt1;
  let guard = 0;
  while (s.v < goalV && s.t < 40 && guard < 8000) {
    advanceDiver(s, p, 0.02, false);
    guard += 1;
    if (guard % 5 === 0) points.push(sampleOf(s, p));
  }
  points.push(sampleOf(s, p));
  if (target === "speeding" || target === "terminal") return { state: s, points };

  s.opened = true;
  s.tOpen = s.t;
  guard = 0;
  while (s.t < 80 && guard < 12000) {
    advanceDiver(s, p, 0.02, false);
    guard += 1;
    if (guard % 5 === 0) points.push(sampleOf(s, p));
    if (target === "opening" && s.phase >= 0.4) break;
    if (target === "settled" && s.phase >= 1 && Math.abs(s.v - vt2) <= 0.005) break;
  }
  points.push(sampleOf(s, p));
  return { state: s, points };
}

export function fmtN(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.05) return "0";
  const t = Math.round(n * 10) / 10;
  return Number.isInteger(t) ? t.toFixed(0) : t.toFixed(1);
}

export function fmt1(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.05) return "0";
  return (Math.round(n * 10) / 10).toFixed(1);
}
