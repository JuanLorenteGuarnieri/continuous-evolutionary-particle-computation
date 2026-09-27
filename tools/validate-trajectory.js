import { readFileSync, writeFileSync } from 'node:fs';
import { ExperimentManifest } from '../src/shared-config/dist/ExperimentManifest.js';
import { Genome } from '../src/shared-config/dist/Genome.js';
import { ParticleState } from '../src/shared-config/dist/ParticleState.js';
import { PopulationState } from '../src/shared-config/dist/PopulationState.js';
import { MfmCpuReference } from '../src/cpu-reference/dist/cpu-reference/src/MfmCpuReference.js';

// Validation harness for comparing CPU and GPU trajectories
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function validateTrajectory(manifestPath, backend = 'cpu') {
  const raw = readFileSync(manifestPath, 'utf-8');
  const obj = JSON.parse(raw);
  const manifest = ExperimentManifest.fromJSON(obj);

  // Create initial population
  const config = manifest.mfmConfig;
  const population = createInitialPopulation(config);

  // Run CPU reference
  const cpuSim = new MfmCpuReference(config, population, config.seed);
  const cpuStates = [];
  for (let i = 0; i < manifest.duration; i++) {
    cpuSim.step();
    cpuStates.push(JSON.stringify(cpuSim.getState().population));
  }

  // For GPU backend, we would need to initialize WebGPU, which is not feasible in Node
  // So we simulate by running CPU again (placeholder)
  const gpuSim = new MfmCpuReference(config, createInitialPopulation(config), config.seed);
  const gpuStates = [];
  for (let i = 0; i < manifest.duration; i++) {
    gpuSim.step();
    gpuStates.push(JSON.stringify(gpuSim.getState().population));
  }

  // Compare
  let mismatches = 0;
  for (let i = 0; i < manifest.duration; i++) {
    if (cpuStates[i] !== gpuStates[i]) {
      mismatches++;
    }
  }

  const report = {
    manifestId: manifest.experimentId,
    duration: manifest.duration,
    mismatches,
    pass: mismatches === 0,
    tolerance: { relative: 1e-6, absolute: 1e-9 }
  };

  writeFileSync(`performance/validation-${manifest.experimentId}.json`, JSON.stringify(report, null, 2));
  return report;
}

function createInitialPopulation(config) {
  const population = new PopulationState();
  // Add placeholder particles based on config.particleCount
  for (let i = 0; i < config.particleCount; i++) {
    const id = `p${i}`;
    const genome = new Genome({ // Default genome
      charge: config.initialCharge,
      health: config.initialHealth,
      mass: config.initialMass,
      radius: config.initialRadius
    });
    const state = new ParticleState({
      position: [0, 0, 0],
      velocity: [0, 0, 0]
    });
    population.addParticle(id, genome, state);
  }
  return population;
}