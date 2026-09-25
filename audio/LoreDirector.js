import { LoreParser } from "./LoreParser.js";

export class LoreDirector {
  constructor(engine, loreText) {
    this.engine = engine;
    this.parser = new LoreParser(loreText);
    this.paragraphs = this.parser.getParagraphs();

    this.running = false;
    this.timers = [];
    this.currentParagraph = 0;

    this.onParagraph = null;
    this.onFinish = null;
  }

  start(fromParagraph = 0) {
    if (this.running) return;
    this.running = true;

    const ctx = this.engine.context;
    this.engine.voice.start();

    let t = ctx.currentTime + 0.5;
    const baseTime = ctx.currentTime;

    console.log("[LoreDirector] Iniciando con", this.paragraphs.length, "párrafos");

    for (let i = fromParagraph; i < this.paragraphs.length; i++) {
      const p = this.paragraphs[i];
      const relTime = t - baseTime;

      // Cambiar mood
      this._scheduleAt(relTime, () => {
        console.log("[LoreDirector] Párrafo", i, "→ mood:", p.mood);
        this.engine.setMood(p.mood);
        this.currentParagraph = i;
        if (this.onParagraph) this.onParagraph(i, p);
      });

      // Leitmotifs de entidades mencionadas
      const motifDelay = relTime + 0.3;
      for (const entityKey of p.entities) {
        this._scheduleAt(motifDelay, () => {
          console.log("[LoreDirector] Leitmotif:", entityKey);
          this.engine.playLeitmotif(entityKey);
        });
      }

      // Narración
      const endT = this.engine.voice.narrateParagraph(p, t);

      // Pausa entre párrafos
      const pause = p.isQuestion ? 3.5 : 2.0;
      t = endT + pause;
    }

    const totalRel = t - baseTime;
    console.log("[LoreDirector] Duración total:", totalRel.toFixed(1), "s");

    this._scheduleAt(totalRel, () => {
      console.log("[LoreDirector] Fin de la narración");
      this.running = false;
      if (this.onFinish) this.onFinish();
    });
  }

  _scheduleAt(relSeconds, fn) {
    const ms = Math.max(0, relSeconds * 1000);
    const id = setTimeout(() => {
      if (!this.running) return;
      fn();
    }, ms);
    this.timers.push(id);
  }

  stop() {
    this.running = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this.engine.voice.stop();
  }
}