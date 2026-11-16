// EMBERKEEPER — beam.js
// Pure beam math: aim, focus, burn, oil drain. No DOM, no canvas — the
// balance sim imports this directly (SPEC §6).
import { CONFIG } from './config.js';

export function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Smooth the beam toward a target angle at a capped turn speed (weighty
// sweep, not instant teleport).
export function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

// Is a point inside the beam cone? Spread is the TOTAL cone angle.
export function inBeam(lampX, lampY, beamAngle, spreadRad, range, x, y) {
  const dx = x - lampX;
  const dy = y - lampY;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 4) return true;
  const a = Math.atan2(dy, dx);
  return Math.abs(angleDiff(a, beamAngle)) <= spreadRad / 2;
}

export function beamSpreadRad(state) {
  const base = state.focus ? CONFIG.beamFocusSpreadDeg : CONFIG.beamSpreadDeg;
  const extra = state.boons.includes('wide') ? 6 : 0;
  return ((base + extra) * Math.PI) / 180;
}

export function burnDps(state) {
  let dps = CONFIG.burnDps * (state.focus ? CONFIG.burnFocusMult : 1);
  if (state.boons.includes('hot')) dps *= 1.25;
  return dps;
}

export function oilDrainPerSec(state) {
  return CONFIG.oilDrainPerSec * (state.focus ? CONFIG.oilFocusMult : 1);
}

export function oilRefillPerSec(state) {
  let r = CONFIG.oilPassivePerSec;
  if (state.boons.includes('steady')) r += 0.8;
  return r;
}

export function oilMax(state) {
  return CONFIG.oilMax + (state.boons.includes('reserve') ? 25 : 0);
}
