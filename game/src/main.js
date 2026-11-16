// EMBERKEEPER — main.js
// Browser wiring: fixed 1/60 s loop, state machine, UI clicks, audio cues,
// localStorage best score, and the documented test hook
// window.__emberkeeper (SPEC §11.5). Game logic lives in the pure modules.
import { CONFIG } from './config.js';
import { createRun, startNight, stepRun, offerBoons, applyBoon, previewNight } from './nights.js';
import { createInput, focusHeld, pointInRect, consumePressed } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { SCENES } from './shots.js';
import { ambientField } from './particles.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '1', 10);
const shotParam = params.get('shot');
const input = createInput(canvas);
const audio = createAudio();
const ambient = ambientField(seedParam || 1, 70);

let seedCounter = 0;
function freshSeed() {
  seedCounter += 1;
  // Fresh seed for a new human run (wall clock only picks the seed; the
  // run itself is fully deterministic from it — no unseeded randomness
  // anywhere).
  return ((performance.now() * 1000) | 0) ^ Math.imul(seedCounter, 2654435761) ^ 0x5eed;
}

let state = createRun(Number.isFinite(seedParam) ? seedParam : 1);
state.bestScore = loadBest();
state.lastRuns = loadRuns();
state._preview = previewNight(state.seed, 2);

let screenTimer = 0; // wall-clock timer for screen transitions (UI only)
let bellQueued = false;

function loadBest() {
  try { return parseInt(window.localStorage.getItem('emberkeeper.best') || '0', 10) || 0; }
  catch (e) { return 0; }
}
function loadRuns() {
  try { return JSON.parse(window.localStorage.getItem('emberkeeper.runs') || '[]'); }
  catch (e) { return []; }
}
function saveRun() {
  try {
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      window.localStorage.setItem('emberkeeper.best', String(state.bestScore));
    }
    const runs = [{ score: state.score, ships: state.shipsSavedTotal, night: state.night }, ...state.lastRuns].slice(0, 3);
    state.lastRuns = runs;
    window.localStorage.setItem('emberkeeper.runs', JSON.stringify(runs));
  } catch (e) { /* storage unavailable — the run still counts */ }
}

function startNewRun(seed) {
  const best = state.bestScore;
  const runs = state.lastRuns;
  state = createRun(seed);
  state.bestScore = best;
  state.lastRuns = runs;
  state._preview = previewNight(seed, 2);
  startNight(state, 1);
  audio.ensure();
  audio.startMusic();
}

function playEvents() {
  for (const ev of state.events) {
    if (ev.type === 'burn') audio.burn(ev.combo || 1);
    else if (ev.type === 'bell') audio.bell();
    else if (ev.type === 'dock') audio.dock();
    else if (ev.type === 'wreck') audio.wreck();
    else if (ev.type === 'nightclear') audio.nightclear();
    else if (ev.type === 'victory') { audio.victory(); saveRun(); }
    else if (ev.type === 'defeat') { audio.defeat(); saveRun(); }
    else if (ev.type === 'boss') audio.boss();
  }
  state.events.length = 0;
}

function handleClick() {
  const c = input.clicked;
  if (!c) return;
  input.clicked = null;
  for (const b of state.uiButtons) {
    if (!pointInRect(c.x, c.y, b)) continue;
    audio.ensure();
    audio.click();
    if (b.id === 'play') { startNewRun(state.seed); return; }
    if (b.id === 'howto') { state.showHowTo = true; return; }
    if (b.id === 'closehowto') { state.showHowTo = false; return; }
    if (b.id === 'pause') { togglePause(); return; }
    if (b.id === 'resume') { state.phase = 'playing'; return; }
    if (b.id === 'mute') { toggleMute(); return; }
    if (b.id === 'menu') { toTitle(); return; }
    if (b.id === 'again') { startNewRun(freshSeed()); return; }
    if (b.id === 'sameseed') { startNewRun(state.seed); return; }
    if (b.id.startsWith('boon:')) {
      if (applyBoon(state, b.id.slice(5))) {
        state._preview = previewNight(state.seed, state.night + 1);
        startNight(state, state.night + 1);
      }
      return;
    }
  }
}

function togglePause() {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
}

function toggleMute() {
  state.muted = !state.muted;
  audio.setMuted(state.muted);
}

function toTitle() {
  const best = state.bestScore;
  const runs = state.lastRuns;
  state = createRun(state.seed);
  state.bestScore = best;
  state.lastRuns = runs;
  state._preview = previewNight(state.seed, 2);
  state.phase = 'title';
}

// Edge-triggered keys come from the input event queue (see input.js):
// a tap is never lost between frames. Returns nothing; E sets the bell
// flag consumed by the next fixed step.
function handleKeys() {
  for (const code of consumePressed(input)) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyE') bellQueued = true;
    else if (code === 'KeyR') {
      if (state.phase === 'victory' || state.phase === 'defeat' || state.phase === 'title') {
        startNewRun(freshSeed());
      }
    } else if (code === 'Escape') {
      if (state.phase === 'playing' || state.phase === 'paused') togglePause();
      else if (state.showHowTo) state.showHowTo = false;
    }
  }
}

// --- Shot mode: one deterministic frame, then signal readiness ---
if (shotParam && SCENES[shotParam]) {
  const shotState = SCENES[shotParam](Number.isFinite(seedParam) ? seedParam : 1);
  shotState.bestScore = 18420;
  shotState.muted = true;
  render(ctx, shotState, { mouse: { x: 900, y: 300 }, ambient });
  window.__shotReady = true;
  window.__emberkeeper = {
    getState() { return shotState; },
    debugJumpToNight() {},
    debugSetOil() {},
  };
} else {
  // --- Live game loop: fixed 1/60 s steps, render every frame ---
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const dtMs = Math.min(100, now - last);
    last = now;
    acc += dtMs / 1000;
    handleKeys();
    handleClick();
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (state.phase === 'playing') {
        const bellPressed = bellQueued;
        bellQueued = false;
        stepRun(state, STEP, {
          aimX: input.mouseX,
          aimY: input.mouseY,
          focus: focusHeld(input),
          bell: bellPressed,
          beamOn: true,
        });
        playEvents();
        if (state.phase === 'nightclear') screenTimer = 0;
      }
      acc -= STEP;
      steps += 1;
    }
    if (acc > STEP * 5) acc = 0; // drop backlog after a hitch, never spiral
    // Night-clear banner auto-advances to the boon draft.
    if (state.phase === 'nightclear') {
      screenTimer += dtMs / 1000;
      if (screenTimer > 2.4) offerBoons(state);
    }
    render(ctx, state, { mouse: { x: input.mouseX, y: input.mouseY }, ambient });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Documented test hook for the play-test (SPEC §11.5). Not linked from
  // any UI; the game never reads it during normal play.
  window.__emberkeeper = {
    getState() {
      return {
        phase: state.phase,
        night: state.night,
        score: state.score,
        oil: state.oil,
        time: Math.round(state.time * 10) / 10,
        shipsSaved: state.shipsSavedTotal,
        shipsWrecked: state.shipsWrecked,
        burned: state.burned,
        combo: state.combo,
        wisps: state.wisps.length,
        wisp0: state.wisps[0] ? { x: Math.round(state.wisps[0].x), y: Math.round(state.wisps[0].y) } : null,
        ships: state.ships.map((s) => ({ name: s.name, state: s.state, x: Math.round(s.x), y: Math.round(s.y) })),
      };
    },
    debugJumpToNight(n) {
      if (n >= 1 && n <= 5) startNight(state, n);
    },
    debugSetOil(n) { state.oil = n; },
  };
}
