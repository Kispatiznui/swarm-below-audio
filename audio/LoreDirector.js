import { LoreParser } from "./LoreParser.js";

export class LoreDirector {
  constructor(engine, loreText) {
    this.engine = engine;
    this.parser = new LoreParser(loreText);
    this.paragraphs = this.parser.getParagraphs();

    this.running = false;
    this.timers = [];
    this.currentParagraph = 0;

    // Callback opcional para UI
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

    for (let i = fromParagraph; i < this.paragraphs.length; i++) {
      const p = this.paragraphs[i];
      const relTime = t - baseTime;

      // 1) Cambiar mood
      this._scheduleAt(relTime, () => {
        this.engine.setMood(p.mood);
        if (this.onParagraph) this.onParagraph(i, p);
      });

      // 2) Disparar leitmotifs de entidades mencionadas
      const motifDelay = relTime + 0.3;
      for (const entityKey of p.entities) {
        this._scheduleAt(motifDelay, () => {
          this.engine.playLeitmotif(entityKey);
        });
      }

      // 3) Narración sintética
      const endT = this.engine.voice.narrateParagraph(p, t);

      // 4) Pausa entre párrafos
      const pause = p.isQuestion ? 3.5 : 2.0;
      t = endT + pause;
    }

    // Fin
    const totalRel = t - baseTime;
    this._scheduleAt(totalRel, () => {
      this.running = false;
      if (this.onFinish) this.onFinish();
    });
  }

  _scheduleAt(relSeconds, fn) {
    const ms = Math.max(0, relSeconds * 1000);
    const id = setTimeout(() => {
      if (this.running) fn();
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