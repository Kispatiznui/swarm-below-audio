import { SCALES, midiToFreq, clamp01 } from "./utils.js";

export class AudioMusic {
  constructor(context, destination) {
    this.context = context;
    this.destination = destination;

    this.root = 45; // A2
    this.scaleName = "minor";
    this.scale = SCALES.minor;

    this.mood = { valence: 0.2, arousal: 0.2, tension: 0.1 };

    this.out = context.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(destination);

    this.reverb = this._makeReverb(3.2, 2.5);
    this.reverbGain = context.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.out);

    this.running = false;
    this.nextNoteTime = 0;
    this.step = 0;
    this.bpm = 60;
    this.chordIndex = 0;
    this.chordNotes = [];
    this.timer = null;

    this._buildPad();
    this._buildMelodyBus();
    this._buildHeartbeat();
  }

  _makeReverb(seconds = 3, decay = 2.5) {
    const rate = this.context.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.context.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    const conv = this.context.createConvolver();
    conv.buffer = impulse;
    return conv;
  }

  _buildPad() {
    this.padVoices = [];
    for (let i = 0; i < 4; i++) {
      const osc = this.context.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.detune.value = (i - 1.5) * 6;

      const g = this.context.createGain();
      g.gain.value = 0.0001;

      const filt = this.context.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 800;
      filt.Q.value = 0.6;

      osc.connect(g);
      g.connect(filt);
      filt.connect(this.out);
      filt.connect(this.reverb);

      osc.start();
      this.padVoices.push({ osc, gain: g, filt });
    }
  }

  _buildMelodyBus() {
    this.melodyGain = this.context.createGain();
    this.melodyGain.gain.value = 0.0001;
    this.melodyGain.connect(this.out);
    this.melodyGain.connect(this.reverb);
  }

  _buildHeartbeat() {
    this.heartGain = this.context.createGain();
    this.heartGain.gain.value = 0;
    this.heartGain.connect(this.out);
  }

  _pickProgression() {
    const { valence, tension } = this.mood;
    if (valence > 0.4) return [0, 4, 5, 3];
    if (tension > 0.6) return [0, 1, 5, 6];
    if (valence < -0.3) return [0, 5, 3, 4];
    return [0, 3, 4, 0];
  }

  _chordFromDegree(degree) {
    const { root, scale } = this;
    const len = scale.length;
    const notes = [];
    for (let i = 0; i < 3; i++) {
      const idx = (degree + i * 2) % len;
      const octave = Math.floor((degree + i * 2) / len) * 12;
      notes.push(root + scale[idx] + octave);
    }
    return notes;
  }

  _updateChord() {
    const prog = this._pickProgression();
    const degree = prog[this.chordIndex % prog.length];
    this.chordNotes = this._chordFromDegree(degree);

    const t = this.context.currentTime;
    const padLevel = 0.05 + this.mood.valence * 0.02 + (1 - this.mood.tension) * 0.03;

    this.padVoices.forEach((v, i) => {
      const midi = this.chordNotes[i % this.chordNotes.length] + (i === 3 ? -12 : 0);
      v.osc.frequency.setTargetAtTime(midiToFreq(midi), t, 0.8);
      v.gain.gain.setTargetAtTime(padLevel / 4, t, 1.5);
      v.filt.frequency.setTargetAtTime(
        400 + (1 - this.mood.tension) * 900 + this.mood.arousal * 600,
        t, 1.2
      );
    });

    this.chordIndex++;
  }

  _scheduleMelodyNote(time) {
    const density = 0.15 + this.mood.arousal * 0.5 + this.mood.tension * 0.2;
    if (Math.random() > density) return;

    const { root, scale } = this;
    const octave = 12 * (1 + Math.floor(Math.random() * 2));
    const degree = Math.floor(Math.random() * scale.length);
    const midi = root + 24 + octave + scale[degree];

    const dur = 0.4 + (1 - this.mood.arousal) * 1.8 + Math.random() * 0.5;

    const osc = this.context.createOscillator();
    osc.type = this.mood.valence > 0 ? "sine" : "triangle";
    osc.frequency.value = midiToFreq(midi);

    const g = this.context.createGain();
    const peak = 0.02 + this.mood.arousal * 0.025;

    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(g);
    g.connect(this.melodyGain);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  _heartbeat(time) {
    const intensity = this.mood.tension * 0.6 + this.mood.arousal * 0.4;
    if (intensity < 0.25) return;

    [0, 0.14].forEach((offset, i) => {
      const osc = this.context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, time + offset);
      osc.frequency.exponentialRampToValueAtTime(35, time + offset + 0.18);

      const g = this.context.createGain();
      const peak = 0.05 * intensity * (i === 0 ? 1 : 0.7);
      g.gain.setValueAtTime(0.0001, time + offset);
      g.gain.exponentialRampToValueAtTime(peak, time + offset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.25);

      osc.connect(g);
      g.connect(this.heartGain);

      osc.start(time + offset);
      osc.stop(time + offset + 0.3);
    });
  }

  setMood(mood) {
    this.mood = { ...this.mood, ...mood };

    if (this.mood.valence > 0.5) this.scaleName = "lydian";
    else if (this.mood.tension > 0.7) this.scaleName = "phrygian";
    else if (this.mood.valence < -0.5) this.scaleName = "minor";
    else this.scaleName = "dorian";
    this.scale = SCALES[this.scaleName];

    this.bpm = 45 + this.mood.arousal * 55;
  }

  setIntensity(v) {
    const i = clamp01(v);
    this.setMood({
      valence: 0.3 - i * 0.6,
      arousal: i,
      tension: i * 0.8
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextNoteTime = this.context.currentTime + 0.1;
    this.step = 0;
    this.out.gain.setTargetAtTime(0.6, this.context.currentTime, 1.5);
    this._tick();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.out.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.3);
  }

  _tick() {
    if (!this.running) return;

    const now = this.context.currentTime;
    const beatDur = 60 / this.bpm;

    while (this.nextNoteTime < now + 0.5) {
      if (this.step % 2 === 0) this._updateChord();
      this._scheduleMelodyNote(this.nextNoteTime);
      if (this.step % 4 === 0) this._heartbeat(this.nextNoteTime);

      this.nextNoteTime += beatDur;
      this.step++;
    }

    this.timer = setTimeout(() => this._tick(), 100);
  }

  destroy() {
    this.stop();
    this.padVoices.forEach(v => {
      try { v.osc.stop(); } catch {}
      try { v.osc.disconnect(); } catch {}
      try { v.gain.disconnect(); } catch {}
      try { v.filt.disconnect(); } catch {}
    });
    try { this.reverb.disconnect(); } catch {}
    try { this.reverbGain.disconnect(); } catch {}
    try { this.melodyGain.disconnect(); } catch {}
    try { this.heartGain.disconnect(); } catch {}
    try { this.out.disconnect(); } catch {}
  }
}