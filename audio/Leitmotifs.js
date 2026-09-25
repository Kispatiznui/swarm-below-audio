import { midiToFreq } from "./utils.js";

// Cada entidad tiene un motivo (secuencia de intervalos en semitonos)
// y un timbre (tipo de oscilador + filtro).
export const LEITMOTIFS = {
  witness: {
    name: "THE WITNESS",
    // Descenso cromático: caída, observación, descenso
    intervals: [0, -1, -3, -5, -7],
    oscType: "sine",
    baseMidi: 57,       // A3
    duration: 0.6,
    filterFreq: 800,
    filterQ: 3,
    reverbSend: 0.6,
    gain: 0.04
  },
  tayatna: {
    name: "TAYATNA",
    // Motivo triste en menor: segunda menor ascendente + caída de quinta
    intervals: [0, 1, 0, -5, -7],
    oscType: "triangle",
    baseMidi: 52,       // E3
    duration: 1.4,
    filterFreq: 500,
    filterQ: 5,
    reverbSend: 0.8,
    gain: 0.035
  },
  aberration: {
    name: "ABERRATION",
    // Cluster disonante: múltiples semitonos
    intervals: [0, 1, 2, 6, 1, 0],
    oscType: "sawtooth",
    baseMidi: 38,       // D2
    duration: 0.35,
    filterFreq: 600,
    filterQ: 8,
    reverbSend: 0.4,
    gain: 0.03
  },
  swarm: {
    name: "SWARM",
    // Enjambre: pulsos rápidos ascendentes
    intervals: [0, 3, 5, 7, 10, 12],
    oscType: "square",
    baseMidi: 45,
    duration: 0.15,
    filterFreq: 1200,
    filterQ: 4,
    reverbSend: 0.5,
    gain: 0.025
  },
  below: {
    name: "THE BELOW",
    // Profundidad: descensos de octava
    intervals: [0, -12, 0, -12, -24],
    oscType: "sine",
    baseMidi: 33,       // A1
    duration: 2.0,
    filterFreq: 200,
    filterQ: 2,
    reverbSend: 0.9,
    gain: 0.05
  },
  inkalanpat: {
    name: "ɨNKALANPAT",
    // Tristeza profunda: motivo suspendido
    intervals: [0, 3, 7, 3, 0, -2],
    oscType: "triangle",
    baseMidi: 48,
    duration: 1.8,
    filterFreq: 400,
    filterQ: 6,
    reverbSend: 1.0,
    gain: 0.03
  }
};

export class LeitmotifPlayer {
  constructor(context, destination, reverb) {
    this.context = context;
    this.destination = destination;
    this.reverb = reverb;

    this.out = context.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(destination);

    this.reverbSend = context.createGain();
    this.reverbSend.gain.value = 0.7;
    this.reverbSend.connect(reverb);
  }

  // Dispara un leitmotif completo. Devuelve tiempo de fin.
  play(entityKey, startTime = null) {
    const motif = LEITMOTIFS[entityKey];
    if (!motif) return 0;

    const t0 = startTime ?? this.context.currentTime;
    let t = t0;

    for (const interval of motif.intervals) {
      const freq = midiToFreq(motif.baseMidi + interval);
      this._playNote(t, freq, motif);
      t += motif.duration * 0.85;
    }

    return t;
  }

  _playNote(time, freq, motif) {
    const ctx = this.context;

    const osc = ctx.createOscillator();
    osc.type = motif.oscType;
    osc.frequency.value = freq;

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = motif.filterFreq;
    filt.Q.value = motif.filterQ;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(motif.gain, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, time + motif.duration);

    const dry = ctx.createGain();
    dry.gain.value = 1 - motif.reverbSend;
    const wet = ctx.createGain();
    wet.gain.value = motif.reverbSend;

    osc.connect(filt);
    filt.connect(g);
    g.connect(dry);
    g.connect(wet);
    dry.connect(this.out);
    wet.connect(this.reverbSend);

    osc.start(time);
    osc.stop(time + motif.duration + 0.05);

    osc.addEventListener("ended", () => {
      try {
        osc.disconnect(); filt.disconnect(); g.disconnect();
        dry.disconnect(); wet.disconnect();
      } catch {}
    }, { once: true });
  }

  destroy() {
    try { this.out.disconnect(); } catch {}
    try { this.reverbSend.disconnect(); } catch {}
  }
}