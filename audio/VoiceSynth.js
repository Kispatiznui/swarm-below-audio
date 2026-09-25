// Formantes de vocales (F1, F2, F3) en Hz
const VOWELS = {
  a: [800, 1150, 2900],
  e: [400, 1600, 2700],
  i: [350, 1700, 2700],
  o: [450,  800, 2830],
  u: [325,  700, 2530]
};

const VOWEL_MAP = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u" };

export class VoiceSynth {
  constructor(context, destination) {
    this.context = context;
    this.destination = destination;

    this.running = false;

    this.out = context.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(destination);
  }

  scheduleWord(startTime, word, opts = {}) {
    const {
      pitch = 110,
      whisper = false,
      count = 1,
      duration = 0.4,
      spread = 0
    } = opts;

    const letters = word.toLowerCase().replace(/[^a-záéíóúñ]/g, "");
    if (!letters) return;

    const syllables = this._syllabify(letters);
    const syllDur = duration / Math.max(1, syllables.length);

    for (let v = 0; v < count; v++) {
      const detune = spread * (Math.random() * 2 - 1);
      const delay = Math.random() * 0.04;

      syllables.forEach((syl, i) => {
        const t = startTime + i * syllDur + delay;
        this._scheduleSyllable(t, syl, syllDur, pitch + detune, whisper);
      });
    }
  }

  _syllabify(word) {
    const out = [];
    let buf = "";
    for (const ch of word) {
      buf += ch;
      if ("aeiouáéíóú".includes(ch)) {
        out.push(buf);
        buf = "";
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  _scheduleSyllable(time, syllable, dur, baseFreq, whisper) {
    const ctx = this.context;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(baseFreq * (0.95 + Math.random() * 0.1), time);
    osc.frequency.linearRampToValueAtTime(baseFreq * (1.0 + Math.random() * 0.05), time + dur);

    const vowels = syllable.match(/[aeiouáéíóú]/g) || ["a"];
    const v = VOWEL_MAP[vowels[0]] || vowels[0];
    const [f1, f2, f3] = VOWELS[v] || VOWELS.a;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(whisper ? 0.008 : 0.03, time + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.9);
    env.connect(this.out);

    const formants = [];
    const mkFormant = (freq, q, gain) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(bp);
      bp.connect(g);
      g.connect(env);
      formants.push({ bp, g });
    };

    mkFormant(f1, 8, 0.6);
    mkFormant(f2, 10, 0.35);
    mkFormant(f3, 12, 0.18);

    let noiseNode = null;
    if (/[bcdfghjklmnpqrstvwxyz]/.test(syllable[0]) || whisper) {
      noiseNode = ctx.createBufferSource();
      noiseNode.buffer = this._noiseBuffer(0.05);
      const nf = ctx.createBiquadFilter();
      nf.type = "highpass";
      nf.frequency.value = 2000 + Math.random() * 3000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, time);
      ng.gain.exponentialRampToValueAtTime(0.02, time + 0.005);
      ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      noiseNode.connect(nf);
      nf.connect(ng);
      ng.connect(this.out);
      noiseNode.start(time);
      noiseNode.stop(time + 0.08);
    }

    osc.start(time);
    osc.stop(time + dur + 0.05);

    osc.addEventListener("ended", () => {
      try {
        osc.disconnect();
        formants.forEach(f => { f.bp.disconnect(); f.g.disconnect(); });
        env.disconnect();
        if (noiseNode) { noiseNode.disconnect(); }
      } catch {}
    }, { once: true });
  }

  _noiseBuffer(seconds) {
    const rate = this.context.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.context.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Narra un párrafo como coro inquietante. Devuelve el tiempo final.
  narrateParagraph(paragraph, startTime) {
    const words = paragraph.text
      .replace(/\*\*/g, "")
      .split(/\s+/)
      .filter(w => w.length > 1);

    let t = startTime;
    const mood = paragraph.mood;

    const voicesPerWord = 1 + Math.round(mood.arousal * 3);
    const basePitch = 90 - mood.tension * 30 + mood.valence * 15;

    for (const word of words) {
      const dur = 0.25 + word.length * 0.045;

      this.scheduleWord(t, word, {
        pitch: basePitch * (0.9 + Math.random() * 0.2),
        whisper: mood.tension > 0.6,
        count: voicesPerWord,
        duration: dur,
        spread: 4 + mood.tension * 8
      });

      t += dur + (word.endsWith(",") ? 0.15 : 0.05);
      if (/[.!?]$/.test(word)) t += 0.3 + (1 - mood.arousal) * 0.5;
    }

    return t;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.out.gain.setTargetAtTime(0.8, this.context.currentTime, 1.0);
  }

  stop() {
    this.running = false;
    this.out.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.3);
  }

  destroy() {
    this.stop();
    try { this.out.disconnect(); } catch {}
  }
}