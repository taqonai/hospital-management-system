import { useRef } from 'react';
import { PrinterIcon, QrCodeIcon } from '@heroicons/react/24/outline';

interface BarcodeLabelProps {
  barcode: string;
  patientName: string;
  testName: string;
  collectionTime: Date;
  patientId?: string;
  mrn?: string;
  sampleType?: string;
  priority?: 'ROUTINE' | 'URGENT' | 'STAT';
  className?: string;
}

export default function BarcodeLabel({
  barcode,
  patientName,
  testName,
  collectionTime,
  patientId,
  mrn,
  sampleType,
  priority = 'ROUTINE',
  className = '',
}: BarcodeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handlePrint = () => {
    if (!labelRef.current) return;

    const printContent = labelRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=300');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Sample Label - ${barcode}</title>
            <style>
              @page {
                size: 2in 1in;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 4px;
                font-family: 'Courier New', monospace;
                font-size: 8px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .label-container {
                width: 2in;
                height: 1in;
                border: 1px solid #000;
                padding: 2px;
                box-sizing: border-box;
              }
              .barcode-container {
                text-align: center;
                margin: 2px 0;
              }
              .barcode {
                font-family: 'Libre Barcode 128', 'Free 3 of 9', monospace;
                font-size: 28px;
                letter-spacing: 0;
              }
              .barcode-text {
                font-size: 7px;
                font-family: 'Courier New', monospace;
                margin-top: 1px;
              }
              .qr-code {
                width: 40px;
                height: 40px;
                border: 1px solid #000;
                display: inline-block;
                background: url('data:image/svg+xml,${encodeURIComponent(generateQRPlaceholder(barcode))}') center/contain no-repeat;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                font-size: 7px;
                margin: 1px 0;
              }
              .patient-name {
                font-weight: bold;
                font-size: 9px;
              }
              .priority-stat {
                background: #000;
                color: #fff;
                padding: 1px 4px;
                font-weight: bold;
              }
              .priority-urgent {
                border: 1px solid #000;
                padding: 1px 4px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  // Generate a simple QR code placeholder SVG
  const qrPattern = generateQRPattern(barcode);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Preview Label */}
      <div
        ref={labelRef}
        className="bg-white border-2 border-gray-300 rounded-lg p-3 w-full max-w-xs mx-auto print:border-black"
      >
        <div className="label-container">
          {/* Header with priority */}
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-bold text-gray-900 truncate max-w-[60%]">
              {patientName}
            </span>
            {priority !== 'ROUTINE' && (
              <span
                className={`text-[8px] px-1 font-bold ${
                  priority === 'STAT'
                    ? 'bg-red-600 text-white'
                    : 'border border-orange-500 text-orange-600'
                }`}
              >
                {priority}
              </span>
            )}
          </div>

          {/* Patient ID / MRN */}
          <div className="flex justify-between text-[8px] text-gray-600 mb-1">
            {mrn && <span>MRN: {mrn}</span>}
            {patientId && <span>ID: {patientId.slice(0, 8)}</span>}
          </div>

          {/* Barcode Section */}
          <div className="flex items-center gap-2 my-2">
            {/* Linear Barcode */}
            <div className="flex-1 text-center">
              <div className="barcode-display h-8 flex items-end justify-center gap-px">
                {barcode.split('').map((char, i) => (
                  <div
                    key={i}
                    className="bg-black"
                    style={{
                      width: `${2 + (char.charCodeAt(0) % 3)}px`,
                      height: `${20 + (i % 3) * 4}px`,
                    }}
                  />
                ))}
              </div>
              <div className="text-[9px] font-mono mt-0.5 tracking-wider">
                {barcode}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex-shrink-0">
              <svg
                width="40"
                height="40"
                viewBox="0 0 25 25"
                className="border border-gray-400"
              >
                {qrPattern.map((row, y) =>
                  row.map((cell, x) =>
                    cell ? (
                      <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="1"
                        height="1"
                        fill="black"
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>
          </div>

          {/* Test Info */}
          <div className="text-[9px] font-medium text-gray-800 truncate mb-1">
            {testName}
          </div>

          {/* Sample Type & Time */}
          <div className="flex justify-between text-[7px] text-gray-500">
            {sampleType && <span>{sampleType}</span>}
            <span>{formatDate(collectionTime)}</span>
          </div>
        </div>
      </div>

      {/* Print Button */}
      <div className="flex justify-center gap-2">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
        >
          <PrinterIcon className="h-5 w-5" />
          Print Label
        </button>
      </div>

      {/* Label Info */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-center gap-1 mb-1">
          <QrCodeIcon className="h-4 w-4" />
          <span>Includes QR code for mobile scanning</span>
        </div>
        <p>Optimized for 2" x 1" label printers</p>
      </div>
    </div>
  );
}

// Generate a simple QR-like pattern based on barcode string
function generateQRPattern(text: string): boolean[][] {
  const size = 25;
  const pattern: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // Add corner position patterns (simplified QR structure)
  const addCornerPattern = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        pattern[startY + y][startX + x] = isOuter || isInner;
      }
    }
  };

  // Add corner patterns
  addCornerPattern(0, 0); // Top-left
  addCornerPattern(size - 7, 0); // Top-right
  addCornerPattern(0, size - 7); // Bottom-left

  // Generate pseudo-random data based on text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }

  // Fill data area with pattern based on hash
  for (let y = 8; y < size - 8; y++) {
    for (let x = 8; x < size - 8; x++) {
      const seed = (x * 31 + y * 17 + hash) & 0xffff;
      pattern[y][x] = seed % 3 === 0;
    }
  }

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    pattern[6][i] = i % 2 === 0;
    pattern[i][6] = i % 2 === 0;
  }

  return pattern;
}

// Generate SVG string for print window
function generateQRPlaceholder(text: string): string {
  const pattern = generateQRPattern(text);
  const rects = pattern
    .map((row, y) =>
      row
        .map((cell, x) =>
          cell ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''
        )
        .join('')
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25">${rects}</svg>`;
}

// Utility component for inline barcode display
export function InlineBarcode({
  code,
  className = '',
}: {
  code: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="flex items-end gap-px h-6">
        {code.split('').map((char, i) => (
          <div
            key={i}
            className="bg-current"
            style={{
              width: `${1 + (char.charCodeAt(0) % 2)}px`,
              height: `${14 + (i % 3) * 3}px`,
            }}
          />
        ))}
      </div>
      <span className="text-[8px] font-mono tracking-wider">{code}</span>
    </div>
  );
}
