export function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a, s) {
    return { x: a.x * s, y: a.y * s };
}
export function len(a) {
    return Math.hypot(a.x, a.y);
}
export function normalize(a) {
    const l = len(a) || 1;
    return { x: a.x / l, y: a.y / l };
}
export function wrap(v, Lx, Ly) {
    const wrap1 = (x, L) => ((x % L) + L) % L;
    return { x: wrap1(v.x, Lx), y: wrap1(v.y, Ly) };
}
export function periodicDelta(a, b, Lx, Ly) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    dx -= Lx * Math.round(dx / Lx);
    dy -= Ly * Math.round(dy / Ly);
    return { x: dx, y: dy };
}
export function periodicDistance(a, b, Lx, Ly) {
    const d = periodicDelta(a, b, Lx, Ly);
    return Math.hypot(d.x, d.y);
}
//# sourceMappingURL=vector2d.js.map