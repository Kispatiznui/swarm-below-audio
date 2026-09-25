# THE SWARM BELOW — Audio Procedural

Sistema de audio generado 100% en tiempo real a partir del texto del lore.
Sin samples, sin MP3, sin WAV. Solo Web Audio API.

## Estructura

- `AudioEngine` — orquesta todos los subsistemas
- `AudioAmbience` — capa textural (sub, body, water, resonance, life)
- `AudioMusic` — capa musical tonal (pad, melodía, latido)
- `VoiceSynth` — voces del enjambre por formantes
- `Leitmotifs` — motivos por entidad del lore
- `LoreParser` — analiza el texto (mood por párrafo)
- `LoreDirector` — convierte el texto en una partitura temporal

## Uso

```js
const engine = new AudioEngine();
await engine.start();

// Control manual
engine.setIntensity(0.5);
engine.setMood({ valence: -0.5, arousal: 0.7, tension: 0.9 });
engine.playLeitmotif("tayatna");

// Narrar el lore completo
engine.narrateLore(LORE_TEXT, {
  onParagraph: (i, p) => console.log("Párrafo", i, p.mood),
  onFinish: () => console.log("Fin")
});