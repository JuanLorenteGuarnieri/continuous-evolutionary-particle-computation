// WGSL compute shader for charge update
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  health: f32,
  charge: i32,
};
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;
struct Params {
  Qmax: i32,
  dt: f32,
};
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  // placeholder: no-op for now
}
