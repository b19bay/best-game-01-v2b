// EMBERKEEPER — particles.js
// Particle + floating-text helpers. Pure state updates (no canvas here);
// render.js draws the arrays that nights.js already owns. These helpers
// are used by shots.js to stage dense, deterministic scenes.
export function spawnBurst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const s = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 12,
      life: state.rng.range(life * 0.5, life),
      max: life,
      size: state.rng.range(size * 0.5, size),
      color,
      kind: 'burst',
    });
  }
}

export function spawnText(state, x, y, text, color, size) {
  state.texts.push({ x, y, text, life: 1.4, max: 1.4, color, size: size || 16 });
}

// Deterministic ambient field for a scene: plankton dots + rain streaks,
// derived from a seed so shots are identical every capture.
export function ambientField(seed, count) {
  const pts = [];
  let a = (seed ^ 0x9e3779b9) >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    pts.push({
      x: 240 + next() * 1020,
      y: 60 + next() * 620,
      r: 0.8 + next() * 2.2,
      tw: next() * Math.PI * 2,
      c: next() < 0.5 ? '#2affd5' : '#7fb8ff',
    });
  }
  return pts;
}
