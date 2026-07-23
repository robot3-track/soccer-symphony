'use client';

import { useState, useRef, useEffect } from 'react';
import { initializeTracker, trackBallFrame } from '@/utils/ballTracker';
import { audioEngine } from '@/utils/audioEngine';
import { startCombinedRecording, stopCombinedRecording } from '@/utils/recorder';

export default function SoccerSymphony() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  
  const lastPosition = useRef<[number, number] | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    initializeTracker()
      .then(() => setIsModelLoading(false))
      .catch((err) => console.error("Error loading model:", err));

    return () => {
      audioEngine.dispose();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  const processFrameLoop = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 640, 640);

    try {
      const currentPos = await trackBallFrame(canvas);

      if (currentPos) {
        ctx.beginPath();
        ctx.arc(currentPos[0], currentPos[1], 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#2563eb'; // Clean standard blue tracking dot
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (lastPosition.current) {
          const dx = currentPos[0] - lastPosition.current[0];
          const dy = currentPos[1] - lastPosition.current[1];
          const newBpm = audioEngine.updateTempoFromVelocity(dx, dy);
          setBpm(newBpm);
        }
        lastPosition.current = currentPos;
      }
    } catch (err) {
      console.error("Frame processing error:", err);
    }

    animationFrameId.current = requestAnimationFrame(processFrameLoop);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
      setIsPlaying(false);
      lastPosition.current = null;
    }
  };

  const handlePlayToggle = async () => {
    if (!videoRef.current) return;

    if (!isPlaying) {
      await audioEngine.init();
      audioEngine.start();
      videoRef.current.play();
      setIsPlaying(true);
      animationFrameId.current = requestAnimationFrame(processFrameLoop);
    } else {
      audioEngine.stop();
      videoRef.current.pause();
      setIsPlaying(false);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
  };

  const handleRecordingToggle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isRecording) {
      startCombinedRecording(canvas);
      setIsRecording(true);
    } else {
      stopCombinedRecording();
      setIsRecording(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        
        {/* Simple Header */}
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Soccer Symphony Lab</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload a video to see how the computer tracks the ball and translates speed into music tempo.
          </p>
          <div className="mt-2 text-xs font-medium text-slate-600">
            Status: {isModelLoading ? '⏳ Loading AI tracker engine...' : '✅ System Ready'}
          </div>
        </header>

        {/* Video Area */}
        <div className="relative aspect-video w-full bg-slate-100 border border-slate-200 rounded-md overflow-hidden flex items-center justify-center">
          {videoSrc ? (
            <>
              <video 
                ref={videoRef} 
                src={videoSrc} 
                className="w-full h-full object-contain"
                loop
                muted
                playsInline
              />
              <canvas 
                ref={canvasRef} 
                width={640} 
                height={640} 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
              />
            </>
          ) : (
            <div className="text-center p-6">
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleVideoUpload} 
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="text-xs text-slate-400 mt-2">Select any standard .mp4 video clip containing a soccer ball.</p>
            </div>
          )}
        </div>

        {/* Action Controls & Simple Metrics Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
          
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePlayToggle}
              disabled={!videoSrc || isModelLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-sm rounded-md transition"
            >
              {isPlaying ? '⏸️ Pause Video' : '▶️ Play & Track'}
            </button>

            <button
              onClick={handleRecordingToggle}
              disabled={!isPlaying}
              className={`px-4 py-2 font-medium text-sm rounded-md transition ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800 disabled:opacity-40'
              }`}
            >
              {isRecording ? '⏹️ Stop & Download WebM' : '⏺️ Record Output'}
            </button>
          </div>

          {/* Clean Metric Readout */}
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-md flex justify-between items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Live Music Tempo</div>
              <div className="text-3xl font-bold font-mono text-blue-600 mt-0.5">{bpm} <span className="text-sm font-normal text-slate-600">BPM</span></div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Engine: YOLOv9 WebAssembly</div>
              <div>Audio: Tone.js Instrument</div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}