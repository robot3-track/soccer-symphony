importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/ort.min.js');

let session = null;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/';

self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'INIT') {
    try {
      session = await ort.InferenceSession.create('/models/yolov8n.onnx', {
        executionProviders: ['wasm']
      });
      self.postMessage({ type: 'INIT_DONE' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }

  if (type === 'PROCESS_FRAME') {
    if (!session) return;
    try {
      const { floatData, width, height } = data;
      const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);
      const outputs = await session.run({ images: inputTensor });
      
      const outputKey = session.outputNames[0];
      const outputData = outputs[outputKey].data;

      const confidenceThreshold = 0.35; 
      const numPredictions = 8400; 
      const personClassIndex = 0; // standard COCO layout index for Person

      const players = [];
      let totalX = 0;
      let totalY = 0;

      const scaleX = width / 640;
      const scaleY = height / 640;

      for (let i = 0; i < numPredictions; i++) {
        const score = outputData[(4 + personClassIndex) * numPredictions + i];
        
        if (score > confidenceThreshold) {
          const cx = outputData[0 * numPredictions + i] * scaleX;
          const cy = outputData[1 * numPredictions + i] * scaleY;
          const w = outputData[2 * numPredictions + i] * scaleX;
          const h = outputData[3 * numPredictions + i] * scaleY;

          // Prevent pixel duplicate noise artifacts
          const isDuplicate = players.some(p => Math.abs(p.bbox[0] - cx) < 30 && Math.abs(p.bbox[1] - cy) < 30);
          
          if (!isDuplicate) {
            players.push({ bbox: [cx, cy, w, h] });
            totalX += cx;
            totalY += cy;
          }
        }
      }

      const avgCenter = players.length > 0 ? [totalX / players.length, totalY / players.length] : null;

      self.postMessage({
        type: 'FRAME_DONE',
        result: { players, avgCenter }
      });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};