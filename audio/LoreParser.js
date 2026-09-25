const LEX = {
  abismo:      { tension: +0.4, valence: -0.3, arousal: -0.2 },
  oscuridad:   { tension: +0.3, valence: -0.2, arousal: -0.3 },
  miedo:       { tension: +0.6, valence: -0.5, arousal: +0.5 },
  tristeza:    { tension: +0.2, valence: -0.7, arousal: -0.4 },
  pena:        { tension: +0.2, valence: -0.6, arousal: -0.3 },
  muerte:      { tension: +0.3, valence: -0.6, arousal: -0.1 },
  muertos:     { tension: +0.2, valence: -0.4, arousal: -0.1 },
  dioses:      { tension: +0.3, valence: +0.2, arousal: +0.3 },
  realidad:    { tension: +0.1, valence: +0.1, arousal: +0.1 },
  enjambre:    { tension: +0.5, valence: -0.3, arousal: +0.5 },
  swarm:       { tension: +0.5, valence: -0.3, arousal: +0.5 },
  aberración:  { tension: +0.6, valence: -0.4, arousal: +0.6 },
  aberration:  { tension: +0.6, valence: -0.4, arousal: +0.6 },
  descenso:    { tension: +0.2, valence: -0.1, arousal: -0.1 },
  descendió:   { tension: +0.2, valence: -0.1, arousal: -0.1 },
  profundidad: { tension: +0.2, valence: -0.1, arousal: -0.2 },
  profundidades:{ tension: +0.3, valence: -0.2, arousal: -0.2 },
  luz:         { tension: -0.2, valence: +0.4, arousal: +0.2 },
  esperanza:   { tension: -0.3, valence: +0.7, arousal: +0.3 },
  pregunta:    { tension: +0.4, valence: -0.1, arousal: +0.3 },
  criatura:    { tension: +0.3, valence: -0.2, arousal: +0.2 },
  criaturas:   { tension: +0.3, valence: -0.2, arousal: +0.3 },
  carne:       { tension: +0.4, valence: -0.5, arousal: +0.2 },
  voces:       { tension: +0.4, valence: -0.3, arousal: +0.3 },
  canción:     { tension: +0.1, valence: +0.2, arousal: +0.1 },
  melodía:     { tension: +0.1, valence: +0.2, arousal: +0.1 },
  olvido:      { tension: +0.3, valence: -0.5, arousal: -0.3 },
  olvidado:    { tension: +0.3, valence: -0.4, arousal: -0.2 },
  memoria:     { tension: +0.2, valence: -0.2, arousal: -0.1 },
  recuerdo:    { tension: +0.2, valence: -0.1, arousal: -0.1 },
  infinito:    { tension: +0.2, valence: 0.0, arousal: -0.2 },
  eternidad:   { tension: +0.3, valence: -0.1, arousal: -0.3 }
};

const ENTITY_PATTERNS = [
  { key: "witness",    re: /\bWITNESS\b/i },
  { key: "tayatna",    re: /\bTAYATNA\b/i },
  { key: "aberration", re: /\bABERRATION\b/i },
  { key: "swarm",      re: /\bSWARM\b/i },
  { key: "below",      re: /\bBelow\b/ },
  { key: "inkalanpat", re: /ɨnkalanpat/i }
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LoreParser {
  constructor(text) {
    this.text = text;
    this.paragraphs = this._splitParagraphs(text);
    this.analysis = this.paragraphs.map((raw, i) => this._analyzeParagraph(raw, i));
  }

  _splitParagraphs(text) {
    return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }

  _analyzeParagraph(raw, index) {
    const text = raw.trim();
    const lower = text.toLowerCase();

    let valence = 0, arousal = 0, tension = 0, hits = 0;

    for (const [word, delta] of Object.entries(LEX)) {
      const escaped = escapeRegex(word);
      const count = (lower.match(new RegExp(escaped, "g")) || []).length;
      if (count > 0) {
        valence += delta.valence * count;
        arousal += delta.arousal * count;
        tension += delta.tension * count;
        hits += count;
      }
    }

    if (hits > 0) {
      valence /= hits;
      arousal /= hits;
      tension /= hits;
    }

    const isQuestion = /\?/.test(text);
    const isClimax = /\*\*[A-ZÁÉÍÓÚÑɨ]+\*\*/i.test(text);
    const exclamations = (text.match(/!/g) || []).length;

    if (isQuestion) tension = Math.min(1, tension + 0.3);
    if (isClimax)   arousal = Math.min(1, arousal + 0.3);
    arousal = Math.min(1, arousal + exclamations * 0.1);

    valence = Math.max(-1, Math.min(1, valence));
    arousal = Math.max(0, Math.min(1, arousal));
    tension = Math.max(0, Math.min(1, tension));

    const words = text.split(/\s+/).filter(Boolean).length;
    const sentences = text.split(/[.!?]/).filter(s => s.trim()).length || 1;
    const density = words / sentences;

    const entities = [];
    for (const { key, re } of ENTITY_PATTERNS) {
      if (re.test(text)) entities.push(key);
    }

    const duration = Math.max(8, text.length / 18);

    return {
      index,
      text,
      mood: { valence, arousal, tension },
      isQuestion,
      isClimax,
      density,
      entities,
      duration,
      wordCount: words
    };
  }

  getParagraphs() {
    return this.analysis;
  }

  getOverallMood() {
    if (!this.analysis.length) return { valence: 0, arousal: 0, tension: 0 };
    const sum = this.analysis.reduce(
      (acc, p) => ({
        valence: acc.valence + p.mood.valence,
        arousal: acc.arousal + p.mood.arousal,
        tension: acc.tension + p.mood.tension
      }),
      { valence: 0, arousal: 0, tension: 0 }
    );
    const n = this.analysis.length;
    return {
      valence: sum.valence / n,
      arousal: sum.arousal / n,
      tension: sum.tension / n
    };
  }
}