// EMBERKEEPER — config.js
// ALL tuning constants live here. The balance sim (research folder) imports
// this file and the pure logic modules; change ONE constant at a time and
// re-run the sim (SPEC §6).
export const CONFIG = {
  canvasW: 1280,
  canvasH: 720,
  // Lamp position (cliff, left side) and harbour mouth (bottom-right).
  lamp: { x: 118, y: 512 },
  harbour: { x: 1170, y: 648 },
  // Beam
  beamRange: 1150,
  beamSpreadDeg: 15, // total spread, normal — narrowed from 26° in two
  // steps: the whole sea as seen from the lamp spans only ~30°, so a
  // wide beam covered nearly every approach and a fixed beam won on its
  // own (sim gate b). 15° still reads as a great shaft, but the top
  // and bottom lanes pass outside it and must be actively covered.
  beamFocusSpreadDeg: 7, // total spread, focused
  beamTurnDegPerSec: 240,
  burnDps: 30, // normal burn damage per second inside the beam
  burnFocusMult: 2,
  oilDrainPerSec: 2,
  oilFocusMult: 1.75, // focused drain multiplier — cheaper than 2× so an
  // active player who focuses well is not punished out of oil.
  oilPassivePerSec: 0.9, // tuned down from 1.2: a fixed beam must not pay
  // for itself on burn rewards alone (sim gate b).
  oilBurnReward: 3,
  oilMax: 100,
  oilStart: 75,
  oilRelight: 25, // oil when a night ends with a clear sea
  oilDockBonus: 10,
  // A wisp that reaches the lamp's glow clings to it and drinks oil
  // (see wisps.js): the lamp is attacked by accumulation, not by one
  // burst. A fixed beam leaves the clinging wisps outside its cone
  // alive, so the lamp runs dry — an active keeper sweeps the beam
  // over the lamp's edge to clear them (sim gate b).
  lampHoverRadius: 380,
  hoverDrainPerSec: 2.5,
  leechHoverDrainPerSec: 4,
  // the lamp is the thing being attacked, so a wisp slipping through
  // the beam and striking it must hurt. (Sim gate b: a fixed beam lets
  // enough wisps through that the lamp runs dry by night 2–3.)
  // Ships
  shipSpeed: 26, // px/s toward the harbour
  shipStaggerSec: 6,
  shipDockScore: 500,
  shipNames: ['SALTIRE', 'GULLWING', 'KESTREL', 'MERIDIAN'],
  shipLanesY: [168, 322, 476, 610],
  shipTouchRadius: 20,
  // Combo
  comboWindowSec: 1.5,
  comboMax: 5,
  // Bell
  bellCooldownSec: 12,
  bellStunSec: 3,
  bellBurstDamage: 60,
  // Nights
  nightCount: 5,
  nightClearScore: 1000,
  spawnIntervalStart: 1.2, // night 1, shrinks 0.1/night, floor 0.8
  spawnIntervalFloor: 0.8,
  // Wisp HP multiplier (tuning lever): 1.25 makes the fixed beam kill
  // noticeably slower — idle nights run longer, more wisps slip through
  // to the lamp — while an active player bursts clusters with the bell
  // and focus and barely notices the extra HP.
  wispHpMult: 1.25,
  // Warmth: rises while a ship is lit, fuels the score multiplier.
  warmthRisePerSec: 6,
  warmthFallPerSec: 3,
  warmthMax: 100,
  // Score
  victoryOilBonusPerOil: 10,
};

// Wisp kinds. HP scales with night: HP * (1 + 0.10 * (night - 1)).
export const WISP_KINDS = {
  mote: { name: 'Ember Mote', hp: 30, speed: 34, oil: 3, score: 25, color: '#ffb347', core: '#ffe9b0', radius: 11, cost: 2 },
  swift: { name: 'Swift Wisp', hp: 25, speed: 54, oil: 3, score: 30, color: '#7fe7ff', core: '#dffaff', radius: 9, cost: 3 },
  husk: { name: 'Husk Wisp', hp: 80, speed: 26, oil: 4, score: 40, color: '#b78cff', core: '#e6d6ff', radius: 15, cost: 4 },
  splitter: { name: 'Splitter Wisp', hp: 50, speed: 40, oil: 3, score: 35, color: '#8dff9e', core: '#dcffdd', radius: 13, cost: 4 },
  leech: { name: 'Leech Wisp', hp: 60, speed: 44, oil: 5, score: 50, color: '#ff7f9e', core: '#ffd3de', radius: 12, cost: 5 },
};

export const WISP_UNLOCKS = {
  mote: 1,
  swift: 2,
  husk: 2,
  splitter: 3,
  leech: 4,
};

// Bosses: one per night 3, 4, 5. Spawned LAST in their night.
export const BOSSES = {
  3: { key: 'bell', name: 'Drowned Bell', hp: 800, speed: 22, oil: 20, score: 500, color: '#c9a86a', core: '#fff3c4', radius: 34 },
  4: { key: 'wraith', name: 'Storm Wraith', hp: 1200, speed: 30, oil: 25, score: 750, color: '#9db8ff', core: '#e8efff', radius: 38 },
  5: { key: 'king', name: 'The Squall King', hp: 2000, speed: 24, oil: 40, score: 1200, color: '#ff9d5c', core: '#ffe0b8', radius: 46 },
};

// Boons offered between nights (pick 1 of 3, never the same twice in a run).
export const BOONS = [
  { id: 'wide', name: 'WIDE LAMP', desc: 'Beam spread +6 degrees', icon: '◐' },
  { id: 'hot', name: 'HOT COAL', desc: 'Burn damage +25%', icon: '▲' },
  { id: 'reserve', name: 'DEEP RESERVE', desc: 'Oil max +25 and +25 oil now', icon: '◆' },
  { id: 'bell', name: 'SWIFT BELL', desc: 'Bell cooldown 12s → 7s', icon: '♪' },
  { id: 'chain', name: 'CHAIN EMBER', desc: 'A burn spreads 15 damage to the nearest wisp within 60 px', icon: '✦' },
  { id: 'steady', name: 'STEADY FLAME', desc: 'Passive oil refill +0.8/s', icon: '●' },
  { id: 'hull', name: 'IRON HULL', desc: 'Ships take 2 wisp touches before wrecking', icon: '▣' },
  { id: 'long', name: 'LONG NIGHT', desc: '+1 ship per night (4 ships, more score)', icon: '✚' },
];

export const PALETTE = {
  skyTop: '#060a1e',
  skyMid: '#0a1430',
  seaDeep: '#071224',
  seaShallow: '#0d2a4a',
  waveLine: '#1d4d7a',
  cliff: '#1a2233',
  cliffTop: '#2b3a52',
  beamCore: '#fff6d8',
  beamMid: '#ffd76a',
  beamEdge: '#ff9d2e',
  gold: '#ffc94d',
  text: '#f2ead8',
  dimText: '#9fb2cc',
  danger: '#ff5d5d',
  panel: 'rgba(8, 16, 36, 0.82)',
  panelLine: '#2c4a72',
};
