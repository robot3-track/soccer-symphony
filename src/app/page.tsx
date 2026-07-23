'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Upload, Activity, Music } from 'lucide-react';
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

  // 1. Warm up the ONNX Model when the app starts
  useEffect(() => {
    initializeTracker()
      .then(() => setIsModelLoading(false))
      .catch((err) => console.error("Error loading ONNX engine:", err));

    return () => {
      audioEngine.dispose();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // 2. Continuous frame-by-frame processing pipeline
  const processFrameLoop = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // A. Draw current video frame onto processing canvas (scaled to YOLOv8 size)
    ctx.drawImage(video, 0, 0, 640, 640);

    try {
      // B. Run ONNX Inference to find the soccer ball
      const currentPos = await trackBallFrame(canvas);

      if (currentPos) {
        // Draw visual tracking dot over the ball on screen
        ctx.beginPath();
        ctx.arc(currentPos[0], currentPos[1], 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#10b981'; // Emerald dot
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // C. Calculate frame velocity & update synth tempo if we have a history
        if (lastPosition.current) {
          const dx = currentPos[0] - lastPosition.current[0];
          const dy = currentPos[1] - lastPosition.current[1];
          const newBpm = audioEngine.updateTempoFromVelocity(dx, dy);
          setBpm(newBpm);
        }
        lastPosition.current = currentPos;
      }
    } catch (err) {
      console.error("Inference frame error:", err);
    }

    // Continue the processing loop
    animationFrameId.current = requestAnimationFrame(processFrameLoop);
  };

  // Handle local video uploads
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
      lastPosition.current = null;
    }
  };

  // Play / Sync trigger
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

  // Recording management wrapper
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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-emerald-500">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-2">
              ⚽ Soccer Symphony 🎻
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Translating pitch velocity into dynamic orchestral movements in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-slate-400">
              {isModelLoading ? 'Warming up WASM Runtime...' : 'YOLOv8 Inference Engine Ready'}
            </span>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Workspace (Player and Processing Overlay) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group">
              {videoSrc ? (
                <>
                  <video 
                    ref={videoRef} 
                    src={videoSrc} 
                    className="w-full h-full object-contain pointer-events-none"
                    loop
                    muted
                    playsInline
                  />
                  {/* Invisible structural processing layer */}
                  <canvas 
                    ref={canvasRef} 
                    width={640} 
                    height={640} 
                    className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none opacity-80" 
                  />
                </>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition p-4">
                  <Upload className="w-12 h-12 text-slate-500 mb-3" />
                  <span className="text-sm font-medium text-slate-300">Upload a soccer match clip</span>
                  <span className="text-xs text-slate-500 mt-1">MP4 or WebM formats supported</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Application Control Deck */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handlePlayToggle}
                disabled={!videoSrc || isModelLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 px-5 py-2.5 rounded-xl text-sm font-semibold shadow transition"
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlaying ? 'Pause Tracker' : 'Start Symphony'}
              </button>

              <button
                onClick={handleRecordingToggle}
                disabled={!isPlaying}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow transition ${
                  isRecording 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50'
                }`}
              >
                <Download className="w-4 h-4" />
                {isRecording ? 'Compile & Save (.webm)' : 'Record Performance'}
              </button>
            </div>
          </div>

          {/* Telemetry and Soundscape Analytics Panel */}
          <div className="space-y-4">
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center h-48 relative overflow-hidden">
              <div className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Music className="w-3.5 h-3.5" /> METRONOME STATUS
              </div>
              <span className="text-7xl font-black font-mono tracking-tighter text-emerald-400">
                {bpm}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mt-2">
                Live Dynamic BPM
              </span>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-mono font-bold text-slate-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-teal-400" /> SYSTEM TELEMETRY
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500">Video Sample Window</span>
                  <span className="font-mono text-slate-300">640 × 640px</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500">Audio Synth Matrix</span>
                  <span className="font-mono text-slate-300">Tone.js (PolySynth)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Pipeline Class</span>
                  <span className="font-mono text-emerald-400 font-bold">sports ball (32)</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}