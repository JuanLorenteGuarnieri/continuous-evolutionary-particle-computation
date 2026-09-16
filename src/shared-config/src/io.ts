import { readFileSync, writeFileSync } from 'node:fs';
import { ExperimentManifest } from './ExperimentManifest.js';

export function loadExperimentManifest(path: string): ExperimentManifest {
  const raw = readFileSync(path, 'utf-8');
  const obj = JSON.parse(raw);
  return ExperimentManifest.fromJSON(obj);
}

export function saveExperimentManifest(manifest: ExperimentManifest, path: string): void {
  writeFileSync(path, JSON.stringify(manifest.toJSON(), null, 2), 'utf-8');
}
