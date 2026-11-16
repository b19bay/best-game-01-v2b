// EMBERKEEPER — shots.js
// Deterministic ?shot= scenes (SPEC §7). Each scene builds a fixed state
// from the seeded run, places wisps/ships/particles by hand, renders one
// frame at a FIXED simulated time, and sets window.__shotReady = true.
// No wall clock anywhere — the same query always renders the same pixels.
import { CONFIG, WISP_KINDS } from './config.js';
import { createRun, startNight, previewNight } from './nights.js';
import { makeWisp } from './wisps.js';
import { makeShip } from './ships.js';
import { spawnBurst, spawnText } from './particles.js';

function baseState(seed, night) {
  const state = createRun(seed);
  state.time = 42.5; // fixed simulated time for every shot
  state.nightTime = 38.0;
  startNight(state, night);
  state._preview = previewNight(seed, night + 1 <= 5 ? night + 1 : 5);
  return state;
}

function placeWisp(state, kind, x, y, hpFrac) {
  const w = makeWisp(kind, x, y, state.night, state.rng, false);
  if (hpFrac !== undefined) w.hp = w.maxHp * hpFrac;
  state.wisps.push(w);
  return w;
}

function placeShip(state, name, lane, x, y, lit) {
  const s = makeShip(name, lane, 0, state.rng);
  s.state = 'sailing';
  s.x = x; s.y = y;
  s.lit = lit;
  state.ships.push(s);
  return s;
}

// play: mid-night combat, night 4 — the COVER (SPEC §7, shot 1).
export function scenePlay(seed) {
  const state = baseState(seed, 4);
  state.score = 12840;
  state.oil = 62;
  state.warmth = 68;
  state.combo = 3;
  state.comboTimer = 1.2;
  state.bestCombo = 4;
  state.burned = 27;
  state.bellCd = 0;
  state.boons = ['hot', 'wide'];
  state.beamAngle = -0.12; // sweeping right across the sea
  state.beamTarget = -0.12;
  state.focus = false;
  state.ships = [];
  // SALTIRE sits inside the beam (LIT); GULLWING is above the beam in
  // the dark with a Swift Wisp closing on it (in danger).
  placeShip(state, 'SALTIRE', 0, 760, 350, true);
  placeShip(state, 'GULLWING', 1, 1000, 180, false);
  state.spawnQueue = [];
  // 9 wisps of 4 kinds, several inside the beam cone.
  placeWisp(state, 'mote', 700, 380, 0.6);
  placeWisp(state, 'mote', 830, 390, 0.4);
  placeWisp(state, 'swift', 950, 430, 0.7);
  placeWisp(state, 'swift', 1080, 380, 1);
  placeWisp(state, 'husk', 880, 560, 0.8);
  placeWisp(state, 'splitter', 620, 560, 0.5);
  placeWisp(state, 'mote', 1120, 560, 1);
  placeWisp(state, 'swift', 560, 300, 1);
  placeWisp(state, 'husk', 1180, 220, 0.9);
  placeWisp(state, 'swift', 960, 230, 1);
  spawnBurst(state, 830, 390, '#ffd76a', 14, 60, 1.0, 3);
  spawnBurst(state, 700, 380, '#ffb347', 10, 50, 0.9, 2.5);
  spawnText(state, 830, 370, '+75 x3', '#ffe9b0', 18);
  spawnText(state, 700, 360, '+50 x2', '#ffe9b0', 16);
  state.phase = 'playing';
  return state;
}

// title: title screen over a living coast backdrop.
export function sceneTitle(seed) {
  const state = baseState(seed, 1);
  state.bestScore = 18420;
  state.beamAngle = 0.18;
  state.beamTarget = 0.18;
  state.ships = [];
  placeShip(state, 'SALTIRE', 1, 900, 330, true);
  state.spawnQueue = [];
  placeWisp(state, 'mote', 700, 300, 1);
  placeWisp(state, 'swift', 1000, 220, 1);
  placeWisp(state, 'mote', 1150, 480, 1);
  state.phase = 'title';
  return state;
}

// boss: night 5, The Squall King in the beam with its HP bar.
export function sceneBoss(seed) {
  const state = baseState(seed, 5);
  state.score = 31200;
  state.oil = 48;
  state.warmth = 55;
  state.combo = 2;
  state.comboTimer = 0.9;
  state.bestCombo = 5;
  state.burned = 61;
  state.bellCd = 4.5;
  state.boons = ['hot', 'wide', 'bell', 'steady'];
  state.beamAngle = 0.08;
  state.beamTarget = 0.08;
  state.ships = [];
  // KESTREL rides inside the beam (LIT); MERIDIAN is above the beam in
  // the dark with a Swift Wisp closing on it.
  placeShip(state, 'KESTREL', 0, 820, 480, true);
  placeShip(state, 'MERIDIAN', 2, 1080, 190, false);
  state.spawnQueue = [];
  const boss = makeWisp('king', 980, 500, 5, state.rng, true);
  boss.hp = boss.maxHp * 0.62;
  state.wisps.push(boss);
  state.boss = boss;
  state.bossSpawned = true;
  placeWisp(state, 'swift', 880, 260, 0.8);
  placeWisp(state, 'swift', 1080, 400, 0.6);
  placeWisp(state, 'mote', 760, 420, 1);
  placeWisp(state, 'mote', 1160, 300, 1);
  placeWisp(state, 'swift', 700, 560, 1);
  placeWisp(state, 'swift', 1040, 240, 1);
  spawnBurst(state, 980, 500, '#ff9d5c', 22, 80, 1.2, 3.5);
  spawnText(state, 980, 420, '+150 x2', '#ffe9b0', 18);
  state.phase = 'playing';
  return state;
}

// victory: DAWN BREAKS results screen.
export function sceneVictory(seed) {
  const state = baseState(seed, 5);
  state.score = 48750;
  state.bestScore = 48750;
  state.burned = 96;
  state.shipsSavedTotal = 13;
  state.bestCombo = 5;
  state.time = 742.0;
  state.boons = ['hot', 'wide', 'bell'];
  state.lastRuns = [
    { score: 31200, ships: 11, night: 5 },
    { score: 18420, ships: 9, night: 4 },
    { score: 9800, ships: 7, night: 3 },
  ];
  state.ships = [];
  state.wisps = [];
  state.spawnQueue = [];
  state.phase = 'victory';
  return state;
}

export const SCENES = {
  play: scenePlay,
  title: sceneTitle,
  boss: sceneBoss,
  victory: sceneVictory,
};
