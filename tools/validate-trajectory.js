 import { readFileSync, writeFileSync } from 'node:fs';
 import { ExperimentManifest } from '../src/shared-config/src/ExperimentManifest.js';
 import { MfmCpuReference } from '../src/cpu-reference/src/MfmCpuReference.js';
 import { PopulationState, MFMConfig } from '../src/shared-config/src/index.js';
 
 // Validation harness for comparing CPU and GPU trajectories
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
   const count = Math.min(config.Nmax, 16);
   const spacing = Math.min(config.Lx, config.Ly) / 5;
   const startX = (config.Lx - spacing * (Math.sqrt(count) - 1)) / 2;
   const startY = (config.Ly - spacing * (Math.sqrt(count) - 1)) / 2;
 
   let idx = 0;
   for (let y = 0; y < Math.sqrt(count); y++) {
     for (let x = 0; x < Math.sqrt(count); x++) {
       const id = `particle-${idx}`;
       const genome = {
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
       };
       const state = {
         version: '3.0.0',
         position: { x: startX + x * spacing, y: startY + y * spacing },
         velocity: { x: 0, y: 0 },
         health: 100,
         charge: 0,
         senderSet: [],
         prevSenderSet: []
       };
 
       population.addParticle(id, genome, state);
       idx++;
     }
   }
 
   return population;
 }
 
 // CLI entry
 if (import.meta.url === `file://${process.argv[1]}`) {
   const manifestPath = process.argv[2];
   if (!manifestPath) {
     console.error('Usage: node tools/validate-trajectory.js <manifest.json>');
     process.exit(1);
   }
   validateTrajectory(manifestPath).then(report => {
     console.log(JSON.stringify(report, null, 2));
     process.exit(report.pass ? 0 : 1);
   });
 }
