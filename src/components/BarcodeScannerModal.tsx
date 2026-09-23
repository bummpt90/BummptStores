import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, RefreshCw, X, Zap, Barcode, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { playBeepSound } from '../services/storage';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  products: Product[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  products,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Initializing sensor...');
  const [manualCode, setManualCode] = useState<string>('');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    startScanning();

    return () => {
      stopScanning();
    };
  }, [isOpen, selectedCameraId]);

  const startScanning = async () => {
    try {
      setScanStatus('Requesting camera access...');
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const videoInputDevices = await codeReader.listVideoInputDevices();
      setCameras(videoInputDevices);

      if (videoInputDevices.length === 0) {
        setHasPermission(false);
        setScanStatus('No camera device detected.');
        return;
      }

      // Default to back camera (environment) if available
      const defaultDevice =
        selectedCameraId ||
        videoInputDevices.find((d) => d.label.toLowerCase().includes('back'))?.deviceId ||
        videoInputDevices[0].deviceId;

      setSelectedCameraId(defaultDevice);
      setHasPermission(true);
      setScanStatus('Aim camera sensor at barcode');

      if (videoRef.current) {
        await codeReader.decodeFromVideoDevice(
          defaultDevice,
          videoRef.current,
          (result, error) => {
            if (result) {
              const text = result.getText();
              handleSuccessfulScan(text);
            }
          }
        );
      }
    } catch (err: any) {
      console.warn('Camera sensor initialization error:', err);
      setHasPermission(false);
      setScanStatus('Camera unavailable or permission denied. Use sample barcodes or keyboard below.');
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        // cleanup
      }
      codeReaderRef.current = null;
    }
  };

  const handleSuccessfulScan = (code: string) => {
    playBeepSound('scan');
    setLastScanned(code);
    setScanStatus(`Barcode Detected: ${code}`);
    setTimeout(() => {
      onScan(code);
      onClose();
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessfulScan(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div
      id="barcode-scanner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base">
                Barcode Sensor Scanner
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Auto-detects EAN, UPC, and Code 128
              </p>
            </div>
          </div>
          <button
            id="btn-close-scanner"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[260px] max-h-[340px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scanner Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div className="w-64 h-44 border-2 border-emerald-400 rounded-xl relative shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
              
              {/* Laser sweep animation */}
              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse my-20" />
            </div>
          </div>

          {/* Bottom status indicator inside viewport */}
          <div className="absolute bottom-3 inset-x-0 flex justify-center px-4">
            <span className="bg-black/70 backdrop-blur-md text-emerald-300 text-xs px-3 py-1.5 rounded-full font-mono flex items-center gap-1.5 shadow-md border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {scanStatus}
            </span>
          </div>

          {/* Switch Camera if multiple */}
          {cameras.length > 1 && (
            <button
              onClick={() => {
                const nextIdx = (cameras.findIndex((c) => c.deviceId === selectedCameraId) + 1) % cameras.length;
                setSelectedCameraId(cameras[nextIdx].deviceId);
              }}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg text-xs flex items-center gap-1 backdrop-blur-xs transition"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Manual Keyboard & Sample Barcode Selector */}
        <div className="p-4 bg-white dark:bg-neutral-900 space-y-3 overflow-y-auto">
          {/* Direct Manual Entry */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="input-manual-barcode"
                type="text"
                placeholder="Or type/paste Barcode (e.g. 011110038245)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <Barcode className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
            >
              Add Item
            </button>
          </form>

          {/* Instant Quick-Test Barcodes for immediate sensory testing */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
              Quick Sensor Presets (Click to Simulate Scan)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {products.slice(0, 9).map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSuccessfulScan(prod.barcode)}
                  className="flex items-center gap-2 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition group"
                >
                  <span className="text-lg leading-none">{prod.icon || '📦'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {prod.name}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-400 truncate">
                      {prod.barcode}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
