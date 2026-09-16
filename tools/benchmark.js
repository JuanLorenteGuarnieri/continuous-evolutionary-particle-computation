 import { readFileSync, writeFileSync } from 'node:fs';
 import { ExperimentManifest } from '../src/shared-config/src/ExperimentManifest.js';
 import { MfmCpuReference } from '../src/cpu-reference/src/MfmCpuReference.js';
 
 async function benchmark(manifestPath, steps = 1000) {
   const raw = readFileSync(manifestPath, 'utf-8');
   const obj = JSON.parse(raw);
   const manifest = ExperimentManifest.fromJSON(obj);
   const config = manifest.mfmConfig;
 
   // Create initial population
   const population = createInitialPopulation(config);
   const sim = new MfmCpuReference(config, population, config.seed);
 
   const start = process.hrtime.bigint();
   for (let i = 0; i < steps; i++) {
     sim.step();
   }
   const end = process.hrtime.bigint();
   const durationMs = Number(end - start) / 1e6;
   const latencyMs = durationMs / steps;
   const particles = population.particles.size;
   const throughput = particles / (durationMs / 1000);
 
   const result = {
     manifestId: manifest.experimentId,
     steps,
     durationMs,
     latencyMs,
     throughput,
     particles
   };
 
   writeFileSync(`performance/benchmark-${manifest.experimentId}.json`, JSON.stringify(result, null, 2));
   console.log(result);
   return result;
 }
 
 function createInitialPopulation(config) {
   const { PopulationState } = await import('../src/shared-config/src/PopulationState.js');
   const { Genome } = await import('../src/shared-config/src/Genome.js');
   const { ParticleState } = await import('../src/shared-config/src/ParticleState.js');
   const population = new PopulationState();
   const count = Math.min(config.Nmax, 256);
   const spacing = Math.min(config.Lx, config.Ly) / Math.sqrt(count);
   const startX = (config.Lx - spacing * (Math.sqrt(count) - 1)) / 2;
   const startY = (config.Ly - spacing * (Math.sqrt(count) - 1)) / 2;
 
   let idx = 0;
   for (let y = 0; y < Math.sqrt(count); y++) {
     for (let x = 0; x < Math.sqrt(count); x++) {
       const id = `particle-${idx}`;
       const genome = new Genome({
         Hmax: 100,
         theta_q: 10,
         A: 2,
         K: 4,
         Rc: 1.0,
         m: 1.0,
         gamma: 0.1,
         Rs: 1.0,
         omega_R: 0.5,
         omega_A: 0.5,
         omega_v: 0.5
       });
       const state = new ParticleState({
         version: '3.0.0',
         position: { x: startX + x * spacing, y: startY + y * spacing },
         velocity: { x: 0, y: 0 },
         health: 100,
         charge: 0,
         senderSet: new Set(),
         prevSenderSet: new Set()
       });
       population.addParticle(id, genome.clone(), state);
       idx++;
     }
   }
   return population;
 }
 
 if (import.meta.url === `file://${process.argv[1]}`) {
   const manifestPath = process.argv[2] || 'configs/experiments/P0-manifest.json';
   benchmark(manifestPath, 500).then(() => process.exit(0));
 }
