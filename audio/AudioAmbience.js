import { TAU, clamp01, smoothstep } from "./utils.js";
import { SeededRandom } from "./SeededRandom.js";

export class AudioAmbience {
  constructor(context, destination) {
    this.context = context;
    this.destination = destination;

    this.running = false;
    this.intensity = 0;
    this.targetIntensity = 0;
    this.raf = null;

    this.nodes = [];
    this.telemetry = { sub: 0, body: 0, water: 0, resonance: 0, life: 0 };

    this._build();
  }

  _gain(value = 0) {
    const node = this.context.createGain();
    node.gain.value = value;
    this.nodes.push(node);
    return node;
  }

  _filter(type, frequency, q = 0.0001) {
    const node = this.context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    this.nodes.push(node);
    return node;
  }

  _osc(type, frequency) {
    const node = this.context.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    this.nodes.push(node);
    return node;
  }

  _lfo(frequency, depth, targetParam) {
    const osc = this._osc("sine", frequency);
    const gain = this._gain(depth);
    osc.connect(gain);
    gain.connect(targetParam);
    osc.start();
    return { osc, gain };
  }

  _build() {
    this.ambientBus = this._gain(0);
    this.ambientBus.connect(this.destination);

    this._buildSub();
    this._buildBody();
    this._buildWater();
    this._buildResonance();
    this._buildLife();
  }

  _buildSub() {
    const out = this._gain(0.0001);
    const osc = this._osc("sine", 38);
    const filter = this._filter("lowpass", 75, 0.5);

    osc.connect(filter);
    filter.connect(out);
    out.connect(this.ambientBus);

    const ampLfo = this._lfo(0.018, 0.00008, out.gain);
    const pitchLfo = this._lfo(0.011, 1.7, osc.detune);

    osc.start();

    this.sub = { osc, filter, out, ampLfo, pitchLfo };
  }

  _buildBody() {
    const out = this._gain(0.0001);
    const filter = this._filter("lowpass", 420, 1.2);

    const voices = [
      this._osc("triangle", 72),
      this._osc("sine", 108),
      this._osc("sawtooth", 145)
    ];

    voices[0].detune.value = -7;
    voices[1].detune.value = 5;
    voices[2].detune.value = -11;

    for (const osc of voices) {
      osc.connect(filter);
      osc.start();
    }

    filter.connect(out);
    out.connect(this.ambientBus);

    const filterLfo = this._lfo(0.013, 170, filter.frequency);
    const detuneLfo = this._lfo(0.007, 9, voices[1].detune);

    this.body = { voices, filter, out, filterLfo, detuneLfo };
  }

  _createNoiseBuffer(seconds = 6) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = new SeededRandom();

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = rng.next();

      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    return buffer;
  }

  _buildWater() {
    const source = this.context.createBufferSource();
    source.buffer = this._createNoiseBuffer(6);
    source.loop = true;
    this.nodes.push(source);

    const low = this._filter("lowpass", 850, 0.7);
    const band = this._filter("bandpass", 1250, 0.45);
    const out = this._gain(0.0001);

    source.connect(low);
    low.connect(band);
    band.connect(out);
    out.connect(this.ambientBus);

    const cutoffLfo = this._lfo(0.021, 500, low.frequency);
    const bandLfo = this._lfo(0.009, 260, band.frequency);

    this.water = { source, low, band, out, cutoffLfo, bandLfo };
  }

  _buildResonance() {
    const bodySend = this._gain(0.0001);
    const delay = this.context.createDelay(1.5);
    delay.delayTime.value = 0.47;

    const feedback = this._gain(0.12);
    const resonanceFilter = this._filter("bandpass", 310, 4.5);
    const out = this._gain(0.0001);

    bodySend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(resonanceFilter);
    resonanceFilter.connect(out);
    out.connect(this.ambientBus);

    const resonanceLfo = this._lfo(0.005, 55, resonanceFilter.frequency);
    const delayLfo = this._lfo(0.003, 0.045, delay.delayTime);

    this.body.out.connect(bodySend);

    this.resonance = {
      bodySend, delay, feedback, resonanceFilter, out,
      resonanceLfo, delayLfo
    };
  }

  _buildLife() {
    const lifeOsc = this._osc("sine", 0.0067);
    const lifeGain = this._gain(1);
    lifeOsc.connect(lifeGain);
    lifeOsc.start();

    this.life = { osc: lifeOsc, gain: lifeGain, phase: 0 };
  }

  start() {
    if (this.running) return;
    this.running = true;

    try { this.water.source.start(); } catch {}

    this._update();
  }

  stop() {
    this.running = false;

    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    const now = this.context.currentTime;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setTargetAtTime(0, now, 0.05);
  }

  restart() {
    this.stop();
    this._replaceWaterSource();
    this.start();
  }

  _replaceWaterSource() {
    const old = this.water.source;
    try { old.stop(); } catch {}
    try { old.disconnect(); } catch {}

    const source = this.context.createBufferSource();
    source.buffer = this._createNoiseBuffer(6);
    source.loop = true;
    source.connect(this.water.low);
    this.water.source = source;
  }

  setIntensity(value) {
    this.targetIntensity = clamp01(value);
  }

  _update() {
    if (!this.running) return;

    const dt = 1 / 60;
    const smoothing = 1 - Math.exp(-dt * 1.7);
    this.intensity += (this.targetIntensity - this.intensity) * smoothing;

    const t = this.context.currentTime;
    const i = this.intensity;

    const low = smoothstep(i);
    const combat = smoothstep((i - 0.18) / 0.82);
    const critical = smoothstep((i - 0.65) / 0.35);

    this.ambientBus.gain.setTargetAtTime(0.75, t, 0.25);

    this.sub.out.gain.setTargetAtTime(0.00015 + low * 0.00115, t, 0.45);
    this.sub.filter.frequency.setTargetAtTime(58 + low * 38, t, 0.7);

    this.body.out.gain.setTargetAtTime(0.0002 + combat * 0.0024, t, 0.55);
    this.body.filter.frequency.setTargetAtTime(
      260 + combat * 520 + critical * 260, t, 0.65
    );
    this.body.filter.Q.setTargetAtTime(0.8 + critical * 2.5, t, 0.8);

    this.water.out.gain.setTargetAtTime(0.00025 + i * 0.0018, t, 0.7);
    this.water.low.frequency.setTargetAtTime(480 + i * 1500, t, 0.8);
    this.water.band.Q.setTargetAtTime(0.35 + critical * 2.2, t, 0.8);

    this.resonance.bodySend.gain.setTargetAtTime(0.0005 + combat * 0.0045, t, 0.8);
    this.resonance.feedback.gain.setTargetAtTime(0.08 + critical * 0.17, t, 0.9);
    this.resonance.out.gain.setTargetAtTime(0.0002 + combat * 0.0019, t, 0.8);

    this.life.phase += dt * (0.0067 + i * 0.012);
    const lifeValue = (Math.sin(this.life.phase * TAU) + 1) * 0.5;
    const lifeShape = lifeValue * lifeValue * (3 - 2 * lifeValue);

    this.body.voices[2].detune.setTargetAtTime(
      -11 + lifeShape * (4 + i * 14), t, 1.4
    );

    this.resonance.resonanceFilter.frequency.setTargetAtTime(
      260 + lifeShape * (120 + critical * 380), t, 1.8
    );

    this.telemetry.sub = low;
    this.telemetry.body = combat;
    this.telemetry.water = i;
    this.telemetry.resonance = 0.2 + combat * 0.8;
    this.telemetry.life = lifeShape;

    this.raf = requestAnimationFrame(() => this._update());
  }

  debugPulse() {
    const now = this.context.currentTime;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 1.8);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(280, now);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientBus);

    osc.start(now);
    osc.stop(now + 2.25);

    osc.addEventListener("ended", () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    }, { once: true });
  }

  getTelemetry() {
    return { ...this.telemetry };
  }

  destroy() {
    this.stop();
    for (const node of this.nodes) {
      try { node.disconnect(); } catch {}
      try { if (typeof node.stop === "function") node.stop(); } catch {}
    }
    this.nodes.length = 0;
    this.ambientBus = null;
  }
}