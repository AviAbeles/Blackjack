export class TableSound {
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.context = null;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  ensureContext() {
    if (this.muted) return null;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === "suspended") {
      this.context.resume();
    }

    return this.context;
  }

  tone({
    frequency,
    duration,
    volume = 0.05,
    type = "sine",
    delay = 0,
    endFrequency = frequency,
  }) {
    const context = this.ensureContext();
    if (!context) return;

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration = 0.08, volume = 0.025, delay = 0 }) {
    const context = this.ensureContext();
    if (!context) return;

    const frameCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime + delay;

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1300;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
  }

  card() {
    this.noise({ duration: 0.09, volume: 0.035 });
    this.tone({
      frequency: 170,
      endFrequency: 115,
      duration: 0.07,
      volume: 0.018,
      type: "triangle",
    });
  }

  chip() {
    this.tone({
      frequency: 1450,
      endFrequency: 1050,
      duration: 0.08,
      volume: 0.04,
      type: "sine",
    });
    this.tone({
      frequency: 2050,
      duration: 0.045,
      volume: 0.018,
      type: "triangle",
      delay: 0.025,
    });
  }

  clearChips() {
    this.tone({
      frequency: 900,
      endFrequency: 360,
      duration: 0.14,
      volume: 0.03,
      type: "triangle",
    });
  }

  win(blackjack = false) {
    const notes = blackjack ? [523, 659, 784, 1047] : [523, 659, 784];
    notes.forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.18,
        volume: 0.04,
        type: "triangle",
        delay: index * 0.085,
      });
    });
  }

  loss() {
    this.tone({
      frequency: 260,
      endFrequency: 120,
      duration: 0.36,
      volume: 0.045,
      type: "sawtooth",
    });
  }

  push() {
    this.tone({
      frequency: 420,
      duration: 0.12,
      volume: 0.03,
      type: "triangle",
    });
    this.tone({
      frequency: 420,
      duration: 0.12,
      volume: 0.03,
      type: "triangle",
      delay: 0.16,
    });
  }
}
