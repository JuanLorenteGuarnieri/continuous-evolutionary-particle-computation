export interface GenomeBuffer {
  data: Float32Array;
}
export interface ParticleStateBuffer {
  data: Float32Array;
}
export function serializeParticles(particles: any[]): Float32Array {
  // placeholder
  return new Float32Array(particles.length * 4);
}
