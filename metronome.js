// Constants

const lookahead = 25.0; // how frequently to call the scheduling function in milliseconds
const scheduleAheadTime = 0.1; // how far ahead to schedule in seconds
const beatsPerMeasure = 4; // how many beats per measure, before we wrap currentNote to 0
const audioCtx = new AudioContext();

// mutable state
let tempo;
let currentNote;
let nextNoteTime;
let timerId;
let samples = {};
const notesInQueue = [];
let playToggle;

// main entrypoint

async function main() {
  const setTempo = wire("tempo", (value) => {
    tempo = Number(value);
  });

  const [kick, snare] = await Promise.all([
    fetchAudioBuffer(audioCtx, "samples/linndrum/kick.wav"),
    fetchAudioBuffer(audioCtx, "samples/linndrum/sd.wav"),
  ]);
  samples.kick = kick;
  samples.snare = snare;

  let isPlaying = false;
  playToggle = document.getElementById("playing");
  playToggle.addEventListener("click", function () {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playToggle.classList.add("is-playing");
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      currentNote = 0;
      nextNoteTime = audioCtx.currentTime;
      scheduler();
    } else {
      playToggle.classList.remove("is-playing");
      clearTimeout(timerId);
    }
  });

  const keyCodeMap = {
    // left key dec's tempo
    37: () => setTempo(tempo - 1),
    // up arrow inc's tempo
    38: () => setTempo(tempo + 1),
    // right key inc's tempo
    39: () => setTempo(tempo + 1),
    // down arrow dec's tempo
    40: () => setTempo(tempo - 1),
    // spacebar toggles playing
    32: () => playToggle.click(),
  };

  document.addEventListener("keyup", function (event) {
    const f = keyCodeMap[event.keyCode];
    f && f();
  });

  draw();
}

main();

// note scheduling

function nextNote() {
  const secondsPerBeat = 60.0 / tempo;
  nextNoteTime += secondsPerBeat;
  currentNote += 1;
  if (currentNote === beatsPerMeasure) {
    currentNote = 0;
  }
}

function scheduleNote(beatNumber, time) {
  notesInQueue.push({ beatNumber, time });
  // playPulse(440, 0.12, 0, time);
  playSample(
    audioCtx,
    beatNumber % 2 === 0 ? samples.kick : samples.snare,
    time
  );
}

function scheduler() {
  const endLookaheadTime = audioCtx.currentTime + scheduleAheadTime;
  while (nextNoteTime < endLookaheadTime) {
    scheduleNote(currentNote, nextNoteTime);
    nextNote();
  }
  timerId = setTimeout(scheduler, lookahead);
}

// web audio playing

function playPulse(pulseHz, pulseTime, lfoHz, time) {
  let osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = pulseHz;

  let amp = audioCtx.createGain();
  amp.gain.value = 1;

  let lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = lfoHz;

  lfo.connect(amp.gain);
  osc.connect(amp).connect(audioCtx.destination);
  lfo.start();
  osc.start(time);
  osc.stop(time + pulseTime);
}

function playSample(audioContext, arrayBuffer, time) {
  const source = audioContext.createBufferSource();
  source.buffer = arrayBuffer;
  source.connect(audioContext.destination);
  source.start(time);
  return source;
}

// sample loading

async function fetchAudioBuffer(audioContext, url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

// UI Utilities

function draw() {
  const currentTime = audioCtx.currentTime;

  const secondsPerBeat = 60.0 / tempo;
  const flashTime = secondsPerBeat * 0.6; // time in seconds the visual flash for the beat should appear

  // delete past notes
  while (
    notesInQueue.length &&
    notesInQueue[0].time + flashTime < currentTime
  ) {
    notesInQueue.splice(0, 1);
  }

  if (
    notesInQueue.length &&
    notesInQueue[0].time >= currentTime &&
    notesInQueue[0].time + flashTime >= currentTime
  ) {
    playToggle.classList.add("beat");
  } else {
    playToggle.classList.remove("beat");
  }

  requestAnimationFrame(draw);
}

function wire(formElementId, callback) {
  const formEl = document.getElementById(formElementId);
  const selector = `label[for="${formElementId}"] > .form-value`;
  const labelValueEl = document.querySelector(selector);
  callback(formEl.value);

  formEl.addEventListener(
    "input",
    function () {
      labelValueEl && (labelValueEl.innerText = this.value);
      callback && callback(this.value);
    },
    false
  );

  return (newValue) => {
    formEl.value = newValue;
    labelValueEl && (labelValueEl.innerText = newValue);
    callback && callback(newValue);
  };
}
