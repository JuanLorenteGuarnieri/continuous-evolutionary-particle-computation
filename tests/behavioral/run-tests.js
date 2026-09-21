import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { MFMConfig, PopulationState, Genome, ParticleState } from '../../src/shared-config/src/index.js';
import { MfmCpuReference } from '../../src/cpu-reference/dist/cpu-reference/src/MfmCpuReference.js';

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(__dirname, path), 'utf-8'));
}

const manifest = loadJson('test-manifest.json');
let passed = 0;
let failed = 0;

for (const family of manifest.testFamilies) {
  const data = loadJson(family.dataFile);
  const cfg = new MFMConfig(data.config);
  const pop = new PopulationState();
  for (const [id, g] of Object.entries(data.population.genomes)) {
    pop.addParticle(id, new Genome(g), new ParticleState(data.population.particles[id]));
  }
  const sim = new MfmCpuReference(cfg, pop, data.config.seed ?? cfg.seed);
  const steps = data.steps ?? 1;
  for (let i = 0; i < steps; i++) sim.step();
  const stateJson = sim.getState().population;
  const particlesMap = new Map(stateJson.particles);
  let ok = true;
  for (const [pid, exp] of Object.entries(data.expected)) {
    const p = particlesMap.get(pid);
    if (!p || p.charge !== exp.charge || (exp.health !== undefined && p.health !== exp.health)) {
      ok = false;
      break;
    }
  }
  if (ok) { passed++; console.log(`✓ ${family.id}`); } else { failed++; console.log(`✗ ${family.id}`); }
}
console.log(`Passed: ${passed}/${manifest.testFamilies.length}`);
process.exit(failed > 0 ? 1 : 0);
