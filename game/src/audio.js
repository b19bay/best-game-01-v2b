// EMBERKEEPER — audio.js
// WebAudio SFX + ambient music, all synthesised (no audio files, no
// network). Created lazily on the first user gesture; M toggles mute.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    musicNodes: null,
    ensure() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, lowpass) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      // Deterministic noise from a tiny LCG (no unseeded randomness anywhere
      // in the game, so the sim and the gate stay clean — SPEC §11.3).
      let s = (this._noiseSeed = ((this._noiseSeed || 12345) * 1103515245 + 12345) >>> 0);
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) >>> 0;
        data[i] = ((s >>> 8) / 8388608 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },
    burn(combo) {
      this.tone(520 + combo * 60, 0.12, 'sawtooth', 0.10, 180);
      this.noise(0.08, 0.08, 2400);
    },
    bell() {
      this.tone(660, 0.9, 'sine', 0.22);
      this.tone(990, 0.7, 'sine', 0.14);
      this.tone(1320, 0.5, 'sine', 0.08);
    },
    dock() { this.tone(523, 0.18, 'triangle', 0.2); this.tone(784, 0.3, 'triangle', 0.18); },
    wreck() { this.tone(140, 0.6, 'sawtooth', 0.2, 55); this.noise(0.4, 0.16, 500); },
    click() { this.tone(880, 0.06, 'square', 0.08); },
    nightclear() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => this.tone(f, 0.35, 'triangle', 0.16), i * 110);
      });
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        setTimeout(() => this.tone(f, 0.5, 'triangle', 0.16), i * 140);
      });
    },
    defeat() { this.tone(220, 1.2, 'sawtooth', 0.14, 55); },
    boss() { this.tone(98, 0.9, 'sawtooth', 0.18, 49); this.tone(147, 0.9, 'sawtooth', 0.10, 73); },
    // Slow ambient pad: two detuned sines + a low swell, looped by LFO.
    startMusic() {
      if (!this.ctx || this.musicNodes || this.muted) return;
      try {
        const g = this.ctx.createGain();
        g.gain.value = 0.05;
        g.connect(this.master);
        const o1 = this.ctx.createOscillator();
        o1.type = 'sine'; o1.frequency.value = 110;
        const o2 = this.ctx.createOscillator();
        o2.type = 'sine'; o2.frequency.value = 164.81;
        const o3 = this.ctx.createOscillator();
        o3.type = 'triangle'; o3.frequency.value = 55;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.025;
        lfo.connect(lfoGain); lfoGain.connect(g.gain);
        o1.connect(g); o2.connect(g); o3.connect(g);
        o1.start(); o2.start(); o3.start(); lfo.start();
        this.musicNodes = { g, o1, o2, o3, lfo };
      } catch (e) { this.musicNodes = null; }
    },
  };
  return audio;
}
