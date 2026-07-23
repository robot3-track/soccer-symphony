import { audioEngine } from './audioEngine';

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

/**
 * Captures the HTML Canvas streams and merges them dynamically with 
 * Tone.js synthesized audio lines.
 */
export function startCombinedRecording(canvas: HTMLCanvasElement) {
  recordedChunks = [];

  // 1. Capture canvas visuals at a steady 30 frames per second
  const videoStream = canvas.captureStream(30);

  // 2. Fetch the audio stream from our initialized audio engine
  if (!audioEngine.streamDestination) {
    console.error("Audio engine stream destination is not available.");
    return;
  }
  const audioStream = audioEngine.streamDestination.stream;

  // 3. Combine visual tracks and instrument tracks into a single production media stream
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioStream.getAudioTracks()
  ]);

  // 4. Spin up the MediaRecorder API targeting a container format (.webm allows live streaming buffers)
  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9,opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    // Compile chunks into a downloadable file blob
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    // Trigger structural client-side file save
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soccer-symphony-performance.webm';
    a.click();
    
    // Cleanup temporary memory pointer
    URL.revokeObjectURL(url);
  };

  mediaRecorder.start();
  console.log("⏺️ Recording started (Video + Audio combined).");
}

/**
 * Halts recording loops and triggers the download cascade.
 */
export function stopCombinedRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log("⏹️ Recording stopped. Packaging download...");
  }
}