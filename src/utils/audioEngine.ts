import * as Tone from 'tone';

class SoccerAudioEngine {
  private synth: Tone.PolySynth | null = null;
  private sequence: Tone.Sequence | null = null;
  private isInitialized = false;

  // Harmonious pools structured by chord zones so it feels like a real composition
  private chords = {
    cMinor: ['C3', 'Eb3', 'G3', 'Bb3', 'C4', 'Eb4', 'G4', 'Bb4'],
    fDominant: ['F3', 'A3', 'C4', 'Eb4', 'F4', 'A4', 'C5', 'Eb5'],
    bbMajor: ['Bb2', 'D3', 'F3', 'A3', 'Bb3', 'D4', 'F4', 'A4']
  };

  private currentChordSequence = ['cMinor', 'fDominant', 'bbMajor', 'fDominant'];
  private stepCounter = 0;
  private lastNoteIndex = 4; // Start in the middle of the register

  async init() {
    if (this.isInitialized) return;

    await Tone.start();

    // Warm, ambient synth profile with soft attack to prevent ear fatigue
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.08,
        decay: 0.15,
        sustain: 0.4,
        release: 0.6
      }
    }).toDestination();

    this.synth.volume.value = -14;

    this.sequence = new Tone.Sequence(
      (time) => {
        if (!this.synth) return;

        // 1. Shift chords every 16 steps (one full musical bar)
        const currentChordKey = this.currentChordSequence[Math.floor(this.stepCounter / 16) % this.currentChordSequence.length];
        const activeNotePool = this.chords[currentChordKey as keyof typeof this.chords];

        // 2. Algorithmic Random Walk: Pick a next note nearby (-1, 0, or +1 index shift)
        // This keeps the melody flowing naturally instead of jumping around erratically
        const stepChange = Math.floor(Math.random() * 3) - 1; // Gives -1, 0, or 1
        let nextIndex = this.lastNoteIndex + stepChange;

        // Keep inside bounds of our pool array
        if (nextIndex < 0) nextIndex = 1;
        if (nextIndex >= activeNotePool.length) nextIndex = activeNotePool.length - 2;
        this.lastNoteIndex = nextIndex;

        const melodicNote = activeNotePool[nextIndex];

        // 3. Rhythmic Voice Texturing
        if (this.stepCounter % 8 === 0) {
          // Play a deep foundational bass pad on the structural downbeats
          const bassNote = activeNotePool[0].replace('3', '2').replace('4', '2');
          this.synth.triggerAttackRelease([bassNote, melodicNote], '4n', time);
        } else if (this.stepCounter % 2 === 0 || Math.random() > 0.4) {
          // Add rhythmic variety by leaving random empty spaces (syncopation)
          this.synth.triggerAttackRelease(melodicNote, '16n', time);
        }

        this.stepCounter++;
      },
      ['step'],
      '16n' // High-resolution sixteenth notes for responsive tempo shifts
    );

    Tone.getTransport().bpm.value = 100;
    this.isInitialized = true;
    console.log("🎵 Algorithmic Audio Engine successfully engaged.");
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
    // Smoothly shift the global clock array
    Tone.getTransport().bpm.rampTo(targetBpm, 0.1);
  }

  updateTempoFromVelocity(dx: number, dy: number) {
    return 100; // Compatibility fallback anchor
  }

  dispose() {
    this.stop();
    this.sequence?.dispose();
    this.synth?.dispose();
    this.synth = null;
    this.sequence = null;
    this.isInitialized = false;
  }
}

export const audioEngine = new SoccerAudioEngine();