// EMBERKEEPER — ships.js
// Pure ship logic: approach, escort (lit by the beam), wreck, docking.
// No DOM/canvas — the balance sim imports this directly (SPEC §6).
import { CONFIG } from './config.js';
import { inBeam } from './beam.js';

export function makeShip(name, laneIndex, enterDelay, rng) {
  const y = CONFIG.shipLanesY[laneIndex % CONFIG.shipLanesY.length];
  return {
    name,
    x: 1300,
    y,
    startY: y,
    // Ships sail diagonally down-left toward the harbour mouth.
    vx: 0, vy: 0,
    speed: CONFIG.shipSpeed,
    state: 'waiting', // waiting -> sailing -> docked | wrecked
    enterDelay,
    touches: 0, // wisp touches so far (IRON HULL allows 2)
    lit: false,
    // Harbour-light grace: a ship is lit (safe) for its first seconds
    // after entering, so it cannot be wrecked the instant it appears
    // where wisps spawn — the player gets a fair chance to swing the
    // beam over to cover it.
    grace: 2.5,
    bobPhase: rng ? rng.range(0, Math.PI * 2) : 0,
    wreckTimer: 0,
  };
}

export function shipPath(ship) {
  const hx = CONFIG.harbour.x;
  const hy = CONFIG.harbour.y;
  const dx = hx - ship.x;
  const dy = hy - ship.y;
  const d = Math.hypot(dx, dy) || 1;
  return { dx: dx / d, dy: dy / d, dist: d };
}

// One fixed step. Returns 'docked' when the ship reaches the harbour.
export function updateShip(s, dt, state, beamAngle, spreadRad) {
  if (s.state === 'waiting') {
    s.enterDelay -= dt;
    if (s.enterDelay <= 0) s.state = 'sailing';
    return null;
  }
  if (s.state !== 'sailing') return null;
  if (s.grace > 0) s.grace -= dt;
  s.lit = inBeam(CONFIG.lamp.x, CONFIG.lamp.y, beamAngle, spreadRad, CONFIG.beamRange, s.x, s.y) || s.grace > 0;
  const p = shipPath(s);
  s.x += p.dx * s.speed * dt;
  s.y += p.dy * s.speed * dt;
  if (p.dist < 26) {
    s.state = 'docked';
    return 'docked';
  }
  return null;
}

// A wisp touching a ship in darkness wrecks it (or, with IRON HULL, the
// first touch only slows it). Returns 'wrecked' | 'slowed' | null.
export function shipTouchWisp(s, state) {
  if (s.state !== 'sailing') return null;
  if (s.lit) return null; // safe while the beam touches the ship
  s.touches += 1;
  const hull = state.boons.includes('hull') ? 2 : 1;
  if (s.touches >= hull) {
    s.state = 'wrecked';
    s.wreckTimer = 1.6;
    return 'wrecked';
  }
  s.speed = CONFIG.shipSpeed * 0.45; // first touch (IRON HULL) only slows
  return 'slowed';
}
