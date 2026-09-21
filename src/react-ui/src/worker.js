"use strict";
/// <reference types='vite/client' />
let offscreen = null;
let ctx = null;
let particles = [];
let isPaused = false;
let stepsPerFrame = 1;
let timestep = 0;
let backend = 'CPU';
let Lx = 100;
let Ly = 100;
let Qmax = 1000;
let R_s_min = 0.5;
let R_s_max = 5.0;
let dt = 0.1;
let nextIncoming = new Map();
let lastCfg = {};
let inputSignal = 0;
let Q_in_max = 50;
let deltaQ = 1;
let RcInput = 2.0;
let outputCharges = [];
self.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case 'init': {
            offscreen = event.data.offscreen;
            if (offscreen)
                ctx = offscreen.getContext('2d');
            lastCfg = event.data.config ?? {};
            Q_in_max = lastCfg.Q_in_max ?? 50;
            applyConfig(lastCfg, true);
            self.postMessage({ type: 'backend', payload: { backend } });
            break;
        }
        case 'reinit': {
            lastCfg = { ...lastCfg, ...payload };
            Q_in_max = lastCfg.Q_in_max ?? Q_in_max;
            applyConfig(lastCfg, true);
            sendMetrics();
            break;
        }
        case 'updateConfig': {
            lastCfg = { ...lastCfg, ...payload };
            applyConfig(lastCfg, false);
            break;
        }
        case 'setInput': {
            inputSignal = Math.max(0, Math.min(1, payload?.u ?? 0));
            break;
        }
        case 'play':
            isPaused = false;
            sendMetrics();
            break;
        case 'pause':
            isPaused = true;
            break;
        case 'step':
            doSteps(1);
            break;
        case 'reset':
            timestep = 0;
            initParticles(lastCfg);
            sendMetrics();
            break;
        case 'setSpeed':
            if (payload?.stepsPerFrame)
                stepsPerFrame = Math.max(1, payload.stepsPerFrame);
            break;
        case 'setBackend':
            if (payload?.backend) {
                backend = payload.backend;
                self.postMessage({ type: 'backend', payload: { backend } });
            }
            break;
        default:
            console.error('Unknown message', type);
    }
};
function applyConfig(cfg, reinit) {
    Lx = cfg.Lx ?? Lx;
    Ly = cfg.Ly ?? Ly;
    dt = cfg.dt ?? dt;
    Qmax = cfg.Qmax ?? Qmax;
    R_s_min = cfg.R_s_min ?? R_s_min;
    R_s_max = cfg.R_s_max ?? R_s_max;
    Q_in_max = cfg.Q_in_max ?? Q_in_max;
    deltaQ = cfg.deltaQ ?? cfg.delta_q ?? deltaQ;
    RcInput = cfg.RcInput ?? cfg.Rc_input ?? RcInput;
    backend = cfg.backend ?? backend;
    if (reinit) {
        initParticles(cfg);
    }
}
function initParticles(cfg) {
    const count = cfg.maxParticles ?? 198;
    const base = {
        H_max: cfg.Hmax ?? 100,
        theta_q: cfg.theta_q ?? 10,
        A: cfg.A ?? 2,
        K: cfg.K ?? 4,
        R_c: cfg.Rc ?? 1.0,
        m: cfg.m ?? 1.0,
        gamma: cfg.gamma ?? 0.1,
        R_s: cfg.Rs ?? 1.0,
        omega_R: cfg.omega_R ?? 0.5,
        omega_A: cfg.omega_A ?? 0.5,
        omega_v: cfg.omega_v ?? 0.5,
    };
    particles = [];
    nextIncoming.clear();
    // Input particles protected
    const inputGenome = { ...base, theta_q: 1, A: 1, K: count, R_c: RcInput };
    for (let i = 0; i < 1; i++) {
        particles.push({
            id: `in${i}`,
            pos: { x: Lx * 0.25, y: Ly * 0.25 },
            vel: { x: 0, y: 0 },
            health: inputGenome.H_max,
            charge: 0,
            genome: inputGenome,
            senderSet: new Set(),
            prevSenderSet: new Set(),
            lastCycleSuccess: false,
            role: 'input'
        });
        nextIncoming.set(`in${i}`, 0);
    }
    // Output particles protected
    const outputGenome = { ...base, theta_q: 1, A: 1, K: 0 };
    for (let i = 0; i < 1; i++) {
        particles.push({
            id: `out${i}`,
            pos: { x: Lx * 0.75, y: Ly * 0.75 },
            vel: { x: 0, y: 0 },
            health: outputGenome.H_max,
            charge: 0,
            genome: outputGenome,
            senderSet: new Set(),
            prevSenderSet: new Set(),
            lastCycleSuccess: false,
            role: 'output'
        });
        nextIncoming.set(`out${i}`, 0);
    }
    // Internal particles
    for (let i = 0; i < count; i++) {
        particles.push({
            id: `p${i}`,
            pos: { x: Math.random() * Lx, y: Math.random() * Ly },
            vel: { x: (Math.random() - 0.5) * 0.1, y: (Math.random() - 0.5) * 0.1 },
            health: base.H_max,
            charge: 0,
            genome: { ...base },
            senderSet: new Set(),
            prevSenderSet: new Set(),
            lastCycleSuccess: false,
            role: 'internal'
        });
        nextIncoming.set(`p${i}`, 0);
    }
    timestep = 0;
}
function periodicDelta(a, b, L) {
    const d = b - a - L * Math.round((b - a) / L);
    return d;
}
function distance(a, b) {
    const dx = periodicDelta(a.x, b.x, Lx);
    const dy = periodicDelta(a.y, b.y, Ly);
    return Math.sqrt(dx * dx + dy * dy);
}
function doSteps(n) {
    for (let i = 0; i < n; i++)
        mfmStep();
    timestep++;
    renderFrame();
    sendMetrics();
}
function mfmStep() {
    // Deliver charge from previous transmissions
    for (const p of particles) {
        const inc = nextIncoming.get(p.id) ?? 0;
        p.charge += inc;
        nextIncoming.set(p.id, 0);
    }
    // Quantize external input and inject into input particles
    const Q_in = Math.round(Q_in_max * inputSignal);
    for (const p of particles) {
        if (p.role === 'input') {
            p.charge += Q_in;
        }
    }
    // Activation, processing, transmission
    const transmissions = new Map();
    for (const p of particles) {
        const qPre = p.charge;
        const act = qPre >= p.genome.theta_q ? 1 : 0;
        let targets = [];
        if (act === 1 && p.role !== 'output') {
            const qOut = p.genome.A * p.genome.theta_q;
            const neighbors = particles.filter(q => q.id !== p.id && distance(p.pos, q.pos) <= p.genome.R_c);
            if (neighbors.length > 0) {
                const scores = neighbors.map(q => {
                    const phiR = q.genome.R_c;
                    const phiA = q.genome.A;
                    const phiV = Math.hypot(q.vel.x, q.vel.y);
                    const S = p.genome.omega_R * phiR + p.genome.omega_A * phiA + p.genome.omega_v * phiV;
                    return { q, S };
                });
                const K = Math.min(p.genome.K, neighbors.length);
                const selected = sampleWithoutReplacement(scores, K);
                targets = selected.map(s => s.q);
                for (const t of targets) {
                    transmissions.set(t.id, (transmissions.get(t.id) ?? 0) + qOut);
                }
            }
            const qRes = qPre - p.genome.theta_q;
            const qPost = Math.max(0, Math.min(Qmax, qRes - deltaQ));
            p.charge = qPost;
        }
        else {
            p.charge = Math.max(0, Math.min(Qmax, qPre));
        }
        p.prevSenderSet = new Set(p.senderSet);
        p.senderSet = new Set(targets.map(t => t.id));
        p.lastCycleSuccess = act === 1 && targets.length > 0;
    }
    for (const [id, amt] of transmissions.entries()) {
        nextIncoming.set(id, (nextIncoming.get(id) ?? 0) + amt);
    }
    // Health update with global error pressure
    const outputChargesNow = particles.filter(p => p.role === 'output').map(p => p.charge);
    outputCharges.push(...outputChargesNow);
    const globalError = outputChargesNow.length ? Math.min(1, outputChargesNow.reduce((a, b) => a + b, 0) / (outputChargesNow.length * Qmax)) : 0.1;
    const P = 0.1 + 0.9 * Math.pow(globalError, 1.0);
    const beta = 1.0;
    const lambda = 0.1;
    for (const p of particles) {
        if (p.role !== 'internal')
            continue;
        const deltaH = beta * (p.lastCycleSuccess ? 1 : 0) - lambda * P;
        p.health = Math.min(p.genome.H_max, Math.max(0, p.health + deltaH));
    }
    particles = particles.filter(p => p.health > 0 || p.role !== 'internal');
    // Mechanics for internal particles only
    for (const p of particles) {
        if (p.role !== 'internal')
            continue;
        const R_eff = R_s_min + (R_s_max - R_s_min) * (p.charge / Qmax);
        let fx = 0, fy = 0;
        for (const q of particles) {
            if (q.id === p.id)
                continue;
            const d = distance(p.pos, q.pos);
            if (d > R_eff || d < 1e-6)
                continue;
            const w = Math.max(0, 1 - d / R_eff);
            const dx = periodicDelta(p.pos.x, q.pos.x, Lx);
            const dy = periodicDelta(p.pos.y, q.pos.y, Ly);
            const norm = Math.sqrt(dx * dx + dy * dy) + 1e-6;
            const S = p.genome.omega_R * q.genome.R_c + p.genome.omega_A * q.genome.A;
            const f = S * w / norm;
            fx += f * dx;
            fy += f * dy;
        }
        const a = 1 - (p.genome.gamma * dt) / p.genome.m;
        p.vel.x = a * p.vel.x + (dt / p.genome.m) * fx;
        p.vel.y = a * p.vel.y + (dt / p.genome.m) * fy;
        p.pos.x = (p.pos.x + p.vel.x * dt) % Lx;
        if (p.pos.x < 0)
            p.pos.x += Lx;
        p.pos.y = (p.pos.y + p.vel.y * dt) % Ly;
        if (p.pos.y < 0)
            p.pos.y += Ly;
    }
}
function sampleWithoutReplacement(items, k) {
    const arr = [...items];
    const res = [];
    for (let i = 0; i < k && arr.length > 0; i++) {
        const weights = arr.map(it => Math.exp(it.S));
        const sum = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * sum;
        let idx = 0;
        while (r > 0 && idx < weights.length) {
            r -= weights[idx];
            idx++;
        }
        idx = Math.max(0, Math.min(idx, arr.length - 1));
        const [picked] = arr.splice(idx, 1);
        res.push(picked);
    }
    return res;
}
function sendMetrics() {
    let count = 0;
    let healthSum = 0;
    let chargeSum = 0;
    let inputCharge = 0;
    let outputCharge = 0;
    for (const p of particles) {
        if (p.role === 'internal') {
            count++;
            healthSum += p.health;
            chargeSum += p.charge;
        }
        else if (p.role === 'input') {
            inputCharge += p.charge;
        }
        else if (p.role === 'output') {
            outputCharge += p.charge;
        }
    }
    self.postMessage({
        type: 'metrics',
        payload: { metrics: { count, healthSum, chargeSum, inputCharge, outputCharge }, timestep },
    });
}
function renderFrame() {
    if (!offscreen || !ctx)
        return;
    const w = offscreen.width;
    const h = offscreen.height;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    for (const p of particles) {
        const px = (p.pos.x / Lx) * w;
        const py = (p.pos.y / Ly) * h;
        let hue = 200;
        let size = 3;
        if (p.role === 'input') {
            hue = 120;
            size = 6;
        }
        else if (p.role === 'output') {
            hue = 0;
            size = 6;
        }
        else {
            hue = 200 + (p.health / p.genome.H_max) * 100;
        }
        ctx.fillStyle = `hsl(${hue % 360}, 70%, 60%)`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
    }
    const bitmap = offscreen.transferToImageBitmap();
    self.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, { transfer: [bitmap] });
}
setInterval(() => {
    if (!isPaused)
        doSteps(stepsPerFrame);
}, 100);
self.postMessage({ type: 'backend', payload: { backend } });
