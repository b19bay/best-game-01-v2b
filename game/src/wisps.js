// EMBERKEEPER — wisps.js
// Pure wisp logic: kinds, spawning, drift, burn, boss behaviour.
// No DOM/canvas — the balance sim imports this directly (SPEC §6).
import { CONFIG, WISP_KINDS, BOSSES } from './config.js';
import { angleTo } from './beam.js';

export function wispHp(kindKey, night, isBoss) {
  if (isBoss) return BOSSES[night].hp;
  const base = WISP_KINDS[kindKey].hp;
  return base * (1 + 0.1 * (night - 1)) * CONFIG.wispHpMult;
}

export function makeWisp(kindKey, x, y, night, rng, isBoss) {
  const def = isBoss ? BOSSES[night] : WISP_KINDS[kindKey];
  return {
    kind: kindKey,
    isBoss: !!isBoss,
    name: def.name,
    x, y,
    hp: wispHp(kindKey, night, isBoss),
    maxHp: wispHp(kindKey, night, isBoss),
    speed: def.speed,
    oil: def.oil,
    score: def.score,
    color: def.color,
    core: def.core,
    radius: def.radius,
    // Drift target: lamp or nearest ship, re-picked every 2 s.
    tx: CONFIG.lamp.x, ty: CONFIG.lamp.y,
    retarget: 0,
    wobblePhase: rng ? rng.range(0, Math.PI * 2) : 0,
    wobbleAmp: rng ? rng.range(6, 16) : 10,
    stunned: 0,
    // Boss timers.
    ringTimer: 10,
    spawnTimer: 8,
    chargeTimer: 6,
    charging: 0,
    pulseTimer: 15,
    dead: false,
  };
}

// Pick the drift target: the lamp, or the nearest living ship, whichever
// is closer to this wisp.
export function pickTarget(w, state) {
  let bx = CONFIG.lamp.x;
  let by = CONFIG.lamp.y;
  let best = Math.hypot(w.x - bx, w.y - by);
  for (const s of state.ships) {
    if (s.state !== 'sailing') continue;
    const d = Math.hypot(w.x - s.x, w.y - s.y);
    if (d < best) { best = d; bx = s.x; by = s.y; }
  }
  w.tx = bx; w.ty = by;
}

// One fixed step of wisp motion. `spawn` is a callback(kind, x, y) the
// caller supplies for boss summons; `events` collects audio/visual cues.
export function updateWisp(w, dt, state, spawn, events) {
  if (w.dead) return;
  if (w.stunned > 0) { w.stunned -= dt; return; }
  w.retarget -= dt;
  if (w.retarget <= 0) { pickTarget(w, state); w.retarget = 2; }

  let speed = w.speed;
  if (w.isBoss && state.night === 4) {
    // Storm Wraith charges at the lamp in bursts.
    w.chargeTimer -= dt;
    if (w.charging > 0) { w.charging -= dt; speed *= 3; }
    else if (w.chargeTimer <= 0) { w.charging = 1.5; w.chargeTimer = 6; events.push({ type: 'charge' }); }
  }
  const dl = Math.hypot(w.x - CONFIG.lamp.x, w.y - CONFIG.lamp.y);
  // CLINGING: a wisp that reaches the lamp's glow stops advancing and
  // clings to the light, drinking oil until the beam sweeps over it.
  // It orbits slowly at the lamp's edge, so a fixed beam only ever
  // covers the clingers whose angle happens to lie inside its cone.
  // Bosses loom in place at the lamp instead of orbiting, drinking
  // oil twice as fast — they must be burned, not outwaited.
  if (dl < CONFIG.lampHoverRadius && w.tx === CONFIG.lamp.x && w.ty === CONFIG.lamp.y) {
    const drain = w.isBoss ? 2 : (w.kind === 'leech' ? CONFIG.leechHoverDrainPerSec : CONFIG.hoverDrainPerSec);
    state.oil = Math.max(0, state.oil - drain * dt);
    if (!w.isBoss) {
      // Slow orbit around the lamp (tangential drift).
      const a = Math.atan2(w.y - CONFIG.lamp.y, w.x - CONFIG.lamp.x) + Math.PI / 2;
      w.x += Math.cos(a) * 10 * dt;
      w.y += Math.sin(a) * 10 * dt;
    }
  } else {
    const a = angleTo(w.x, w.y, w.tx, w.ty);
    const wob = Math.sin(state.time * 1.7 + w.wobblePhase) * w.wobbleAmp * dt;
    w.x += Math.cos(a) * speed * dt + Math.cos(a + Math.PI / 2) * wob;
    w.y += Math.sin(a) * speed * dt + Math.sin(a + Math.PI / 2) * wob;
  }

  // Boss abilities.
  if (w.isBoss && state.night === 3) {
    w.ringTimer -= dt;
    if (w.ringTimer <= 0) {
      w.ringTimer = 10;
      for (let i = 0; i < 3; i++) spawn('mote', w.x + (i - 1) * 46, w.y - 30);
      events.push({ type: 'bossring', x: w.x, y: w.y });
    }
  }
  if (w.isBoss && state.night === 5) {
    w.spawnTimer -= dt;
    if (w.spawnTimer <= 0) {
      w.spawnTimer = 8;
      spawn('swift', w.x - 40, w.y - 20);
      spawn('swift', w.x - 40, w.y + 20);
      events.push({ type: 'bossspawn', x: w.x, y: w.y });
    }
    w.pulseTimer -= dt;
    if (w.pulseTimer <= 0) {
      w.pulseTimer = 15;
      spawn('mote', w.x - 60, w.y - 40);
      spawn('mote', w.x - 60, w.y + 40);
      events.push({ type: 'bosspulse', x: w.x, y: w.y });
    }
  }

  // (Leech drain is the clinging drain above, at the higher leech rate.)
}

// Apply burn damage; returns 'dead' | 'alive'. Splitting is the caller's job.
export function damageWisp(w, dmg) {
  w.hp -= dmg;
  return w.hp <= 0 ? 'dead' : 'alive';
}
