import * as Tone from 'tone';

class AudioEngine {
  private polySynth: Tone.PolySynth | null = null;
  private synthLoop: Tone.Loop | null = null;
  public streamDestination: MediaStreamAudioDestinationNode | null = null;
  private isInitialized = false;

  /**
   * Initializes the Web Audio Context, sets up orchestral synths,
   * and creates a media stream routing node for the final recording download.
   */
  public async init() {
    if (this.isInitialized) return;

    // 1. Wait for Tone.js to start its audio context
    await Tone.start();

    // 2. Safely cast Tone's raw context to a standard browser AudioContext to fix TS(2339)
    const rawContext = Tone.getContext().rawContext as AudioContext;

    if (!rawContext.createMediaStreamDestination) {
      throw new Error("This browser environment does not support MediaStream audio generation.");
    }

    this.streamDestination = rawContext.createMediaStreamDestination();

    // 3. Create a lush, orchestral-like PolySynth (Simulating a string ensemble)
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' }, // Soft, warm tone like woodwinds/strings
      envelope: {
        attack: 0.2,  // Smooth orchestral swell
        decay: 0.3,
        sustain: 0.6,
        release: 0.8  // Orchestral resonance
      }
    });

    // 4. Route audio to BOTH the speakers (destination) AND our recorder stream node
    this.polySynth.disconnect();
    this.polySynth.toDestination(); // Audio out to speakers
    this.polySynth.connect(this.streamDestination); // Audio out to MediaRecorder pipeline

    // 5. Build an arpeggiated loop that acts as our musical metronome
    const notes = ["C4", "E4", "G4", "B4"];
    let noteIndex = 0;

    this.synthLoop = new Tone.Loop((time) => {
      if (!this.polySynth) return;
      
      const currentNote = notes[noteIndex % notes.length];
      // Trigger note with a soft velocity (0.4) so it sounds pleasant
      this.polySynth.triggerAttackRelease(currentNote, "8n", time, 0.4);
      noteIndex++;
    }, "8n"); // Plays eighth notes

    // Start the transport timeline, but keep default tempo stable initially
    Tone.getTransport().bpm.value = 100;
    this.synthLoop.start(0);
    
    this.isInitialized = true;
    console.log("🎻 Audio Engine & Orchestral Synthesizers loaded successfully.");
  }

  /**
   * Starts playing the generative background track.
   */
  public start() {
    if (!this.isInitialized) return;
    Tone.getTransport().start();
  }

  /**
   * Pauses the track performance.
   */
  public stop() {
    if (!this.isInitialized) return;
    Tone.getTransport().stop();
  }

  /**
   * Core logic to map ball velocity into tempo modifications.
   */
  public updateTempoFromVelocity(dx: number, dy: number): number {
    if (!this.isInitialized) return Tone.getTransport().bpm.value;

    // Calculate Euclidean distance (pixels traveled per frame)
    const velocity = Math.sqrt(dx * dx + dy * dy);

    // Map velocity to musical limits
    // Min tempo: 60 BPM (Adagio / slow walk)
    // Max tempo: 210 BPM (Prestissimo / fast breakaway sprint)
    const minBpm = 60;
    const maxBpm = 210;
    
    // Scale factor: adjusts how sensitive the music is to ball movements
    const sensitivity = 3.5; 
    const targetBpm = Math.min(maxBpm, Math.max(minBpm, minBpm + (velocity * sensitivity)));

    // Smooth the transition slightly so the audio doesn't snap unnaturally
    const currentBpm = Tone.getTransport().bpm.value;
    const smoothedBpm = currentBpm + (targetBpm - currentBpm) * 0.3;

    const finalBpm = Math.round(smoothedBpm);
    Tone.getTransport().bpm.value = finalBpm;
    
    return finalBpm;
  }

  /**
   * Clean up nodes if component unmounts.
   */
  public dispose() {
    this.synthLoop?.dispose();
    this.polySynth?.dispose();
    this.isInitialized = false;
  }
}

// Export a single instance to be shared easily across components
export const audioEngine = new AudioEngine();