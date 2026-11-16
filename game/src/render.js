// EMBERKEEPER — render.js
// ALL canvas drawing: sea, coast, lamp, beam, ships, wisps, HUD, screens.
// Drawing reads only state + simulated time, so ?shot= scenes render
// identically on every capture (SPEC §7).
import { CONFIG, WISP_KINDS, BOSSES, BOONS, PALETTE } from './config.js';
import { beamSpreadRad } from './beam.js';
import { ambientField } from './particles.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align, weight, font) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 'bold'} ${size}px ${font || 'system-ui, sans-serif'}`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function button(ctx, state, id, x, y, w, h, label, opts) {
  const o = opts || {};
  const hover = state.uiMouse && state.uiMouse.x >= x && state.uiMouse.x <= x + w
    && state.uiMouse.y >= y && state.uiMouse.y <= y + h;
  ctx.fillStyle = hover ? '#3a2f10' : (o.fill || 'rgba(20, 28, 52, 0.92)');
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = o.gold ? PALETTE.gold : PALETTE.panelLine;
  ctx.lineWidth = o.gold ? 2.5 : 1.5;
  ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + (o.size || 18) / 3, o.size || 18, o.color || PALETTE.text, 'center');
  state.uiButtons.push({ id, x, y, w, h });
  return hover;
}

function drawSky(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
  // Stars (fixed positions from a tiny hash — deterministic).
  for (let i = 0; i < 90; i++) {
    const sx = (i * 173.3) % 1280;
    const sy = (i * 97.7) % 260;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 0.7 + i));
    ctx.fillStyle = `rgba(220, 235, 255, ${0.25 + 0.5 * tw})`;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  // Moon.
  ctx.fillStyle = '#e8ecf5';
  ctx.beginPath(); ctx.arc(1120, 92, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200, 210, 235, 0.5)';
  ctx.beginPath(); ctx.arc(1108, 84, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1132, 102, 5, 0, Math.PI * 2); ctx.fill();
  // Lightning flash.
  if (state.lightning > 0) {
    ctx.fillStyle = `rgba(190, 210, 255, ${state.lightning * 1.2})`;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = 'rgba(240, 245, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(980, 0); ctx.lineTo(950, 120); ctx.lineTo(975, 130); ctx.lineTo(930, 260);
    ctx.stroke();
  }
}

function drawSea(ctx, state, ambient) {
  const g = ctx.createLinearGradient(0, 240, 0, 720);
  g.addColorStop(0, PALETTE.seaShallow);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 240, 1280, 480);
  // Glowing plankton.
  for (const p of ambient) {
    const tw = 0.35 + 0.4 * Math.abs(Math.sin(state.time * 1.1 + p.tw));
    ctx.fillStyle = p.c;
    ctx.globalAlpha = tw;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Rolling wave lines.
  ctx.strokeStyle = PALETTE.waveLine;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 7; row++) {
    const y0 = 290 + row * 62;
    ctx.globalAlpha = 0.35 + row * 0.05;
    ctx.beginPath();
    for (let x = 240; x <= 1280; x += 16) {
      const y = y0 + Math.sin(x * 0.012 + state.time * (0.9 + row * 0.12) + row * 2.1) * 7;
      if (x === 240) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Rain streaks (deterministic function of simulated time).
  ctx.strokeStyle = 'rgba(170, 200, 240, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const x = ((i * 137.7 + state.time * 260) % 1360) - 40;
    const y = ((i * 89.3 + state.time * 620) % 760) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 16);
  }
  ctx.stroke();
  // Harbour mouth: dock posts + lantern glow, bottom-right.
  ctx.fillStyle = '#241a10';
  ctx.fillRect(1100, 640, 150, 14);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(1112 + i * 42, 618, 10, 36);
  }
  const hg = ctx.createRadialGradient(1170, 648, 4, 1170, 648, 90);
  hg.addColorStop(0, 'rgba(255, 200, 90, 0.55)');
  hg.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(1170, 648, 90, 0, Math.PI * 2); ctx.fill();
  text(ctx, 'HARBOUR', 1170, 700, 13, '#c9a86a', 'center', 'bold');
}

function drawCliffAndLamp(ctx, state) {
  // Cliff rock, left edge.
  ctx.fillStyle = PALETTE.cliff;
  ctx.beginPath();
  ctx.moveTo(0, 720); ctx.lineTo(0, 470);
  ctx.lineTo(60, 452); ctx.lineTo(120, 470); ctx.lineTo(190, 500);
  ctx.lineTo(230, 560); ctx.lineTo(210, 720);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.cliffTop;
  ctx.beginPath();
  ctx.moveTo(0, 470); ctx.lineTo(60, 452); ctx.lineTo(120, 470); ctx.lineTo(190, 500);
  ctx.lineTo(230, 560); ctx.lineTo(210, 575); ctx.lineTo(150, 520); ctx.lineTo(70, 492);
  ctx.closePath(); ctx.fill();
  // Lamp tower.
  const lx = CONFIG.lamp.x;
  const ly = CONFIG.lamp.y;
  ctx.fillStyle = '#2c2118';
  ctx.beginPath();
  ctx.moveTo(lx - 16, ly + 40); ctx.lineTo(lx - 9, ly - 66);
  ctx.lineTo(lx + 9, ly - 66); ctx.lineTo(lx + 16, ly + 40);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a3421';
  ctx.fillRect(lx - 9, ly - 66, 18, 10);
  // Lamp room: the brightest point on the coast.
  const glow = ctx.createRadialGradient(lx, ly - 78, 4, lx, ly - 78, 70);
  glow.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
  glow.addColorStop(0.4, 'rgba(255, 200, 90, 0.45)');
  glow.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(lx, ly - 78, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath(); ctx.arc(lx, ly - 78, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(lx - 15, ly - 96, 30, 6);
  text(ctx, 'EMBERKEEPER LIGHT', lx, ly + 62, 11, '#c9a86a', 'center', 'bold');
}

function drawBeam(ctx, state) {
  if (!state.beamOn || state.oil <= 0) return;
  const lx = CONFIG.lamp.x;
  const ly = CONFIG.lamp.y - 78;
  const spread = beamSpreadRad(state);
  const range = CONFIG.beamRange;
  const a = state.beamAngle;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Wide soft halo.
  const halo = ctx.createRadialGradient(lx, ly, 10, lx, ly, range);
  halo.addColorStop(0, 'rgba(255, 220, 120, 0.30)');
  halo.addColorStop(0.5, 'rgba(255, 190, 70, 0.10)');
  halo.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.arc(lx, ly, range, a - spread / 2, a + spread / 2);
  ctx.closePath(); ctx.fill();
  // Main shaft.
  const grad = ctx.createLinearGradient(lx, ly, lx + Math.cos(a) * range, ly + Math.sin(a) * range);
  grad.addColorStop(0, 'rgba(255, 246, 216, 0.95)');
  grad.addColorStop(0.35, 'rgba(255, 215, 106, 0.55)');
  grad.addColorStop(1, 'rgba(255, 157, 46, 0.06)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.arc(lx, ly, range, a - spread / 2, a + spread / 2);
  ctx.closePath(); ctx.fill();
  // Bright core.
  ctx.fillStyle = 'rgba(255, 250, 225, 0.85)';
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.arc(lx, ly, range, a - spread / 6, a + spread / 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // Focus ring at the lamp when focused.
  if (state.focus) {
    ctx.strokeStyle = 'rgba(255, 230, 150, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lx, ly, 20 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
    text(ctx, 'FOCUS', lx, ly - 104, 12, '#ffe9b0', 'center', 'bold');
  }
}

function drawShip(ctx, s, state) {
  const bob = Math.sin(state.time * 1.4 + s.bobPhase) * 2.5;
  const x = s.x;
  const y = s.y + bob;
  ctx.save();
  if (s.state === 'wrecked') {
    ctx.globalAlpha = Math.max(0, s.wreckTimer / 1.6);
    ctx.translate(x, y + (1.6 - s.wreckTimer) * 14);
    ctx.rotate(0.35);
  } else {
    ctx.translate(x, y);
  }
  if (s.lit) {
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
    g.addColorStop(0, 'rgba(255, 215, 106, 0.5)');
    g.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  }
  // Wake.
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, 8); ctx.lineTo(46, 14); ctx.moveTo(18, 14); ctx.lineTo(40, 22);
  ctx.stroke();
  // Hull.
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath();
  ctx.moveTo(-26, -6); ctx.lineTo(26, -6); ctx.lineTo(18, 10); ctx.lineTo(-18, 10);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-26, -8, 52, 4);
  // Warm windows.
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(-14, -2, 6, 5);
  ctx.fillRect(-2, -2, 6, 5);
  ctx.fillRect(10, -2, 6, 5);
  // Mast + sail.
  ctx.fillStyle = '#3a2415';
  ctx.fillRect(-2, -34, 4, 28);
  ctx.fillStyle = '#f2ead8';
  ctx.beginPath();
  ctx.moveTo(2, -34); ctx.lineTo(2, -10); ctx.lineTo(20, -10);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // Name + LIT tag.
  text(ctx, s.name, x, y - 44, 12, s.lit ? '#ffd76a' : '#9fb2cc', 'center', 'bold');
  if (s.lit) text(ctx, '◆ LIT ◆', x, y - 58, 11, '#ffe9b0', 'center', 'bold');
  if (s.state === 'wrecked') text(ctx, 'WRECKED', x, y - 44, 12, '#ff7f7f', 'center', 'bold');
}

function drawWisp(ctx, w, state) {
  const flick = 0.75 + 0.25 * Math.sin(state.time * 5 + w.wobblePhase);
  const r = w.radius * (w.isBoss ? 1 : 1);
  const g = ctx.createRadialGradient(w.x, w.y, 1, w.x, w.y, r * 2.6);
  g.addColorStop(0, w.core);
  g.addColorStop(0.35, w.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = flick;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w.x, w.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Body.
  ctx.fillStyle = w.color;
  ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = w.core;
  ctx.beginPath(); ctx.arc(w.x, w.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  // Eyes.
  ctx.fillStyle = '#0a0f1e';
  const ex = r * 0.38;
  ctx.beginPath(); ctx.arc(w.x - ex, w.y - 2, Math.max(1.5, r * 0.14), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w.x + ex, w.y - 2, Math.max(1.5, r * 0.14), 0, Math.PI * 2); ctx.fill();
  if (w.isBoss) {
    // Crown / horns.
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w.x - r * 0.8, w.y - r * 0.7);
    ctx.lineTo(w.x - r * 0.4, w.y - r * 1.35);
    ctx.lineTo(w.x, w.y - r * 0.85);
    ctx.lineTo(w.x + r * 0.4, w.y - r * 1.35);
    ctx.lineTo(w.x + r * 0.8, w.y - r * 0.7);
    ctx.stroke();
    text(ctx, w.name.toUpperCase(), w.x, w.y - r - 22, 13, '#ffd76a', 'center', 'bold');
  }
  if (w.stunned > 0) {
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w.x, w.y, r + 6, 0, Math.PI * 2); ctx.stroke();
    text(ctx, '✦', w.x, w.y - r - 8, 13, '#cfe8ff', 'center', 'bold');
  }
  // HP bar for tough wisps / bosses.
  if (w.hp < w.maxHp) {
    const bw = w.isBoss ? 90 : 34;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(w.x - bw / 2, w.y + r + 8, bw, 5);
    ctx.fillStyle = w.isBoss ? '#ff9d5c' : '#8dff9e';
    ctx.fillRect(w.x - bw / 2, w.y + r + 8, bw * Math.max(0, w.hp / w.maxHp), 5);
  }
  ctx.restore();
}

function drawParticles(ctx, state) {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of state.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.max);
    text(ctx, t.text, t.x, t.y - (t.max - t.life) * 30, t.size, t.color, 'center', 'bold');
  }
  ctx.globalAlpha = 1;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, fill, label, valueText) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, x, y, w, h, 5); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    rr(ctx, x, y, Math.max(6, w * Math.min(1, frac)), h, 5); ctx.fill();
  }
  if (label) text(ctx, label, x + 6, y + h - 5, 11, '#0a0f1e', 'left', 'bold');
  if (valueText) text(ctx, valueText, x + w - 6, y + h - 5, 11, '#0a0f1e', 'right', 'bold');
}

function drawHud(ctx, state) {
  // Top-left: night + score.
  panel(ctx, 12, 10, 250, 64);
  text(ctx, `NIGHT ${state.night} / ${CONFIG.nightCount}`, 26, 34, 17, PALETTE.text, 'left', 'bold');
  text(ctx, `SCORE ${state.score.toLocaleString('en-US')}`, 26, 58, 15, PALETTE.gold, 'left', 'bold');
  // Ships saved icons.
  let sx = 26;
  for (const s of state.ships) {
    const col = s.state === 'docked' ? '#8dff9e' : s.state === 'wrecked' ? '#ff5d5d' : '#9fb2cc';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(sx, 66, 4, 0, Math.PI * 2); ctx.fill();
    sx += 14;
  }
  // Top-right: oil + warmth.
  panel(ctx, 1006, 10, 262, 64);
  bar(ctx, 1018, 20, 238, 16, state.oil / (100 + (state.boons.includes('reserve') ? 25 : 0)), state.oil < 25 ? '#ff5d5d' : '#ffb347', 'OIL', `${Math.round(state.oil)}`);
  bar(ctx, 1018, 44, 238, 14, state.warmth / 100, '#ff8fd0', 'WARMTH x' + (1 + state.warmth / 100).toFixed(1), '');
  // Boss HP bar, top-centre.
  if (state.boss && !state.boss.dead && state.phase === 'playing') {
    panel(ctx, 440, 10, 400, 44);
    text(ctx, `☠ ${state.boss.name.toUpperCase()}`, 640, 28, 14, '#ff9d5c', 'center', 'bold');
    bar(ctx, 452, 34, 376, 12, state.boss.hp / state.boss.maxHp, '#ff9d5c', '', `${Math.ceil(state.boss.hp)}`);
  }
  // Bottom-left: combo + bell. Combo sits ABOVE the bell panel so it is
  // never clipped by the canvas bottom edge.
  if (state.combo >= 2) {
    text(ctx, `COMBO x${state.combo}`, 20, 622, 28, '#ffd76a', 'left', 'bold');
  }
  panel(ctx, 12, 630, 240, 56);
  const bellReady = state.bellCd <= 0;
  text(ctx, bellReady ? '♪ BELL READY  [E]' : `♪ BELL ${Math.ceil(state.bellCd)}s`, 24, 656, 15, bellReady ? '#8dff9e' : '#9fb2cc', 'left', 'bold');
  text(ctx, state.focus ? 'FOCUS ×2 BURN' : 'HOLD LMB / SPACE = FOCUS', 24, 676, 12, state.focus ? '#ffd76a' : PALETTE.dimText, 'left', 'bold');
  // Bottom-right: boons + next-night preview.
  panel(ctx, 1006, 580, 262, 130);
  text(ctx, 'BOONS', 1018, 600, 12, PALETTE.gold, 'left', 'bold');
  if (state.boons.length === 0) {
    text(ctx, 'none yet — clear a night', 1018, 620, 12, PALETTE.dimText, 'left');
  } else {
    state.boons.forEach((id, i) => {
      const b = BOONS.find((x) => x.id === id);
      text(ctx, `${b.icon} ${b.name}`, 1018, 620 + i * 14, 11, PALETTE.text, 'left');
    });
  }
  // Next-night preview (computed live by main.js into state._preview):
  // boss name + the three biggest wisp groups, short names, one line.
  if (state._preview) {
    const short = { mote: 'Mote', swift: 'Swift', husk: 'Husk', splitter: 'Split', leech: 'Leech' };
    const top = Object.entries(state._preview.counts)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, c]) => `${c}×${short[k] || k}`)
      .join(' · ');
    const y0 = 620 + state.boons.length * 14 + 8;
    if (state._preview.boss) text(ctx, `BOSS: ${state._preview.boss}`, 1018, y0, 11, '#ff9d5c', 'left', 'bold');
    const label = state.night >= CONFIG.nightCount ? 'FINAL NIGHT' : `NEXT N${state.night + 1}`;
    text(ctx, `${label}: ${top}`, 1018, y0 + (state._preview.boss ? 14 : 0), 10.5, PALETTE.dimText, 'left');
  }
  // Pause / mute buttons (canvas-drawn, click-tested).
  button(ctx, state, 'pause', 1216, 84, 52, 28, '❚❚', { size: 13 });
  button(ctx, state, 'mute', 1216, 116, 52, 28, state.muted ? 'MUTE ✕' : 'SOUND ♪', { size: 11 });
  // Aim hint crosshair at the mouse.
  if (state.uiMouse) {
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.uiMouse.x, state.uiMouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(state.uiMouse.x - 15, state.uiMouse.y); ctx.lineTo(state.uiMouse.x - 6, state.uiMouse.y);
    ctx.moveTo(state.uiMouse.x + 6, state.uiMouse.y); ctx.lineTo(state.uiMouse.x + 15, state.uiMouse.y);
    ctx.moveTo(state.uiMouse.x, state.uiMouse.y - 15); ctx.lineTo(state.uiMouse.x, state.uiMouse.y - 6);
    ctx.moveTo(state.uiMouse.x, state.uiMouse.y + 6); ctx.lineTo(state.uiMouse.x, state.uiMouse.y + 15);
    ctx.stroke();
  }
}

function legendLine(ctx, y, key, desc) {
  text(ctx, key, 300, y, 16, PALETTE.gold, 'left', 'bold');
  text(ctx, desc, 470, y, 16, PALETTE.text, 'left');
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(4, 8, 20, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  text(ctx, 'EMBERKEEPER', 640, 150, 84, '#ffe9b0', 'center', 'bold');
  text(ctx, 'Keep the Last Lamp Burning', 640, 190, 26, PALETTE.gold, 'center');
  text(ctx, 'A lighthouse beam-action game  •  5 nights  •  3 named bosses', 640, 224, 16, PALETTE.dimText, 'center');
  legendLine(ctx, 280, 'GOAL', 'Guide 3 ships home every night — escort them through the beam.');
  legendLine(ctx, 308, 'BEAM', 'Aim with the MOUSE. Wisps burn ONLY inside the beam.');
  legendLine(ctx, 336, 'FOCUS', 'Hold LMB / SPACE: narrower beam, 2× burn, 2× oil drain.');
  legendLine(ctx, 364, 'SHIPS', 'A ship is safe while lit. A wisp touch in darkness wrecks it.');
  legendLine(ctx, 392, 'OIL', 'The beam drinks oil. Burns earn +3 oil. Wisps at the lamp drink it too.');
  legendLine(ctx, 420, 'BELL', 'Press E: stun every wisp in the beam + 60 burst damage.');
  legendLine(ctx, 448, 'WIN / LOSE', 'Win: see the dawn of night 5. Lose: lamp dry, or all ships wrecked.');
  button(ctx, state, 'play', 540, 480, 200, 56, '▶  PLAY', { gold: true, size: 24 });
  button(ctx, state, 'howto', 540, 548, 200, 40, 'HOW TO PLAY', { size: 15 });
  text(ctx, `BEST ${state.bestScore.toLocaleString('en-US')}`, 640, 630, 16, PALETTE.dimText, 'center', 'bold');
  text(ctx, `SEED ${state.seed}`, 640, 654, 13, PALETTE.dimText, 'center');
  text(ctx, 'MOUSE aim   •   HOLD focus   •   E bell   •   P pause   •   M mute', 640, 690, 14, PALETTE.dimText, 'center');
  if (state.showHowTo) {
    ctx.fillStyle = 'rgba(4, 8, 20, 0.88)';
    ctx.fillRect(0, 0, 1280, 720);
    panel(ctx, 340, 110, 600, 470);
    text(ctx, 'HOW TO PLAY', 640, 155, 30, '#ffe9b0', 'center', 'bold');
    const lines = [
      ['1.', 'Move the MOUSE — the great beam follows your cursor.'],
      ['2.', 'Wisps rise from the sea and drift at the lamp or ships.'],      ['3.', 'They burn ONLY inside the beam. Hold LMB / SPACE to FOCUS:'],
      ['    ', 'narrower beam, 2× burn damage, 2× oil drain.'],
      ['4.', 'Burned wisps pay +3 oil and score × your combo (up to x5).'],
      ['5.', 'Ships are safe while the beam touches them (LIT). Docked'],
      ['    ', 'ships pay +500 and +10 oil. Wrecked in darkness, they sink.'],
      ['6.', 'Press E to ring the bell: stun + 60 damage to wisps in beam.'],
      ['7.', 'Between nights pick 1 of 3 boons. Bosses rise on nights 3–5.'],
      ['8.', 'Win by seeing the dawn of night 5. Good luck, Keeper.'],
      ['9.', 'Wisps that reach the lamp CLING to it and drink its oil —'],
      ['    ', 'sweep the beam over the lamp to clear them, or the light dies.'],
    ];
    lines.forEach(([a, b], i) => {
      text(ctx, a, 380, 200 + i * 30, 15, PALETTE.gold, 'left', 'bold');
      text(ctx, b, 410, 200 + i * 30, 15, PALETTE.text, 'left');
    });
    text(ctx, 'WISPS: Ember Mote · Swift Wisp · Husk Wisp · Splitter Wisp · Leech Wisp', 640, 520, 13, PALETTE.dimText, 'center');
    text(ctx, 'BOSSES: Drowned Bell (3) · Storm Wraith (4) · The Squall King (5)', 640, 544, 13, '#ff9d5c', 'center');
    button(ctx, state, 'closehowto', 580, 560, 120, 36, 'CLOSE', { size: 15 });
  }
}

function drawPaused(ctx, state) {
  ctx.fillStyle = 'rgba(4, 8, 20, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  text(ctx, 'PAUSED', 640, 300, 56, '#ffe9b0', 'center', 'bold');
  text(ctx, 'P / Esc to resume  •  R to restart', 640, 340, 16, PALETTE.dimText, 'center');
  button(ctx, state, 'resume', 540, 370, 200, 48, 'RESUME', { gold: true, size: 20 });
  button(ctx, state, 'menu', 540, 430, 200, 48, 'MENU', { size: 18 });
}

function drawBoon(ctx, state) {
  ctx.fillStyle = 'rgba(4, 8, 20, 0.62)';
  ctx.fillRect(0, 0, 1280, 720);
  text(ctx, `NIGHT ${state.night} CLEARED!`, 640, 130, 48, '#8dff9e', 'center', 'bold');
  const cs = state.nightClearStats;
  if (cs) text(ctx, `Ships ${cs.ships}/${cs.shipsTotal}  ·  +1,000 score  ·  Total ${cs.score.toLocaleString('en-US')}`, 640, 168, 18, PALETTE.text, 'center');
  text(ctx, 'CHOOSE A BOON', 640, 230, 30, '#ffe9b0', 'center', 'bold');
  const offer = state.boonOffer || [];
  offer.forEach((b, i) => {
    const x = 300 + i * 240;
    const y = 270;
    panel(ctx, x, y, 220, 180);
    text(ctx, b.icon, x + 110, y + 66, 44, PALETTE.gold, 'center');
    text(ctx, b.name, x + 110, y + 104, 18, PALETTE.text, 'center', 'bold');
    // Wrap the description.
    const words = b.desc.split(' ');
    let line = '';
    let ly = y + 132;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 22) {
        text(ctx, line.trim(), x + 110, ly, 13, PALETTE.dimText, 'center');
        ly += 18; line = w;
      } else line += ' ' + w;
    }
    text(ctx, line.trim(), x + 110, ly, 13, PALETTE.dimText, 'center');
    button(ctx, state, `boon:${b.id}`, x + 50, y + 200, 120, 36, 'TAKE', { size: 15, gold: true });
  });
  text(ctx, 'Boons already taken: ' + (state.boons.map((id) => BOONS.find((b) => b.id === id).name).join(', ') || 'none'), 640, 520, 14, PALETTE.dimText, 'center');
}

function drawNightClear(ctx, state) {
  // Brief banner; main.js auto-advances to the boon draft.
  ctx.fillStyle = 'rgba(4, 8, 20, 0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  const cs = state.nightClearStats;
  text(ctx, `NIGHT ${state.night} CLEARED!`, 640, 320, 56, '#8dff9e', 'center', 'bold');
  if (cs) text(ctx, `Ships ${cs.ships}/${cs.shipsTotal}  ·  Wisps burned ${cs.burned}  ·  +1,000 score`, 640, 362, 20, PALETTE.text, 'center');
  text(ctx, 'The dawn holds… choose your boon.', 640, 400, 16, PALETTE.dimText, 'center');
}

function statBox(ctx, x, y, w, h, label, value, color) {
  panel(ctx, x, y, w, h);
  text(ctx, label, x + w / 2, y + 28, 13, PALETTE.dimText, 'center', 'bold');
  text(ctx, value, x + w / 2, y + 62, 30, color || PALETTE.text, 'center', 'bold');
}

function drawVictory(ctx, state) {
  ctx.fillStyle = 'rgba(20, 16, 4, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  text(ctx, 'DAWN BREAKS', 640, 120, 72, '#ffe9b0', 'center', 'bold');
  text(ctx, 'The last lamp held through all five nights.', 640, 158, 18, PALETTE.gold, 'center');
  text(ctx, state.score.toLocaleString('en-US'), 640, 232, 64, PALETTE.text, 'center', 'bold');
  if (state.score >= state.bestScore && state.score > 0) text(ctx, '★ NEW BEST ★', 640, 268, 20, '#ffd76a', 'center', 'bold');
  const bw = 200;
  statBox(ctx, 180, 300, bw, 90, 'BURNED', String(state.burned), '#ffb347');
  statBox(ctx, 400, 300, bw, 90, 'SHIPS', `${state.shipsSavedTotal}/15`, '#8dff9e');
  statBox(ctx, 620, 300, bw, 90, 'NIGHTS', '5/5', '#7fe7ff');
  statBox(ctx, 840, 300, bw, 90, 'BEST COMBO', `x${state.bestCombo}`, '#ffd76a');
  text(ctx, `SEED ${state.seed}   •   TIME ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, 640, 430, 14, PALETTE.dimText, 'center');
  if (state.lastRuns.length > 0) {
    text(ctx, 'LAST 3 RUNS', 640, 462, 13, PALETTE.dimText, 'center', 'bold');
    state.lastRuns.slice(0, 3).forEach((r, i) => {
      text(ctx, `#${i + 1}  ${r.score.toLocaleString('en-US')}  ·  ships ${r.ships}/15  ·  night ${r.night}`, 640, 484 + i * 20, 13, PALETTE.text, 'center');
    });
  }
  const boonNames = state.boons.map((id) => BOONS.find((b) => b.id === id).name).join(' · ') || 'none';
  text(ctx, `YOUR BOONS: ${boonNames}`, 640, 556, 14, PALETTE.gold, 'center');
  text(ctx, 'Next goal: save all 15 ships', 640, 582, 15, PALETTE.text, 'center', 'bold');
  button(ctx, state, 'again', 380, 610, 180, 48, 'PLAY AGAIN', { gold: true, size: 18 });
  button(ctx, state, 'sameseed', 580, 610, 180, 48, 'SAME SEED', { size: 18 });
  button(ctx, state, 'menu', 780, 610, 180, 48, 'MENU', { size: 18 });
  text(ctx, 'R = restart', 640, 684, 13, PALETTE.dimText, 'center');
}

function drawDefeat(ctx, state) {
  ctx.fillStyle = 'rgba(12, 4, 8, 0.62)';
  ctx.fillRect(0, 0, 1280, 720);
  text(ctx, 'THE LAMP GOES OUT', 640, 190, 60, '#ff7f7f', 'center', 'bold');
  text(ctx, state.defeatReason || 'The night was lost.', 640, 232, 18, PALETTE.text, 'center');
  statBox(ctx, 280, 280, 200, 90, 'NIGHT REACHED', `${state.night} / 5`, '#ff9d5c');
  statBox(ctx, 520, 280, 200, 90, 'SHIPS SAVED', `${state.shipsSavedTotal} / 15`, '#8dff9e');
  statBox(ctx, 760, 280, 200, 90, 'SCORE', state.score.toLocaleString('en-US'), PALETTE.text);
  text(ctx, `Wisps burned ${state.burned}  •  Best combo x${state.bestCombo}  •  Seed ${state.seed}`, 640, 420, 15, PALETTE.dimText, 'center');
  button(ctx, state, 'again', 470, 460, 170, 52, 'TRY AGAIN', { gold: true, size: 20 });
  button(ctx, state, 'menu', 660, 460, 170, 52, 'MENU', { size: 20 });
  text(ctx, 'R = restart', 640, 540, 13, PALETTE.dimText, 'center');
}

// Main entry: draws the whole frame for the current phase.
export function render(ctx, state, ui) {
  const W = CONFIG.canvasW;
  const H = CONFIG.canvasH;
  state.uiButtons = [];
  state.uiMouse = ui && ui.mouse ? ui.mouse : null;
  if (ui && ui.ambient) state._ambient = ui.ambient;
  const ambient = state._ambient || [];
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.sin(state.time * 47) * state.shake), (Math.cos(state.time * 39) * state.shake));
  }
  drawSky(ctx, state);
  drawSea(ctx, state, ambient);
  drawCliffAndLamp(ctx, state);
  drawBeam(ctx, state);
  for (const s of state.ships) {
    if (s.state === 'waiting') continue;
    drawShip(ctx, s, state);
  }
  for (const w of state.wisps) drawWisp(ctx, w, state);
  drawParticles(ctx, state);
  // Flash overlay (bell).
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 190, ${state.flash * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  if (state.phase === 'playing' || state.phase === 'paused') drawHud(ctx, state);
  if (state.phase === 'title') drawTitle(ctx, state);
  if (state.phase === 'paused') drawPaused(ctx, state);
  if (state.phase === 'boon') drawBoon(ctx, state);
  if (state.phase === 'nightclear') drawNightClear(ctx, state);
  if (state.phase === 'victory') drawVictory(ctx, state);
  if (state.phase === 'defeat') drawDefeat(ctx, state);
}
