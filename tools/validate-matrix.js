 import { readFileSync } from 'node:fs';
 import { validateTrajectory } from './validate-trajectory.js';
 
 async function runMatrix() {
   const matrix = JSON.parse(readFileSync('tools/validation-matrix.json', 'utf-8'));
   const results = [];
   for (const test of matrix.tests) {
     console.log(`Running test ${test.id}`);
     const report = await validateTrajectory(test.manifest);
     results.push(report);
   }
   const summary = {
     tests: results.length,
     passed: results.filter(r => r.pass).length,
     failed: results.filter(r => !r.pass).length,
     results
   };
   console.log(JSON.stringify(summary, null, 2));
   return summary;
 }
 
 if (import.meta.url === `file://${process.argv[1]}`) {
   runMatrix().then(() => process.exit(0));
 }
