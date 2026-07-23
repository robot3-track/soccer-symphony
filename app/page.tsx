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
  const [activePlayerCount, setActivePlayerCount] = useState(0);
  
  const lastCenter = useRef<[number, number] | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const currentDetections = useRef<any>(null);
  const isProcessing = useRef<boolean>(false);
  
  // Telemetry shock-absorber registers
  const lastProcessedTime = useRef<number>(performance.now());
  const smoothBpm = useRef<number>(100);

  useEffect(() => {
    initializeTracker()
      .then(() => setIsModelLoading(false))
      .catch((err) => console.error("Error loading worker thread:", err));

    return () => {
      audioEngine.dispose();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  const renderLoop = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Paint the raw camera layer onto screen instantly at full fluid 60fps
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Asynchronous background delegation thread pipeline
    if (!isProcessing.current) {
      isProcessing.current = true;
      trackBallFrame(video, canvas.width, canvas.height).then((result) => {
        if (result) {
          currentDetections.current = result;
          setActivePlayerCount(result.players.length);

          if (result.avgCenter && lastCenter.current) {
            const now = performance.now();
            const timeDelta = (now - lastProcessedTime.current) / 1000; // time in seconds
            lastProcessedTime.current = now;

            if (timeDelta > 0) {
              const dx = result.avgCenter[0] - lastCenter.current[0];
              const dy = result.avgCenter[1] - lastCenter.current[1];
              
              // Calculate spatial pixel movement magnitude
              const distance = Math.sqrt(dx * dx + dy * dy);

              // 🚨 THE TELEMETRY GATE: Reject camera pans or massive tracking switches (> 120px)
              if (distance < 120) {
                const rawVelocity = distance / timeDelta;

                // Convert velocity to an organic, safe musical threshold (80 - 140 BPM)
                const targetBpm = Math.min(140, Math.max(80, 95 + rawVelocity * 0.03));

                // Ultra-smooth cinematic damping dampener (93% historical retention)
                smoothBpm.current = smoothBpm.current * 0.93 + targetBpm * 0.07;
              } else {
                // Decay target down to baseline gracefully upon chaotic tracking transitions
                smoothBpm.current = smoothBpm.current * 0.95 + 100 * 0.05;
              }
              
              const finalBpm = Math.round(smoothBpm.current);
              
              // Direct tempo delivery pipeline over Tone.js master clock
              audioEngine.setBpm(finalBpm);
              setBpm(finalBpm);
            }
          } else {
            lastProcessedTime.current = performance.now();
          }
          if (result.avgCenter) lastCenter.current = result.avgCenter;
        }
        isProcessing.current = false;
      });
    }

    // Process tracking visualizations cleanly on top of the live video buffer stream
    if (currentDetections.current) {
      const { players, avgCenter } = currentDetections.current;

      ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
      ctx.lineWidth = 2;
      players.forEach((player: any) => {
        const [x, y, w, h] = player.bbox;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      });

      if (avgCenter) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(avgCenter[0] - 15, avgCenter[1]); ctx.lineTo(avgCenter[0] + 15, avgCenter[1]);
        ctx.moveTo(avgCenter[0], avgCenter[1] - 15); ctx.lineTo(avgCenter[0], avgCenter[1] + 15);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(avgCenter[0], avgCenter[1], 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }
    }

    animationFrameId.current = requestAnimationFrame(renderLoop);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
      setIsPlaying(false);
      lastCenter.current = null;
      currentDetections.current = null;
      smoothBpm.current = 100;
      setBpm(100);
    }
  };

  const handlePlayToggle = async () => {
    if (!videoRef.current) return;

    if (!isPlaying) {
      await audioEngine.init();
      audioEngine.start();
      videoRef.current.play();
      setIsPlaying(true);
      lastProcessedTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(renderLoop);
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
        
        <header className="border-b border-slate-200 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Soccer Symphony</h1>
            <p className="text-sm text-slate-500 mt-1">Asynchronous tracking interface.</p>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {isModelLoading ? '⏳ Loading Thread...' : '✅ Thread Ready'}
          </div>
        </header>

        <div className="relative w-full bg-slate-900 border border-slate-200 rounded-md overflow-hidden flex items-center justify-center min-h-[440px]">
          {videoSrc ? (
            <div className="relative max-w-full max-h-[600px] w-full h-full flex items-center justify-center">
              <video 
                ref={videoRef} 
                src={videoSrc} 
                className="absolute opacity-0 pointer-events-none w-full h-full"
                loop
                muted
                playsInline
              />
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-[600px] w-auto h-auto object-contain bg-slate-950 shadow-inner" 
              />
            </div>
          ) : (
            <div className="text-center p-6 bg-white w-full py-24">
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleVideoUpload} 
                className="block mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 border border-slate-200 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayToggle}
              disabled={!videoSrc || isModelLoading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-md shadow-sm transition"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Track Match'}
            </button>

            <button
              onClick={handleRecordingToggle}
              disabled={!isPlaying}
              className={`px-5 py-2.5 font-semibold text-sm rounded-md shadow-sm transition ${
                isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              {isRecording ? '⏹️ Stop' : '⏺️ Record'}
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Nodes Checked</span>
              <span className="text-2xl font-extrabold font-mono text-slate-700">{activePlayerCount}</span>
            </div>
            <div className="text-right border-l border-slate-200 pl-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Tempo Balance</span>
              <span className="text-2xl font-extrabold font-mono text-blue-600">{bpm} <span className="text-sm font-normal text-slate-500">BPM</span></span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}