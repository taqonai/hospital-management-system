import { useState, useRef, useEffect } from 'react';
import {
  CameraIcon,
  XMarkIcon,
  QrCodeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  expectedType?: 'patient' | 'medication' | 'any';
  isOpen: boolean;
}

export default function BarcodeScanner({
  onScan,
  onClose,
  expectedType = 'any',
  isOpen,
}: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && isScanning) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, isScanning]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setScanResult({
        success: false,
        message: 'Unable to access camera. Please use manual entry.',
      });
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      setScanResult({
        success: true,
        message: `Barcode received: ${manualInput}`,
      });
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  const simulateScan = () => {
    // Simulate different barcode types for demo
    let barcode: string;
    if (expectedType === 'patient') {
      barcode = `PT${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    } else if (expectedType === 'medication') {
      barcode = `01${Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0')}`;
    } else {
      barcode = Math.random() > 0.5
        ? `PT${Math.random().toString(36).substring(2, 10).toUpperCase()}`
        : `01${Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0')}`;
    }

    setScanResult({
      success: true,
      message: `Scanned: ${barcode}`,
    });
    onScan(barcode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCodeIcon className="h-6 w-6" />
              <div>
                <h3 className="font-semibold">Barcode Scanner</h3>
                <p className="text-sm text-blue-100">
                  {expectedType === 'patient'
                    ? 'Scan patient wristband'
                    : expectedType === 'medication'
                    ? 'Scan medication barcode'
                    : 'Scan barcode'}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Camera View */}
          {isScanning && (
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-32 border-2 border-white/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                </div>
              </div>
              {/* Scan line animation */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 overflow-hidden">
                  <div className="h-0.5 bg-red-500 animate-scan-line" />
                </div>
              </div>
            </div>
          )}

          {/* Camera Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsScanning(!isScanning);
                setScanResult(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                isScanning
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <CameraIcon className="h-5 w-5" />
              {isScanning ? 'Stop Camera' : 'Start Camera'}
            </button>
            {isScanning && (
              <button
                onClick={simulateScan}
                className="px-4 py-3 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
              >
                Simulate Scan
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">or enter manually</span>
            </div>
          </div>

          {/* Manual Entry */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Enter barcode number..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualInput.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
          </div>

          {/* Scan Result */}
          {scanResult && (
            <div
              className={`flex items-center gap-3 p-4 rounded-xl ${
                scanResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {scanResult.success ? (
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm">{scanResult.message}</span>
            </div>
          )}

          {/* Tips */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">
              <strong>Tip:</strong>{' '}
              {expectedType === 'patient'
                ? 'Hold the camera steady over the patient wristband barcode'
                : expectedType === 'medication'
                ? 'Scan the barcode on the medication packaging'
                : 'Position barcode within the frame for automatic detection'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(-50px); }
          50% { transform: translateY(50px); }
          100% { transform: translateY(-50px); }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
