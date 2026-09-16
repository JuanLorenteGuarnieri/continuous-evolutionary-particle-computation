import { readFileSync } from 'node:fs';
import { ExperimentManifest } from '@cepc/shared-config';
export function loadManifest(path: string): ExperimentManifest {
  const raw = readFileSync(path, 'utf-8');
  const obj = JSON.parse(raw);
  return ExperimentManifest.fromJSON(obj);
}
export function validateManifest(manifest: ExperimentManifest): boolean {
  return !!manifest.experimentId && manifest.duration > 0;
}
