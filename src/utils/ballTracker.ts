let worker: Worker | null = null;
let onInitResolve: (() => void) | null = null;
let onFrameResolve: ((result: any) => void) | null = null;

export async function initializeTracker(): Promise<void> {
  if (worker) return;

  return new Promise((resolve) => {
    onInitResolve = resolve;
    worker = new Worker('/workers/tracker.worker.js');

    worker.onmessage = (e) => {
      const { type, result, error } = e.data;
      if (type === 'INIT_DONE' && onInitResolve) {
        console.log("⚽ Background Tracker Worker Ready.");
        onInitResolve();
      } else if (type === 'FRAME_DONE' && onFrameResolve) {
        onFrameResolve(result);
      } else if (type === 'ERROR') {
        console.error("Worker error:", error);
      }
    };

    worker.postMessage({ type: 'INIT' });
  });
}

function preprocess(ctx: CanvasRenderingContext2D): Float32Array {
  const imgData = ctx.getImageData(0, 0, 640, 640);
  const { data } = imgData;
  const floatData = new Float32Array(3 * 640 * 640);
  const imageSize = 640 * 640;
  
  for (let i = 0; i < imageSize; i++) {
    floatData[i] = data[i * 4] / 255.0;
    floatData[imageSize + i] = data[i * 4 + 1] / 255.0;
    floatData[2 * imageSize + i] = data[i * 4 + 2] / 255.0;
  }
  return floatData;
}

export async function trackBallFrame(
  videoElement: HTMLVideoElement, 
  displayWidth: number, 
  displayHeight: number
): Promise<any> {
  await initializeTracker();
  if (!worker) return null;

  // Render video frame onto an offscreen canvas to extract pixels
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoElement, 0, 0, 640, 640);

  const floatData = preprocess(ctx);

  return new Promise((resolve) => {
    onFrameResolve = resolve;
    // Ship raw pixel buffers to background processing worker
    worker?.postMessage({
      type: 'PROCESS_FRAME',
      data: { floatData, width: displayWidth, height: displayHeight }
    });
  });
}