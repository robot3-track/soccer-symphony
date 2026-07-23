import * as Tone from 'tone';

class SoccerAudioEngine {
  private synth: Tone.PolySynth | null = null;
  private sequence: Tone.Sequence | null = null;
  private isInitialized = false;

  // Exposed property for the recording utility
  public streamDestination: MediaStreamAudioDestinationNode | null = null;

  // Harmonized chord structure for algorithmic progression
  private chords = {
    cMinor: ['C3', 'Eb3', 'G3', 'Bb3', 'C4', 'Eb4', 'G4', 'Bb4'],
    fDominant: ['F3', 'A3', 'C4', 'Eb4', 'F4', 'A4', 'C5', 'Eb5'],
    bbMajor: ['Bb2', 'D3', 'F3', 'A3', 'Bb3', 'D4', 'F4', 'A4']
  };

  private currentChordSequence = ['cMinor', 'fDominant', 'bbMajor', 'fDominant'];
  private stepCounter = 0;
  private lastNoteIndex = 4;

  // Digital Shock Absorber state tracking
  private currentBpm = 100;
  private minBpm = 60;
  private maxBpm = 180;

  async init() {
    if (this.isInitialized) return;

    // Start the Tone.js context framework
    await Tone.start();

    // Typecast context to browser AudioContext to prevent Vercel compilation errors
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    this.streamDestination = rawCtx.createMediaStreamDestination();

    // Setup an adaptive polyphonic synthesizer
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.08,
        decay: 0.15,
        sustain: 0.4,
        release: 0.6
      }
    });

    // Pipe the audio engine output to speakers AND the recording pipeline
    this.synth.toDestination();
    this.synth.connect(this.streamDestination);
    this.synth.volume.value = -14; // Lowers ceiling mix headroom to prevent clipping

    // Algorithmic music generation sequencer
    this.sequence = new Tone.Sequence(
      (time) => {
        if (!this.synth) return;

        // Progress musical measures every 16 steps
        const currentChordKey = this.currentChordSequence[
          Math.floor(this.stepCounter / 16) % this.currentChordSequence.length
        ];
        const activeNotePool = this.chords[currentChordKey as keyof typeof this.chords];

        // Perform random-walk step calculation (-1, 0, or +1)
        const stepChange = Math.floor(Math.random() * 3) - 1;
        let nextIndex = this.lastNoteIndex + stepChange;

        // Structural boundaries constraint
        if (nextIndex < 0) nextIndex = 1;
        if (nextIndex >= activeNotePool.length) nextIndex = activeNotePool.length - 2;
        this.lastNoteIndex = nextIndex;

        const melodicNote = activeNotePool[nextIndex];

        // Downbeat structural bass note injection every 8 steps
        if (this.stepCounter % 8 === 0) {
          const bassNote = activeNotePool[0].replace('3', '2').replace('4', '2');
          this.synth.triggerAttackRelease([bassNote, melodicNote], '4n', time);
        } else if (this.stepCounter % 2 === 0 || Math.random() > 0.4) {
          // Syncopated sixteenth notes melody engine
          this.synth.triggerAttackRelease(melodicNote, '16n', time);
        }

        this.stepCounter++;
      },
      ['step'],
      '16n'
    );

    Tone.getTransport().bpm.value = this.currentBpm;
    this.isInitialized = true;
  }

  start() {
    if (!this.isInitialized) return;
    Tone.getTransport().start();
    this.sequence?.start(0);
  }

  stop() {
    if (!this.isInitialized) return;
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.synth?.releaseAll();
  }

  setBpm(targetBpm: number) {
    if (!this.isInitialized) return;
    const boundedBpm = Math.max(this.minBpm, Math.min(this.maxBpm, targetBpm));
    Tone.getTransport().bpm.rampTo(boundedBpm, 0.1);
  }

  /**
   * Translates player pixel velocities into a smoothed musical tempo
   * Applies Exponential Damping: 93% previous state + 7% current state
   */
  updateTempoFromVelocity(dx: number, dy: number) {
    if (!this.isInitialized) return this.currentBpm;

    // Calculate raw distance magnitude
    const velocityMagnitude = Math.sqrt(dx * dx + dy * dy);

    // Map pixel movements (e.g. 0-50px) to baseline musical bpm range
    const rawTargetBpm = this.minBpm + (velocityMagnitude * 2.5);

    // Apply digital shock absorber smoothing filter
    this.currentBpm = (this.currentBpm * 0.93) + (rawTargetBpm * 0.07);

    this.setBpm(this.currentBpm);
    return this.currentBpm;
  }

  dispose() {
    this.stop();
    this.sequence?.dispose();
    this.synth?.dispose();
    this.synth = null;
    this.sequence = null;
    this.streamDestination = null;
    this.isInitialized = false;
  }
}

export const audioEngine = new SoccerAudioEngine();