export type Vector2 = { x: number; y: number };

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a: Vector2, s: number): Vector2 {
  return { x: a.x * s, y: a.y * s };
}
export function len(a: Vector2): number {
  return Math.hypot(a.x, a.y);
}
export function normalize(a: Vector2): Vector2 {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
export function wrap(v: Vector2, Lx: number, Ly: number): Vector2 {
  const wrap1 = (x: number, L: number) => ((x % L) + L) % L;
  return { x: wrap1(v.x, Lx), y: wrap1(v.y, Ly) };
}
export function periodicDelta(a: Vector2, b: Vector2, Lx: number, Ly: number): Vector2 {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  dx -= Lx * Math.round(dx / Lx);
  dy -= Ly * Math.round(dy / Ly);
  return { x: dx, y: dy };
}
export function periodicDistance(a: Vector2, b: Vector2, Lx: number, Ly: number): number {
  const d = periodicDelta(a, b, Lx, Ly);
  return Math.hypot(d.x, d.y);
}
