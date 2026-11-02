import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, SwitchCamera, Sparkles } from 'lucide-react';
import { toast } from '../lib/toast';

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = "Capture Field Photo with Camera"
}) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (rear) or 'user' (front)
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileFallbackRef = useRef(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async (mode = facingMode) => {
    setInitializing(true);
    setError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API not supported in this browser. Please use the file upload option.");
      setInitializing(false);
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera access failed with ideal mode, trying fallback:", err);
      // Fallback without exact facingMode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr) {
        setError(`Unable to access camera: ${fallbackErr.message || 'Permission denied'}. You can still pick a photo or use your device camera file picker.`);
      }
    } finally {
      setInitializing(false);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCapturedBlob(null);
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPreview(dataUrl);

    canvas.toBlob(blob => {
      if (blob) {
        setCapturedBlob(blob);
      }
    }, 'image/jpeg', 0.92);
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setCapturedBlob(null);
    if (videoRef.current && stream) {
      videoRef.current.play().catch(() => {});
    } else {
      startCamera();
    }
  };

  const handleConfirm = () => {
    if (!capturedBlob && !capturedPreview) return;
    const filename = `camera_report_${Date.now()}.jpg`;
    const file = capturedBlob
      ? new File([capturedBlob], filename, { type: 'image/jpeg' })
      : null;

    onCapture(file, capturedPreview);
    stopStream();
    onClose();
    toast.success("Photo captured and attached to report");
  };

  const handleNativeFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onCapture(file, reader.result);
        stopStream();
        onClose();
        toast.success("Photo attached to report");
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="bg-[#071D10] border-2 border-[#249344] rounded-2xl max-w-xl w-full p-4 sm:p-5 space-y-3.5 shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#249344]/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#BDFF42]/15 border border-[#BDFF42]/40 flex items-center justify-center text-[#BDFF42]">
              <Camera size={18} />
            </div>
            <div>
              <div className="font-display text-sm sm:text-base font-bold text-white tracking-wide uppercase">
                {title}
              </div>
              <div className="text-[10px] font-mono text-[#9FD8A8]">
                Geo-tag & timestamp automatically bound to report
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1 rounded-lg text-[#9FD8A8] hover:text-white hover:bg-[#249344]/30 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder / Preview Area */}
        <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden border border-[#249344]/50 flex items-center justify-center shadow-inner">
          {initializing && (
            <div className="flex flex-col items-center gap-2 text-xs font-mono text-[#BDFF42] p-4 text-center">
              <RefreshCw size={24} className="animate-spin" />
              <span>Initializing device camera…</span>
            </div>
          )}

          {error && (
            <div className="p-4 flex flex-col items-center gap-2 text-center text-xs text-orange-200">
              <AlertCircle size={28} className="text-[#FFA31A]" />
              <div className="font-bold text-white">Camera Access Notice</div>
              <div className="text-[11px] text-[#9FD8A8] max-w-sm">{error}</div>
              <button
                type="button"
                onClick={() => fileFallbackRef.current?.click()}
                className="btn-lime mt-2 px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <Camera size={14} />
                <span>Open Device Camera / Photos</span>
              </button>
              <input
                ref={fileFallbackRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleNativeFileInput}
              />
            </div>
          )}

          {/* Live Video Stream */}
          {!capturedPreview && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${error || initializing ? 'hidden' : 'block'}`}
            />
          )}

          {/* Captured Still Preview */}
          {capturedPreview && (
            <img
              src={capturedPreview}
              alt="Captured Still"
              className="w-full h-full object-cover"
            />
          )}

          {/* Camera Viewfinder Crosshair Overlay */}
          {!capturedPreview && !error && !initializing && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 opacity-50">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-[#BDFF42]" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-[#BDFF42]" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-[#BDFF42]" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-[#BDFF42]" />
              </div>
            </div>
          )}

          {/* Switch Camera Button (Front / Rear) */}
          {!capturedPreview && !error && !initializing && (
            <button
              type="button"
              onClick={handleToggleCamera}
              className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-[#249344]/50 text-[#BDFF42] text-[10px] font-mono flex items-center gap-1 hover:bg-black/80 transition-all shadow"
              title="Switch Camera (Front / Rear)"
            >
              <SwitchCamera size={13} />
              <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
            </button>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2.5 pt-1 flex-wrap">
          <div className="text-[10px] font-mono text-[#5E8B67]">
            {capturedPreview
              ? 'Photo snapped. Confirm to attach to report.'
              : 'Position camera to frame cracks, debris, or slope damage.'}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {capturedPreview ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn-ghost px-3 py-1.5 rounded text-xs font-mono text-[#9FD8A8] hover:text-white border border-[#249344]/40 flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn-lime px-4 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Check size={14} />
                  <span>Use This Photo</span>
                </button>
              </>
            ) : (
              <>
                {/* Fallback button that invokes native device camera picker */}
                <button
                  type="button"
                  onClick={() => fileFallbackRef.current?.click()}
                  className="btn-ghost px-2.5 py-1.5 rounded text-xs font-mono text-[#9FD8A8] hover:text-white border border-[#249344]/40 flex items-center gap-1"
                >
                  <span>Native App</span>
                </button>
                <input
                  ref={fileFallbackRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeFileInput}
                />

                <button
                  type="button"
                  onClick={handleSnapPhoto}
                  disabled={initializing || Boolean(error)}
                  className="btn-lime px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow-md disabled:opacity-40"
                >
                  <Camera size={16} />
                  <span>SNAP PHOTO</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
