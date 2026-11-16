// EMBERKEEPER — nights.js
// Run state machine + night composition + the pure fixed-step update.
// This module is the game's heart and is DOM-free: the balance sim calls
// createRun + stepRun directly (SPEC §6), and main.js calls the same
// functions every 1/60 s frame.
import { CONFIG, WISP_KINDS, WISP_UNLOCKS, BOSSES, BOONS } from './config.js';
import { createRng } from './random.js';
import { angleTo, angleDiff, turnToward, inBeam, beamSpreadRad, burnDps, oilDrainPerSec, oilRefillPerSec, oilMax } from './beam.js';
import { makeWisp, updateWisp, damageWisp } from './wisps.js';
import { makeShip, updateShip, shipTouchWisp } from './ships.js';

export function nightBudget(n) {
  return 14 + 10 * n;
}

export function spawnInterval(n) {
  return Math.max(CONFIG.spawnIntervalFloor, CONFIG.spawnIntervalStart - 0.1 * (n - 1));
}

// Compose night n from its budget (SPEC §5): spend B(n) on wisps at point
// costs, weighted toward newer unlocks as nights progress. The boss of
// nights 3–5 is NOT in the budget — it spawns last, on top of it.
export function composeNight(n, rng) {
  const budget = nightBudget(n);
  const unlocked = Object.keys(WISP_KINDS).filter((k) => WISP_UNLOCKS[k] <= n);
  // Weights tilt toward the newest unlocks as nights progress.
  const weights = unlocked.map((k) => {
    const age = n - WISP_UNLOCKS[k]; // 0 = just unlocked
    return age === 0 ? 5 : age === 1 ? 3 : 2;
  });
  const list = [];
  let spent = 0;
  let guard = 0;
  while (spent < budget && guard++ < 200) {
    let total = 0;
    for (const w of weights) total += w;
    let roll = rng.next() * total;
    let kind = unlocked[0];
    for (let i = 0; i < unlocked.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { kind = unlocked[i]; break; }
    }
    list.push(kind);
    spent += WISP_KINDS[kind].cost;
  }
  return list;
}

// Exact next-night preview: recompute the composition from the same
// deterministic sub-seed, so the preview the HUD shows is exact (§5).
export function previewNight(seed, n) {
  const rng = createRng(seed).fork(1000 + n * 7919);
  const list = composeNight(n, rng);
  const counts = {};
  for (const k of list) counts[k] = (counts[k] || 0) + 1;
  return { counts, boss: BOSSES[n] ? BOSSES[n].name : null, total: list.length };
}

export function createRun(seed) {
  const rng = createRng(seed);
  const state = {
    seed,
    rng,
    phase: 'title', // title | playing | paused | boon | nightclear | victory | defeat
    time: 0, // total simulated seconds (fixed steps only — no wall clock)
    night: 1,
    nightTime: 0,
    score: 0,
    oil: CONFIG.oilStart,
    warmth: 40,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    burned: 0,
    shipsSaved: 0,
    shipsWrecked: 0,
    shipsSavedTotal: 0,
    nightShips: 0,
    beamAngle: 0,
    beamTarget: 0,
    focus: false,
    beamOn: true,
    bellCd: 0,
    bellReadyAt: 0,
    boons: [],
    boonOffer: null,
    wisps: [],
    ships: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossSpawned: false,
    boss: null,
    shake: 0,
    flash: 0,
    lightning: 0,
    lightningTimer: 8,
    rainSeed: seed,
    events: [], // per-step cues for audio (drained by main.js)
    defeatReason: '',
    nightClearStats: null,
    runStartNight: 1,
    bestScore: 0,
    lastRuns: [],
    // Shot-scene staging (set by shots.js, not by play).
    shotScene: null,
  };
  return state;
}

export function shipCountForNight(state) {
  return 3 + (state.boons.includes('long') ? 1 : 0);
}

export function startNight(state, n) {
  state.night = n;
  state.nightTime = 0;
  state.wisps = [];
  state.ships = [];
  state.particles = [];
  state.texts = [];
  state.spawnQueue = [];
  state.bossSpawned = false;
  state.boss = null;
  state.combo = 0;
  state.comboTimer = 0;
  state.nightShips = 0;
  const rng = state.rng.fork(1000 + n * 7919);
  state.spawnQueue = composeNight(n, rng);
  state.spawnTimer = 1.0;
  const count = shipCountForNight(state);
  for (let i = 0; i < count; i++) {
    const name = CONFIG.shipNames[i % CONFIG.shipNames.length];
    state.ships.push(makeShip(name, i, 2 + i * CONFIG.shipStaggerSec, state.rng));
  }
  state.phase = 'playing';
}

function spawnWisp(state, kind, x, y, isBoss) {
  const w = makeWisp(kind, x, y, state.night, state.rng, isBoss);
  state.wisps.push(w);
  if (isBoss) state.boss = w;
  return w;
}

function spawnFromQueue(state) {
  const kind = state.spawnQueue.shift();
  const top = state.rng.next() < 0.30;
  let x, y;
  if (top) { x = state.rng.range(420, 1180); y = 36; }
  else { x = state.rng.range(1220, 1270); y = state.rng.range(70, 660); }
  spawnWisp(state, kind, x, y, false);
}

// Offer 3 distinct boons never taken before in this run.
export function offerBoons(state) {
  const pool = BOONS.filter((b) => !state.boons.includes(b.id));
  const offered = [];
  const rng = state.rng;
  while (offered.length < 3 && pool.length > 0) {
    const i = rng.int(pool.length);
    offered.push(pool.splice(i, 1)[0]);
  }
  state.boonOffer = offered;
  state.phase = 'boon';
}

export function applyBoon(state, id) {
  const b = BOONS.find((x) => x.id === id);
  if (!b || state.boons.includes(id)) return false;
  state.boons.push(id);
  if (id === 'reserve') state.oil = Math.min(oilMax(state), state.oil + 25);
  state.boonOffer = null;
  return true;
}

function burnWisp(state, w, source) {
  w.dead = true;
  state.burned += 1;
  // Combo: burns within 1.5 s of each other raise the counter.
  if (state.comboTimer > 0) state.combo = Math.min(CONFIG.comboMax, state.combo + 1);
  else state.combo = 1;
  state.comboTimer = CONFIG.comboWindowSec;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  const mult = 1 + state.warmth / 100;
  const gained = Math.round(w.score * state.combo * mult);
  state.score += gained;
  state.oil = Math.min(oilMax(state), state.oil + w.oil);
  state.texts.push({ x: w.x, y: w.y - 14, text: `+${gained} x${state.combo}`, life: 1.1, max: 1.1, color: '#ffe9b0', size: 17 });
  state.events.push({ type: 'burn', x: w.x, y: w.y, combo: state.combo });
  // CHAIN EMBER: spread 15 damage to the nearest wisp within 60 px.
  if (state.boons.includes('chain')) {
    let nearest = null;
    let nd = 60;
    for (const o of state.wisps) {
      if (o.dead || o === w) continue;
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (d < nd) { nd = d; nearest = o; }
    }
    if (nearest && damageWisp(nearest, 15) === 'dead') burnWisp(state, nearest, 'chain');
  }
  // Splitter splits into 2 Motes on burn.
  if (w.kind === 'splitter' && source !== 'chain') {
    spawnWisp(state, 'mote', w.x - 16, w.y - 10, false);
    spawnWisp(state, 'mote', w.x + 16, w.y + 10, false);
  }
  state.shake = Math.min(6, state.shake + 1.5);
}

// The pure fixed-step update. `input` = { aimX, aimY, focus, bell, beamOn }.
// Only runs while phase === 'playing'; screens are set by main.js.
export function stepRun(state, dt, input) {
  if (state.phase !== 'playing') return;
  state.time += dt;
  state.nightTime += dt;
  state.events.length = 0;

  // --- Beam aim + focus ---
  state.beamTarget = angleTo(CONFIG.lamp.x, CONFIG.lamp.y, input.aimX, input.aimY);
  const maxStep = (CONFIG.beamTurnDegPerSec * Math.PI / 180) * dt;
  state.beamAngle = turnToward(state.beamAngle, state.beamTarget, maxStep);
  state.focus = !!input.focus;
  state.beamOn = input.beamOn !== false;

  // --- Oil: drain while shining, refill passively ---
  if (state.beamOn) state.oil -= oilDrainPerSec(state) * dt;
  state.oil += oilRefillPerSec(state) * dt;
  state.oil = Math.max(0, Math.min(oilMax(state), state.oil));

  // --- Bell ---
  if (state.bellCd > 0) state.bellCd -= dt;
  if (input.bell && state.bellCd <= 0) {
    const cd = state.boons.includes('bell') ? 7 : CONFIG.bellCooldownSec;
    state.bellCd = cd;
    const spread = beamSpreadRad(state);
    let hit = 0;
    for (const w of state.wisps) {
      if (w.dead) continue;
      if (inBeam(CONFIG.lamp.x, CONFIG.lamp.y, state.beamAngle, spread, CONFIG.beamRange, w.x, w.y)) {
        w.stunned = CONFIG.bellStunSec;
        hit += 1;
        if (damageWisp(w, CONFIG.bellBurstDamage) === 'dead') burnWisp(state, w, 'bell');
      }
    }
    state.events.push({ type: 'bell', hits: hit });
    state.flash = 0.35;
  }

  // --- Spawning ---
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = spawnInterval(state.night);
      spawnFromQueue(state);
    }
  } else if (!state.bossSpawned && BOSSES[state.night]) {
    // Boss spawns LAST in its night.
    state.bossSpawned = true;
    spawnWisp(state, BOSSES[state.night].key, 1240, 300, true);
    state.events.push({ type: 'boss', name: BOSSES[state.night].name });
  }

  // --- Wisps: burn inside the beam, then drift ---
  const spread = beamSpreadRad(state);
  const dps = burnDps(state);
  if (state.beamOn && state.oil > 0) {
    for (const w of state.wisps) {
      if (w.dead) continue;
      if (inBeam(CONFIG.lamp.x, CONFIG.lamp.y, state.beamAngle, spread, CONFIG.beamRange, w.x, w.y)) {
        if (damageWisp(w, dps * dt) === 'dead') burnWisp(state, w, 'beam');
      }
    }
  }
  const spawnCb = (kind, x, y) => spawnWisp(state, kind, x, y, false);
  for (const w of state.wisps) {
    if (!w.dead) updateWisp(w, dt, state, spawnCb, state.events);
  }
  state.wisps = state.wisps.filter((w) => !w.dead);

  // --- Ships: sail, touch, dock ---
  let anyLit = false;
  for (const s of state.ships) {
    const res = updateShip(s, dt, state, state.beamAngle, spread);
    if (res === 'docked') {
      state.shipsSaved += 1;
      state.shipsSavedTotal += 1;
      state.nightShips += 1;
      state.score += CONFIG.shipDockScore;
      state.oil = Math.min(oilMax(state), state.oil + CONFIG.oilDockBonus);
      state.texts.push({ x: s.x, y: s.y - 30, text: `+${CONFIG.shipDockScore} ${s.name} SAFE`, life: 1.6, max: 1.6, color: '#8dff9e', size: 16 });
      state.events.push({ type: 'dock', x: s.x, y: s.y });
    }
    if (s.lit) anyLit = true;
  }
  // Wisp touches: a wisp reaching a ship in darkness wrecks it.
  for (const w of state.wisps) {
    if (w.dead) continue;
    for (const s of state.ships) {
      if (s.state !== 'sailing' || s.lit) continue;
      const d = Math.hypot(w.x - s.x, w.y - s.y);
      if (d < CONFIG.shipTouchRadius + w.radius) {
        const res = shipTouchWisp(s, state);
        w.dead = true;
        if (res === 'wrecked') {
          state.shipsWrecked += 1;
          state.events.push({ type: 'wreck', x: s.x, y: s.y, name: s.name });
          state.texts.push({ x: s.x, y: s.y - 30, text: `${s.name} WRECKED`, life: 1.8, max: 1.8, color: '#ff7f7f', size: 16 });
          state.shake = Math.min(10, state.shake + 4);
        } else if (res === 'slowed') {
          state.events.push({ type: 'hullhit', x: s.x, y: s.y });
        }
        break;
      }
    }
  }
  state.wisps = state.wisps.filter((w) => !w.dead);

  // --- Warmth: rises while any ship is lit, else falls ---
  state.warmth = Math.max(0, Math.min(CONFIG.warmthMax,
    state.warmth + (anyLit ? CONFIG.warmthRisePerSec : -CONFIG.warmthFallPerSec) * dt));

  // --- Combo decay ---
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // --- Ambient: lightning, particles, texts, shake ---
  state.lightningTimer -= dt;
  if (state.lightningTimer <= 0) {
    state.lightningTimer = 9 + state.rng.range(0, 8);
    state.lightning = 0.22;
  }
  if (state.lightning > 0) state.lightning -= dt;
  if (state.flash > 0) state.flash -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 14);
  updateFx(state, dt);

  // --- Defeat checks ---
  const shipsAlive = state.ships.filter((s) => s.state === 'sailing' || s.state === 'waiting').length;
  const shipsResolved = state.ships.every((s) => s.state === 'docked' || s.state === 'wrecked');
  if (state.oil <= 0 && state.wisps.length > 0) {
    state.phase = 'defeat';
    state.defeatReason = 'The lamp ran dry with wisps still abroad.';
    state.events.push({ type: 'defeat' });
    return;
  }
  if (state.ships.length > 0 && shipsAlive === 0 && state.ships.every((s) => s.state === 'wrecked')) {
    state.phase = 'defeat';
    state.defeatReason = 'Every ship of the night was wrecked in the dark.';
    state.events.push({ type: 'defeat' });
    return;
  }

  // --- Night end: all wisps burned AND all ships resolved ---
  if (state.spawnQueue.length === 0 && state.wisps.length === 0 && shipsResolved) {
    if (state.oil <= 0) state.oil = CONFIG.oilRelight;
    state.score += CONFIG.nightClearScore;
    state.nightClearStats = {
      night: state.night,
      ships: state.nightShips,
      shipsTotal: state.ships.length,
      burned: state.burned,
      score: state.score,
    };
    if (state.night >= CONFIG.nightCount) {
      state.score += Math.round(state.oil) * CONFIG.victoryOilBonusPerOil;
      state.phase = 'victory';
      state.events.push({ type: 'victory' });
    } else {
      state.phase = 'nightclear';
      state.events.push({ type: 'nightclear' });
    }
  }
}

function updateFx(state, dt) {
  // Ember motes drifting inside the beam.
  if (state.beamOn && state.oil > 0 && state.rng.next() < 0.5) {
    const spread = beamSpreadRad(state);
    const a = state.beamAngle + state.rng.range(-spread / 2, spread / 2);
    const d = state.rng.range(80, CONFIG.beamRange);
    state.particles.push({
      x: CONFIG.lamp.x + Math.cos(a) * d,
      y: CONFIG.lamp.y + Math.sin(a) * d,
      vx: state.rng.range(-8, 8), vy: state.rng.range(-22, -6),
      life: 0.9, max: 0.9, size: state.rng.range(1.5, 3.5), color: '#ffd76a', kind: 'ember',
    });
  }
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  for (const t of state.texts) t.life -= dt;
  state.texts = state.texts.filter((t) => t.life > 0);
}

// --- Helpers for the sim and the UI ---

export function scoreMultiplier(state) {
  return 1 + state.warmth / 100;
}

export function bellReady(state) {
  return state.bellCd <= 0;
}

export function boonById(id) {
  return BOONS.find((b) => b.id === id);
}
