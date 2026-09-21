import { readFileSync } from 'node:fs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { ExperimentManifest } from '@cepc/shared-config';
export function loadManifest(path) {
    const raw = readFileSync(path, 'utf-8');
    const obj = JSON.parse(raw);
    return ExperimentManifest.fromJSON(obj);
}
export function validateManifest(manifest) {
    return !!manifest.experimentId && manifest.duration > 0;
}
