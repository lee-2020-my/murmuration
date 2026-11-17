// Every sound in Murmuration is synthesised with WebAudio: no audio files, no
// network, nothing to load. The audio context is created only after the player's
// first gesture (the browser's autoplay rule), so the screenshot scenes, which
// never take a gesture, stay silent and never create one.

/** A slow pentatonic line the music loop walks, in hertz (C major pentatonic, two octaves). */
const MELODY = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
const MELODY_STEPS = [0, 2, 1, 4, 3, 5, 7, 6, 8, 9, 7, 5, 4, 2, 3, 1];

export function createAudio() {
  let context = null;
  let master = null;
  let windGain = null;
  let musicTimer = null;
  let melodyIndex = 0;
  let nextNoteTime = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(context.destination);
      startWind();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  /** A loop of filtered noise that sounds like wind; its loudness follows the flight speed. */
  function startWind() {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    windGain = context.createGain();
    windGain.gain.value = 0.0;
    source.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    source.start();
  }

  function tone({ frequency, endFrequency, type, at, duration, volume, slideAt }) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), slideAt ?? at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  function noiseBurst({ at, duration, volume, fromFrequency, toFrequency }) {
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromFrequency, at);
    filter.frequency.exponentialRampToValueAtTime(toFrequency, at + duration);
    filter.Q.value = 1.1;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(at);
  }

  /** Schedule the next few melody notes ahead of the audio clock, every 240 ms. */
  function scheduleMusic() {
    if (!context) return;
    const ahead = context.currentTime + 0.6;
    while (nextNoteTime < ahead) {
      const note = MELODY[MELODY_STEPS[melodyIndex % MELODY_STEPS.length]];
      melodyIndex += 1;
      tone({ frequency: note, type: 'triangle', at: nextNoteTime, duration: 1.4, volume: 0.05 });
      tone({ frequency: note / 2, type: 'sine', at: nextNoteTime, duration: 1.8, volume: 0.035 });
      nextNoteTime += 0.62;
    }
  }

  return {
    get muted() {
      return muted;
    },

    /** Call from a click or key press; a no-op in shot mode, where no gesture happens. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!musicTimer) {
        nextNoteTime = context.currentTime + 0.1;
        musicTimer = window.setInterval(scheduleMusic, 240);
      }
    },

    /** The wind follows the flight: 0 still, 1 at full boost. */
    setWind(level) {
      if (!context || !windGain) return;
      windGain.gain.setTargetAtTime(0.05 + level * 0.11, context.currentTime, 0.2);
    },

    /** Two bright notes: a firefly caught. */
    chirp() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone({ frequency: 1318, endFrequency: 1760, type: 'sine', at, duration: 0.16, volume: 0.12 });
      tone({ frequency: 1760, endFrequency: 2093, type: 'sine', at: at + 0.09, duration: 0.2, volume: 0.1 });
    },

    /** A warm third: a stray starling joins the flock. */
    gather() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone({ frequency: 523.25, type: 'triangle', at, duration: 0.3, volume: 0.12 });
      tone({ frequency: 659.25, type: 'triangle', at: at + 0.08, duration: 0.34, volume: 0.12 });
    },

    /** A falling sawtooth cry: a hawk is coming. */
    screech() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone({ frequency: 1500, endFrequency: 480, type: 'sawtooth', at, duration: 0.7, volume: 0.09 });
      noiseBurst({ at, duration: 0.4, volume: 0.06, fromFrequency: 2400, toFrequency: 700 });
    },

    /** A soft rush of air: a gust tears through the flock. */
    whoosh() {
      if (!ensure()) return;
      const at = context.currentTime;
      noiseBurst({ at, duration: 0.8, volume: 0.14, fromFrequency: 500, toFrequency: 1800 });
    },

    /** A rising pentatonic run: home at last. */
    win() {
      if (!ensure()) return;
      const at = context.currentTime;
      [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', at: at + index * 0.14, duration: 0.7, volume: 0.13 });
      });
    },

    /** A low thud: the flock is broken. */
    thud() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone({ frequency: 110, endFrequency: 55, type: 'sine', at, duration: 0.4, volume: 0.22 });
      noiseBurst({ at, duration: 0.25, volume: 0.1, fromFrequency: 300, toFrequency: 120 });
    },

    setMuted(next) {
      muted = next;
      if (master && context) master.gain.setTargetAtTime(next ? 0 : 0.9, context.currentTime, 0.05);
    },
  };
}
