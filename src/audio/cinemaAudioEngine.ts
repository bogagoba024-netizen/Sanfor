import type { AudioMixerState, MusicTheme } from '../types/cinema';

class CinemaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private customBuffer: AudioBuffer | null = null;
  private customSource: AudioBufferSourceNode | null = null;

  private isPlaying = false;
  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;

  private lastBeatTime = -10;
  private lastSceneIndex = -1;
  private triggeredCues = new Set<string>();

  private mixer: AudioMixerState = {
    theme: 'rome_epic',
    masterVolume: 0.85,
    musicVolume: 0.78,
    sfxVolume: 0.88,
    crowdVolume: 0.55,
    muted: false,
    customTrackName: null,
  };

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.crowdGain = this.ctx.createGain();
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.34;

      this.reverbNode = this.createHallReverb(this.ctx, 2.2, 2.6);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 3.0);

      this.musicGain.connect(compressor);
      this.sfxGain.connect(compressor);
      this.crowdGain.connect(compressor);

      this.musicGain.connect(this.reverbSend);
      this.sfxGain.connect(this.reverbSend);
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(compressor);

      compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.exportDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.exportDest);

      this.applyMixerLevels();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createHallReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  public updateMixer(next: AudioMixerState): void {
    const themeChanged = this.mixer.theme !== next.theme;
    this.mixer = { ...next };
    this.applyMixerLevels();

    if (themeChanged && this.isPlaying) {
      this.stopMusicSource();
      if (this.mixer.theme === 'custom' && this.customBuffer) {
        this.startCustomTrack(0);
      }
    }
  }

  private applyMixerLevels(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain || !this.crowdGain) return;
    const now = this.ctx.currentTime;
    const master = this.mixer.muted ? 0 : this.mixer.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.mixer.musicVolume, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.mixer.sfxVolume, now, 0.03);
    this.crowdGain.gain.setTargetAtTime(this.mixer.crowdVolume, now, 0.03);
  }

  public async loadCustomAudio(file: File): Promise<string> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.customBuffer = await ctx.decodeAudioData(arrayBuffer);
    return file.name;
  }

  public getExportStream(): MediaStream | null {
    this.ensureContext();
    return this.exportDest ? this.exportDest.stream : null;
  }

  public startPlayback(offsetSeconds = 0): void {
    const ctx = this.ensureContext();
    this.isPlaying = true;
    this.currentStep = Math.floor(offsetSeconds * 4);
    this.nextStepTime = ctx.currentTime + 0.04;
    this.triggeredCues.clear();
    this.lastSceneIndex = -1;

    if (this.mixer.theme === 'custom' && this.customBuffer) {
      this.startCustomTrack(offsetSeconds);
    }

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
    }
    this.schedulerTimer = window.setInterval(() => this.scheduleMusic(), 45);
  }

  public stopPlayback(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.stopMusicSource();
  }

  public resetTimelineCues(): void {
    this.triggeredCues.clear();
    this.lastSceneIndex = -1;
  }

  private startCustomTrack(offsetSeconds: number): void {
    if (!this.ctx || !this.musicGain || !this.customBuffer) return;
    this.stopMusicSource();
    const source = this.ctx.createBufferSource();
    source.buffer = this.customBuffer;
    source.loop = true;
    const offset = offsetSeconds % Math.max(1, this.customBuffer.duration);
    source.connect(this.musicGain);
    source.start(0, offset);
    this.customSource = source;
  }

  private stopMusicSource(): void {
    if (this.customSource) {
      try {
        this.customSource.stop();
      } catch {
        // already stopped
      }
      this.customSource.disconnect();
      this.customSource = null;
    }
  }

  public getBeatPulse(): number {
    if (!this.ctx || !this.isPlaying) return 0;
    const elapsed = this.ctx.currentTime - this.lastBeatTime;
    if (elapsed < 0 || elapsed > 0.35) return 0;
    return Math.pow(1 - elapsed / 0.35, 2.2);
  }

  public syncTimelineEvents(progress: number, sceneIndex: number): void {
    if (!this.isPlaying) return;

    // Scene transition impact
    if (this.lastSceneIndex !== -1 && sceneIndex !== this.lastSceneIndex) {
      this.playWhoosh();
      this.playBassDrop();
      this.playCrowdRoar(2.4, 0.72);
    }
    this.lastSceneIndex = sceneIndex;

    const triggerOnce = (key: string, fn: () => void) => {
      if (!this.triggeredCues.has(key)) {
        this.triggeredCues.add(key);
        fn();
      }
    };

    if (progress >= 0.01 && progress < 0.06) {
      triggerOnce('kickoff', () => {
        this.playWhistle();
        this.playCrowdRoar(3.2, 0.65);
      });
    }
    if (progress >= 0.16 && progress < 0.22) {
      triggerOnce('flash1', () => this.playFlashBurst());
    }
    if (progress >= 0.42 && progress < 0.48) {
      triggerOnce('flash2', () => this.playFlashBurst());
    }
    if (progress >= 0.70 && progress < 0.76) {
      triggerOnce('heart1', () => this.playHeartbeat());
    }
    if (progress >= 0.80 && progress < 0.86) {
      triggerOnce('heart2', () => {
        this.playHeartbeat();
        this.playCrowdRoar(3.0, 0.8);
      });
    }
    if (progress >= 0.92 && progress < 0.97) {
      triggerOnce('finale', () => {
        this.playBassDrop();
        this.playSecretChime();
      });
    }
  }

  private scheduleMusic(): void {
    if (!this.isPlaying || !this.ctx || !this.musicGain) return;
    if (this.mixer.theme === 'custom' && this.customBuffer) return;

    const bpm = this.getThemeBpm(this.mixer.theme);
    const stepDuration = 60 / bpm / 2; // eighth-note steps

    while (this.nextStepTime < this.ctx.currentTime + 0.14) {
      this.playMusicStep(this.currentStep, this.nextStepTime, stepDuration, this.mixer.theme);
      this.nextStepTime += stepDuration;
      this.currentStep++;
    }
  }

  private getThemeBpm(theme: MusicTheme): number {
    switch (theme) {
      case 'berlin_adrenaline':
        return 118;
      case 'farewell_nostalgia':
        return 78;
      case 'rome_epic':
      default:
        return 98;
    }
  }

  private playMusicStep(step: number, time: number, stepDur: number, theme: MusicTheme): void {
    if (!this.ctx || !this.musicGain) return;

    // 4-bar chord progressions in Hz (D minor / F major epic Roman stadium harmony)
    const bar = Math.floor(step / 8) % 4;
    const stepInBar = step % 8;

    const progressions: Record<Exclude<MusicTheme, 'custom'>, { bass: number[]; chords: number[][]; lead: number[] }> = {
      rome_epic: {
        // Dm -> Bb -> Gm -> A7
        bass: [73.42, 58.27, 49.00, 55.00],
        chords: [
          [293.66, 349.23, 440.0],
          [233.08, 293.66, 349.23],
          [196.0, 233.08, 293.66],
          [220.0, 277.18, 329.63],
        ],
        lead: [587.33, 659.25, 698.46, 587.33, 523.25, 440.0, 493.88, 554.37],
      },
      berlin_adrenaline: {
        // Em -> C -> G -> D
        bass: [82.41, 65.41, 98.00, 73.42],
        chords: [
          [329.63, 392.0, 493.88],
          [261.63, 329.63, 392.0],
          [392.0, 493.88, 587.33],
          [293.66, 369.99, 440.0],
        ],
        lead: [659.25, 783.99, 987.77, 783.99, 659.25, 587.33, 659.25, 739.99],
      },
      farewell_nostalgia: {
        // Am -> F -> C -> G
        bass: [55.0, 43.65, 65.41, 49.0],
        chords: [
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [261.63, 329.63, 392.0],
          [196.0, 246.94, 293.66],
        ],
        lead: [440.0, 523.25, 659.25, 587.33, 523.25, 493.88, 440.0, 392.0],
      },
    };

    const preset = progressions[theme === 'custom' ? 'rome_epic' : theme];
    const bassFreq = preset.bass[bar];
    const chord = preset.chords[bar];

    // Kick drum / War Taiko on beat 0 and 4 (plus driving beat on adrenaline)
    const isKick =
      theme === 'farewell_nostalgia'
        ? stepInBar === 0 || stepInBar === 3
        : theme === 'berlin_adrenaline'
          ? stepInBar === 0 || stepInBar === 2 || stepInBar === 4 || stepInBar === 6
          : stepInBar === 0 || stepInBar === 3 || stepInBar === 4;

    if (isKick) {
      this.synthTaikoKick(time, theme === 'farewell_nostalgia' ? 0.35 : 0.65);
      if (stepInBar === 0 || stepInBar === 4) {
        this.lastBeatTime = time;
      }
    }

    // Crisp rim/snare pulse
    if (theme !== 'farewell_nostalgia' && (stepInBar === 2 || stepInBar === 6 || (theme === 'rome_epic' && stepInBar === 7))) {
      this.synthStadiumSnare(time, stepInBar === 7 ? 0.14 : 0.22);
    }

    // Warm Pad Chord at bar start
    if (stepInBar === 0) {
      this.synthStringPad(chord, time, stepDur * 7.8, theme === 'farewell_nostalgia' ? 0.15 : 0.19);
      this.synthSubBass(bassFreq, time, stepDur * 7.5, 0.32);
    }

    // Rhythmic Cello/Arp pulse
    if (theme === 'berlin_adrenaline' || stepInBar % 2 === 0) {
      const arpNote = chord[stepInBar % chord.length];
      this.synthPluck(arpNote, time, stepDur * 0.9, theme === 'farewell_nostalgia' ? 0.08 : 0.11);
    }

    // Emotional Lead Melody (half-bar phrasing)
    if (stepInBar === 0 || stepInBar === 4) {
      const leadIdx = (bar * 2 + (stepInBar === 4 ? 1 : 0)) % preset.lead.length;
      const leadFreq = preset.lead[leadIdx];
      this.synthHeroLead(leadFreq, time, stepDur * 3.6, theme === 'berlin_adrenaline' ? 0.14 : 0.16);
    }
  }

  private synthTaikoKick(time: number, amp: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.14);

    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  private synthStadiumSnare(time: number, amp: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, time);
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.14);
  }

  private synthSubBass(freq: number, time: number, dur: number, amp: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.15);
    gain.gain.setValueAtTime(amp * 0.85, time + dur - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private synthStringPad(freqs: number[], time: number, dur: number, amp: number): void {
    if (!this.ctx || !this.musicGain) return;
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * (idx === 1 ? 1.003 : 0.998), time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, time);
      filter.frequency.linearRampToValueAtTime(1600, time + dur * 0.5);
      filter.frequency.linearRampToValueAtTime(850, time + dur);

      const perVoice = amp / freqs.length;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(perVoice, time + 0.35);
      gain.gain.setValueAtTime(perVoice * 0.85, time + dur - 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + dur + 0.06);
    });
  }

  private synthPluck(freq: number, time: number, dur: number, amp: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + dur);

    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private synthHeroLead(freq: number, time: number, dur: number, amp: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, time);
    filter.frequency.linearRampToValueAtTime(2200, time + dur * 0.35);
    filter.frequency.linearRampToValueAtTime(1100, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.14);
    gain.gain.setValueAtTime(amp * 0.78, time + dur - 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.05);
    osc2.stop(time + dur + 0.05);
  }

  // --- SYNCHRONIZED SOUND EFFECTS (SFX) ---

  public playWhistle(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const trill = ctx.createOscillator();
    const trillGain = ctx.createGain();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2820, now);
    osc2.frequency.setValueAtTime(3090, now);

    // Pea-whistle 38Hz trill modulation
    trill.type = 'sine';
    trill.frequency.setValueAtTime(38, now);
    trillGain.gain.setValueAtTime(140, now);
    trill.connect(trillGain);
    trillGain.connect(osc1.frequency);
    trillGain.connect(osc2.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
    gain.gain.setValueAtTime(0.22, now + 0.38);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    trill.start(now);
    osc1.start(now);
    osc2.start(now);
    trill.stop(now + 0.58);
    osc1.stop(now + 0.58);
    osc2.stop(now + 0.58);
  }

  public playCrowdRoar(duration = 2.6, intensity = 0.7): void {
    const ctx = this.ensureContext();
    if (!this.crowdGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(480, now);
    bp1.frequency.linearRampToValueAtTime(760, now + duration * 0.45);
    bp1.Q.value = 0.9;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.setValueAtTime(1250, now);
    bp2.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.55, now + duration * 0.28);
    gain.gain.setValueAtTime(intensity * 0.48, now + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp1);
    src.connect(bp2);
    bp1.connect(gain);
    bp2.connect(gain);
    gain.connect(this.crowdGain);

    src.start(now);
    src.stop(now + duration + 0.05);
  }

  public playBassDrop(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.95);

    oscHarm.type = 'sawtooth';
    oscHarm.frequency.setValueAtTime(73.42, now);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(600, now);
    lpf.frequency.exponentialRampToValueAtTime(140, now + 0.9);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    osc.connect(gain);
    oscHarm.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    oscHarm.start(now);
    osc.stop(now + 1.1);
    oscHarm.stop(now + 1.1);
  }

  public playWhoosh(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
    filter.frequency.exponentialRampToValueAtTime(350, now + 0.55);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    src.start(now);
    src.stop(now + 0.6);
  }

  public playFlashBurst(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Shutter click
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 3200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    src.connect(hpf);
    hpf.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.09);

    // Subtle shimmer
    const chime = ctx.createOscillator();
    const cGain = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(2200, now);
    chime.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
    cGain.gain.setValueAtTime(0.08, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    chime.connect(cGain);
    cGain.connect(this.sfxGain);
    chime.start(now);
    chime.stop(now + 0.25);
  }

  public playHeartbeat(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const now = ctx.currentTime;

    const thump = (start: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, start);
      osc.frequency.exponentialRampToValueAtTime(32, start + 0.16);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.26);
    };

    thump(now, 0.72);
    thump(now + 0.24, 0.48);
  }

  public playSecretChime(): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5 F#5 A5 D6

    notes.forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.68);
    });
  }
}

export const cinemaAudioEngine = new CinemaAudioEngine();
