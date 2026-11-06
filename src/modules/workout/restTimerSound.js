let audioContext = null;
let masterNode = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function getMasterNode(ctx) {
  if (masterNode) return masterNode;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;
  compressor.connect(ctx.destination);
  masterNode = compressor;

  return masterNode;
}

function scheduleBell(ctx, dest, when, volume) {
  const partials = [
    { freq: 987.77, gain: 0.8,    decay:1.8 }, 
    { freq: 1975.53, gain:  0.4, decay:1.5 }, 
    { freq:2961.8, gain: 0.2,    decay:1.2 },
  ];

  for (const partial of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(partial.freq, when);

    gain.gain.setValueAtTime(partial.gain * volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + partial.decay);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(when);
    osc.stop(when + partial.decay + 0.05);
  }
}

export function playRestEndBell() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = getMasterNode(ctx);
  const now = ctx.currentTime;

  const strikes = [
    { offset: 0, volume: 0.9 },
    { offset: 1.0, volume: 0.9 },
    { offset: 2.1, volume: 0.8 },
  ];

  for (const strike of strikes) {
    scheduleBell(ctx, master, now + strike.offset, strike.volume);
  }
}