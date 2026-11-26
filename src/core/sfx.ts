export type SfxName =
  | 'shoot'
  | 'hit'
  | 'kill'
  | 'hurt'
  | 'levelup'
  | 'evolve'
  | 'buy'
  | 'boss';

type Ctor = typeof AudioContext;

/**
 * 极简合成音效：不依赖任何音频文件，全部用 WebAudio 现场合成。
 * 首次用户交互后必须 unlock()（移动端自动播放限制）。
 */
class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctor: Ctor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!ctor) return;

    this.ctx = new ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    void this.ctx.resume();
    this.noiseBuffer = this.buildNoise();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    switch (name) {
      case 'shoot':
        this.tone(880, 0.06, 'square', 0.05, 520, t);
        break;
      case 'hit':
        this.tone(320, 0.05, 'triangle', 0.08, 180, t);
        break;
      case 'kill':
        this.noise(0.14, 0.16, t);
        this.tone(180, 0.12, 'sawtooth', 0.05, 60, t);
        break;
      case 'hurt':
        this.tone(140, 0.2, 'sawtooth', 0.14, 70, t);
        break;
      case 'levelup':
        this.arp([523, 659, 784, 1046], 0.09, t);
        break;
      case 'evolve':
        this.arp([392, 523, 659, 880, 1174], 0.1, t);
        this.noise(0.25, 0.08, t);
        break;
      case 'buy':
        this.arp([880, 1174], 0.07, t);
        break;
      case 'boss':
        this.tone(90, 0.5, 'sawtooth', 0.16, 55, t);
        break;
    }
  }

  private tone(
    from: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    to: number,
    start: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);

    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private arp(freqs: number[], step: number, start: number): void {
    freqs.forEach((freq, i) => {
      this.tone(freq, step * 1.4, 'square', 0.06, freq * 0.99, start + i * step);
    });
  }

  private noise(duration: number, gain: number, start: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, start);
    filter.frequency.exponentialRampToValueAtTime(300, start + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.master!);
    src.start(start);
    src.stop(start + duration);
  }

  private buildNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

export const sfx = new SfxEngine();
