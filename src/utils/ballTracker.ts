// Define global window interface so TypeScript knows about the dynamically loaded ORT engine
declare global {
  interface Window {
    ort?: any;
  }
}

let session: any = null;

/**
 * Dynamically injects the production-ready ONNX Runtime script into the page.
 * This completely circumvents Next.js/Webpack compilation and proxy bugs.
 */
async function loadOrtScript(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (window.ort) return window.ort;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/ort.min.js';
    script.async = true;
    
    script.onload = () => {
      if (window.ort) {
        // Direct the dynamic engine to fetch standard WebAssembly runtime layers cleanly via CDN
        window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/';
        resolve(window.ort);
      } else {
        reject(new Error("ONNX Runtime script loaded, but window.ort is undefined."));
      }
    };
    
    script.onerror = () => reject(new Error("Failed to script-inject ONNX Runtime CDN."));
    document.head.appendChild(script);
  });
}

/**
 * Initializes the ONNX Runtime Session using the browser window's global library context.
 */
export async function initializeTracker(): Promise<any> {
  if (session) return session;

  try {
    const ort = await loadOrtScript();
    const modelUrl = '/models/yolov8n.onnx'; 
    
    // Direct string paths now work perfectly because Webpack bundle processing is bypassed!
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
    });
    
    console.log("⚽ Soccer Tracker initialized successfully via global script engine.");
    return session;
  } catch (error) {
    console.error("Failed to load the ONNX model:", error);
    throw error;
  }
}

/**
 * Preprocesses a 640x640 HTML Canvas frame into a Float32 Tensor expected by YOLO.
 */
function preprocess(ctx: CanvasRenderingContext2D): Float32Array {
  const imgData = ctx.getImageData(0, 0, 640, 640);
  const { data } = imgData;
  
  const floatData = new Float32Array(3 * 640 * 640);
  const imageSize = 640 * 640;
  
  for (let i = 0; i < imageSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;
    
    // Convert split channels into RRR... GGG... BBB... (CHW Format)
    floatData[i] = r;
    floatData[imageSize + i] = g;
    floatData[2 * imageSize + i] = b;
  }
  
  return floatData;
}

/**
 * Runs inference on the current canvas frame and tracks the soccer ball's [x, y] coordinates.
 */
export async function trackBallFrame(canvas: HTMLCanvasElement): Promise<[number, number] | null> {
  const ort = await loadOrtScript();
  const currentSession = await initializeTracker();
  const ctx = canvas.getContext('2d');
  if (!ctx || !ort) return null;

  // 1. Convert canvas visuals into a valid ONNX Tensor matrix shape
  const preprocessedData = preprocess(ctx);
  const inputTensor = new ort.Tensor('float32', preprocessedData, [1, 3, 640, 640]);

  // 2. Execute detection layer
  const outputs = await currentSession.run({ images: inputTensor });
  
  const outputKey = currentSession.outputNames[0];
  const outputTensor = outputs[outputKey];
  const data = outputTensor.data as Float32Array;

  let bestScore = 0.3; // Minimum confidence limit
  let ballCoordinates: [number, number] | null = null;

  const numPredictions = 8400; 
  const sportsBallClassIndex = 0; // Class 0 maps to your custom single-object soccer ball model

  // 3. Post-process tensor output indices to catch highest confidence bounding box coordinates
  for (let i = 0; i < numPredictions; i++) {
    const score = data[(4 + sportsBallClassIndex) * numPredictions + i];
    if (score > bestScore) {
      bestScore = score;
      const cx = data[0 * numPredictions + i];
      const cy = data[1 * numPredictions + i];
      ballCoordinates = [cx, cy];
    }
  }

  return ballCoordinates;
}