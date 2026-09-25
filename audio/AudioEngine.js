import { AudioAmbience } from "./AudioAmbience.js";
import { AudioMusic } from "./AudioMusic.js";
import { VoiceSynth } from "./VoiceSynth.js";
import { LeitmotifPlayer } from "./Leitmotifs.js";
import { LoreDirector } from "./LoreDirector.js";

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.limiter = null;
    this.ambienceBus = null;
    this.musicBus = null;

    this.ambience = null;
    this.music = null;
    this.voice = null;
    this.leitmotifs = null;

    this.director = null;
    this.running = false;
  }

  async start() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API no soportada por este navegador.");
      }

      this.context = new AudioContextClass();

      // Cadena maestra
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 8;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.15;

      this.master = this.context.createGain();
      this.master.gain.value = 0.22;

      this.master.connect(this.limiter);
      this.limiter.connect(this.context.destination);

      // Buses separados
      this.ambienceBus = this.context.createGain();
      this.ambienceBus.gain.value = 0.9;
      this.ambienceBus.connect(this.master);

      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = 0.7;
      this.musicBus.connect(this.master);

      // Subsistemas
      this.ambience = new AudioAmbience(this.context, this.ambienceBus);
      this.music = new AudioMusic(this.context, this.musicBus);
      this.voice = new VoiceSynth(this.context, this.master);
      this.leitmotifs = new LeitmotifPlayer(
        this.context,
        this.master,
        this.music.reverb
      );
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.ambience.start();
    this.music.start();
    this.running = true;
  }

  async stop() {
    if (!this.context) return;

    this.ambience?.stop();
    this.music?.stop();
    this.voice?.stop();
    this.director?.stop();

    if (this.context.state !== "closed") {
      await this.context.suspend();
    }

    this.running = false;
  }

  setIntensity(value) {
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    this.ambience?.setIntensity(v);
    this.music?.setIntensity(v);
  }

  setMood(mood) {
    this.music?.setMood(mood);
  }

  playLeitmotif(entityKey) {
    if (!this.leitmotifs) return;
    this.leitmotifs.play(entityKey);
  }

  debugAmbient() {
    if (!this.running) return;
    this.ambience.debugPulse();
  }

  // Narrar el lore completo (parser + director + voice)
  narrateLore(loreText, callbacks = {}) {
    if (!this.context) return null;

    this.director?.stop();
    this.director = new LoreDirector(this, loreText);

    if (callbacks.onParagraph) this.director.onParagraph = callbacks.onParagraph;
    if (callbacks.onFinish)    this.director.onFinish = callbacks.onFinish;

    this.director.start();
    return this.director;
  }

  stopNarration() {
    this.director?.stop();
    this.director = null;
  }

  getTelemetry() {
    return this.ambience?.getTelemetry() ?? {
      sub: 0, body: 0, water: 0, resonance: 0, life: 0
    };
  }

  destroy() {
    this.director?.stop();
    this.ambience?.destroy();
    this.music?.destroy();
    this.voice?.destroy();
    this.leitmotifs?.destroy();

    this.ambience = null;
    this.music = null;
    this.voice = null;
    this.leitmotifs = null;
    this.director = null;

    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }

    this.context = null;
    this.master = null;
    this.limiter = null;
    this.ambienceBus = null;
    this.musicBus = null;
    this.running = false;
  }
}