/**
 * Barcode scanner: live camera, a photo of the barcode, or typing the number.
 * A USB barcode scanner "types" into the number box, so it works here too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, FlashlightOff, ImageUp, ScanBarcode } from 'lucide-react';
import { BARCODE_PATTERN, canUseCamera, preloadBarcodeReader, readBarcode, readBarcodeFromPhoto } from '../../utils/barcode';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/FormControls';
import { Spinner } from '../ui/Loader';

const SCAN_EVERY_MS = 150;

const cameraErrorMessage = (err) => {
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission is blocked. Allow the camera for this site in the browser settings, or take a photo instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Take a photo or type the number instead.';
    case 'NotReadableError':
      return 'The camera is being used by another app. Close that app and try again.';
    default:
      return 'Could not start the camera. Take a photo or type the number instead.';
  }
};

/** Short beep like a shop scanner (silently skipped where audio is not allowed) */
const beep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1500;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* no audio */
  }
};

export default function BarcodeScanner({ open, onClose, onDetected, title = 'Scan barcode' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const sessionRef = useRef(0); // bumped on every stop: cancels a pending start and the scan loop
  const photoInput = useRef(null);
  const manualInput = useRef(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [camera, setCamera] = useState('off'); // off | starting | on
  const [cameraError, setCameraError] = useState('');
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [photo, setPhoto] = useState({ busy: false, error: '' });
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState('');

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    clearTimeout(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera('off');
    setTorch({ supported: false, on: false });
  }, []);

  const found = useCallback(
    (code) => {
      stopCamera();
      if (navigator.vibrate) navigator.vibrate(80);
      beep();
      onDetectedRef.current(code);
    },
    [stopCamera]
  );

  const scanLoop = useCallback(
    (session) => {
      const tick = async () => {
        if (session !== sessionRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth) {
          // Read the middle of the picture, around the guide box
          const cropW = Math.round(video.videoWidth * 0.85);
          const cropH = Math.round(video.videoHeight * 0.6);
          const scale = Math.min(1, 1280 / cropW);
          if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
          const canvas = canvasRef.current;
          canvas.width = Math.round(cropW * scale);
          canvas.height = Math.round(cropH * scale);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(
            video,
            (video.videoWidth - cropW) / 2,
            (video.videoHeight - cropH) / 2,
            cropW,
            cropH,
            0,
            0,
            canvas.width,
            canvas.height
          );
          try {
            const code = await readBarcode(ctx.getImageData(0, 0, canvas.width, canvas.height));
            if (code && session === sessionRef.current) {
              found(code);
              return;
            }
          } catch {
            if (session === sessionRef.current) {
              stopCamera();
              setCameraError('The barcode reader could not load. Check the internet connection and try again.');
            }
            return;
          }
        }
        if (session === sessionRef.current) timerRef.current = setTimeout(tick, SCAN_EVERY_MS);
      };
      tick();
    },
    [found, stopCamera]
  );

  const startCamera = useCallback(async () => {
    setCameraError('');
    if (!canUseCamera()) {
      setCameraError(
        window.isSecureContext
          ? 'This browser cannot open the camera. Take a photo or type the number instead.'
          : 'The live camera works only on a secure (https) link. Use "Take or upload a photo" below - it works everywhere.'
      );
      return;
    }
    stopCamera();
    const session = sessionRef.current;
    setCamera('starting');
    preloadBarcodeReader();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const [track] = stream.getVideoTracks();
      const caps = track && track.getCapabilities ? track.getCapabilities() : {};
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      setTorch({ supported: Boolean(caps.torch), on: false });
      setCamera('on');
      scanLoop(session);
    } catch (err) {
      if (session !== sessionRef.current) return;
      setCamera('off');
      setCameraError(cameraErrorMessage(err));
    }
  }, [scanLoop, stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current && streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((prev) => ({ ...prev, on: !prev.on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    setCameraError('');
    setPhoto({ busy: false, error: '' });
    setManual('');
    setManualError('');
    // Phones and tablets open the camera straight away. Computers wait for a click,
    // and the number box gets focus so a USB barcode scanner can type into it.
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    let focusTimer;
    if (touch && canUseCamera()) startCamera();
    else focusTimer = setTimeout(() => manualInput.current && manualInput.current.focus(), 60);
    return () => {
      clearTimeout(focusTimer);
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const readPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhoto({ busy: false, error: 'Please choose a photo.' });
      return;
    }
    setPhoto({ busy: true, error: '' });
    try {
      const code = await readBarcodeFromPhoto(file);
      if (code) {
        setPhoto({ busy: false, error: '' });
        found(code);
      } else {
        setPhoto({
          busy: false,
          error: 'No barcode found in this photo. Take it closer, in good light, so the black lines are sharp and straight.',
        });
      }
    } catch {
      setPhoto({ busy: false, error: 'Could not read this photo. Try another photo or type the number.' });
    }
  };

  const submitManual = (event) => {
    event.preventDefault();
    const code = manual.trim();
    if (!BARCODE_PATTERN.test(code)) {
      setManualError('Type the 3-40 letters or numbers printed under the barcode.');
      return;
    }
    stopCamera();
    onDetectedRef.current(code);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description="Scan the barcode on the pack to fill in the item details.">
      <div className="space-y-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
          <video ref={videoRef} playsInline muted autoPlay className={`size-full object-cover ${camera === 'on' ? '' : 'invisible'}`} />

          {camera === 'on' && (
            <>
              <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[42%] -translate-y-1/2 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
              </div>
              <p className="absolute inset-x-0 bottom-3 px-4 text-center text-xs font-medium text-white drop-shadow">
                Hold the barcode inside the box
              </p>
              {torch.supported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2.5 text-white transition hover:bg-black/70"
                  aria-label={torch.on ? 'Turn torch off' : 'Turn torch on'}
                >
                  {torch.on ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
                </button>
              )}
            </>
          )}

          {camera !== 'on' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {camera === 'starting' ? (
                <>
                  <Spinner className="size-7 text-white" />
                  <p className="text-sm text-white/80">Opening camera...</p>
                </>
              ) : (
                <>
                  <ScanBarcode className="size-10 text-brand-300" />
                  <p className="max-w-xs text-sm text-white/85">{cameraError || 'Use the camera to scan the barcode on the pack.'}</p>
                  {canUseCamera() && (
                    <Button size="sm" variant="white" icon={Camera} onClick={startCamera}>
                      {cameraError ? 'Try again' : 'Start camera'}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <Button
            variant="outline"
            fullWidth
            icon={ImageUp}
            loading={photo.busy}
            onClick={() => {
              stopCamera(); // let the phone's camera app use the camera
              if (photoInput.current) photoInput.current.click();
            }}
          >
            {photo.busy ? 'Reading photo...' : 'Take or upload a photo of the barcode'}
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              readPhoto(e.target.files[0]);
              e.target.value = '';
            }}
          />
          {photo.error && <p className="mt-2 text-xs font-medium text-red-600">{photo.error}</p>}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or type the number / use a barcode scanner
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submitManual} noValidate>
          <div className="flex gap-2">
            <Input
              ref={manualInput}
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setManualError('');
              }}
              placeholder="e.g. 8901030865237"
              inputMode="numeric"
              enterKeyHint="search"
              autoComplete="off"
              maxLength={40}
              aria-label="Barcode number"
              invalid={Boolean(manualError)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" className="shrink-0">
              Find
            </Button>
          </div>
          {manualError && <p className="mt-1 text-xs font-medium text-red-600">{manualError}</p>}
        </form>
      </div>
    </Modal>
  );
}
