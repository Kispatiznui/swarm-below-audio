export const TAU = Math.PI * 2;

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Escalas en semitonos desde la raíz
export const SCALES = {
  minor:     [0, 2, 3, 5, 7, 8, 10],
  dorian:    [0, 2, 3, 5, 7, 9, 10],
  phrygian:  [0, 1, 3, 5, 7, 8, 10],
  lydian:    [0, 2, 4, 6, 7, 9, 11],
  major:     [0, 2, 4, 5, 7, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  hungarian: [0, 2, 3, 6, 7, 8, 11]
};