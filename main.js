import { AudioEngine } from "./audio/AudioEngine.js";
import { LORE_TEXT } from "./lore/THE_SWARM_BELOW.js";

const engine = new AudioEngine();
// DEBUG: expone engine globalmente para depurar desde la consola
window.engine = engine;

// --- Elementos de UI ---
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const debugButton = document.querySelector("#debugButton");
const narrateButton = document.querySelector("#narrateButton");
const stopNarrationButton = document.querySelector("#stopNarrationButton");
const intensity = document.querySelector("#intensity");
const intensityValue = document.querySelector("#intensityValue");
const contextState = document.querySelector("#contextState");
const engineState = document.querySelector("#engineState");
const intensityState = document.querySelector("#intensityState");
const dot = document.querySelector("#dot");

const readouts = {
  sub: document.querySelector("#subReadout"),
  body: document.querySelector("#bodyReadout"),
  water: document.querySelector("#waterReadout"),
  resonance: document.querySelector("#resReadout"),
  life: document.querySelector("#lifeReadout")
};

const MOODS = {
  calm:    { valence:  0.7, arousal: 0.15, tension: 0.0 },
  mystery: { valence:  0.1, arousal: 0.30, tension: 0.3 },
  tension: { valence: -0.4, arousal: 0.60, tension: 0.7 },
  dread:   { valence: -0.8, arousal: 0.45, tension: 0.9 },
  combat:  { valence: -0.3, arousal: 0.95, tension: 0.8 },
  hope:    { valence:  0.9, arousal: 0.55, tension: 0.2 }
};

function setIntensity(value) {
  const v = Number(value);
  engine.setIntensity(v);
  intensityValue.textContent = v.toFixed(2);
  intensityState.textContent = v.toFixed(2);
}

async function start() {
  await engine.start();
  startButton.disabled = true;
  stopButton.disabled = false;
  debugButton.disabled = false;
  narrateButton.disabled = false;
  engineState.textContent = "running";
  contextState.textContent = engine.context.state;
  dot.classList.add("on");
}

async function stop() {
  await engine.stop();
  startButton.disabled = false;
  stopButton.disabled = true;
  debugButton.disabled = true;
  narrateButton.disabled = true;
  stopNarrationButton.disabled = true;
  narrateButton.style.display = "";
  stopNarrationButton.style.display = "none";
  engineState.textContent = "stopped";
  contextState.textContent = engine.context?.state ?? "closed";
  dot.classList.remove("on");
}

startButton.addEventListener("click", start);
stopButton.addEventListener("click", stop);

debugButton.addEventListener("click", () => {
  engine.debugAmbient();
});

intensity.addEventListener("input", event => {
  setIntensity(event.target.value);
});

document.querySelectorAll("[data-intensity]").forEach(button => {
  button.addEventListener("click", () => {
    const value = Number(button.dataset.intensity);
    intensity.value = value;
    setIntensity(value);
  });
});

document.querySelectorAll("[data-mood]").forEach(button => {
  button.addEventListener("click", () => {
    const mood = MOODS[button.dataset.mood];
    if (mood) engine.setMood(mood);
  });
});

narrateButton.addEventListener("click", async () => {
  await engine.start();
  engine.narrateLore(LORE_TEXT);
  narrateButton.disabled = true;
  narrateButton.style.display = "none";
  stopNarrationButton.disabled = false;
  stopNarrationButton.style.display = "";
});

stopNarrationButton.addEventListener("click", () => {
  engine.stopNarration();
  narrateButton.disabled = false;
  narrateButton.style.display = "";
  stopNarrationButton.disabled = true;
  stopNarrationButton.style.display = "none";
});

function updateReadouts() {
  const telemetry = engine.getTelemetry();

  readouts.sub.textContent = telemetry.sub.toFixed(2);
  readouts.body.textContent = telemetry.body.toFixed(2);
  readouts.water.textContent = telemetry.water.toFixed(2);
  readouts.resonance.textContent = telemetry.resonance.toFixed(2);
  readouts.life.textContent = telemetry.life.toFixed(2);

  contextState.textContent = engine.context?.state ?? "uninitialized";
  requestAnimationFrame(updateReadouts);
}

setIntensity(0);
updateReadouts();