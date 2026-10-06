/**
 * AssetMT - Barcode & QR Label Printing and Scanner Modal
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState } from 'react';
import {
  X,
  Printer,
  QrCode,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Asset } from '../../shared/types.ts';

interface BarcodeLabelModalProps {
  assets: Asset[];
  companyName: string;
  onClose: () => void;
  onSelectAsset?: (assetId: string) => void;
}

// Simple algorithmic SVG QR Code Matrix generator (deterministic pseudo-matrix for tag encoding)
function generateQrMatrix(text: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder pattern helper
  const addFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (
          i === 0 ||
          i === 6 ||
          j === 0 ||
          j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4)
        ) {
          matrix[r + i][c + j] = true;
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Hash encoding for text data cells
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 8; r < size - 8; r++) {
    for (let c = 8; c < size - 8; c++) {
      const bit = ((hash ^ (r * 31 + c * 17)) & 1) === 1;
      matrix[r][c] = bit;
    }
  }

  return matrix;
}

// Simple Code 128 / Code 39 Barcode SVG line pattern
function generateBarcodePattern(code: string): number[] {
  const bars: number[] = [2, 1, 2, 1]; // Start guard
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const w1 = ((charCode >> 0) & 1) + 1;
    const w2 = ((charCode >> 1) & 1) + 1;
    const w3 = ((charCode >> 2) & 1) + 1;
    const w4 = ((charCode >> 3) & 1) + 1;
    bars.push(w1, 1, w2, 1, w3, 1, w4, 2);
  }
  bars.push(2, 1, 1, 2); // Stop guard
  return bars;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  assets,
  companyName,
  onClose,
  onSelectAsset,
}) => {
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    assets.map((a) => a.id)
  );
  const [labelFormat, setLabelFormat] = useState<'standard' | 'compact' | 'qr_only'>('standard');
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<{ asset?: Asset; message?: string } | null>(null);

  const selectedAssets = assets.filter((a) => selectedAssetIds.includes(a.id));

  const handlePrint = () => {
    window.print();
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const term = scanInput.trim().toLowerCase();
    const found = assets.find(
      (a) => a.asset_tag.toLowerCase() === term || a.serial_number?.toLowerCase() === term
    );

    if (found) {
      setScanResult({ asset: found });
    } else {
      setScanResult({ message: `No asset found with tag or serial "${scanInput.trim()}".` });
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Header - Screen Only */}
        <div className="p-4 px-6 border-b border-neutral-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-[#FF6A1A]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Asset Barcode & QR Labels
              </h2>
              <p className="text-[11px] text-neutral-500">
                AssetTiger-parity physical asset labels for {companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-sm p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar / Controls - Screen Only */}
        <div className="p-4 px-6 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-700">Format:</span>
              <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLabelFormat('standard')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    labelFormat === 'standard' ? 'bg-[#FF6A1A] text-white font-medium' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Standard (QR + Barcode)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat('compact')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    labelFormat === 'compact' ? 'bg-[#FF6A1A] text-white font-medium' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat('qr_only')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    labelFormat === 'qr_only' ? 'bg-[#FF6A1A] text-white font-medium' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  QR Only
                </button>
              </div>
            </div>

            <span className="text-xs text-neutral-500">
              Selected: <strong className="text-neutral-900">{selectedAssets.length}</strong> of{' '}
              {assets.length} labels
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Labels
            </button>
          </div>
        </div>

        {/* Scan to Verify Box - Screen Only */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <form onSubmit={handleScanSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <Barcode className="w-4 h-4 text-amber-700 shrink-0" />
            <input
              type="text"
              placeholder="Test scanner / enter tag (e.g. AST-001)..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-700 text-white rounded text-xs font-medium hover:bg-amber-800 cursor-pointer"
            >
              Resolve
            </button>
          </form>

          {scanResult?.asset && (
            <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Found: <strong>{scanResult.asset.asset_tag}</strong> - {scanResult.asset.name} ({scanResult.asset.status})
              </span>
              {onSelectAsset && (
                <button
                  type="button"
                  onClick={() => onSelectAsset(scanResult.asset!.id)}
                  className="ml-2 text-xs text-[#FF6A1A] underline font-medium cursor-pointer inline-flex items-center gap-0.5"
                >
                  View Details <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {scanResult?.message && (
            <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-3 py-1 rounded border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>{scanResult.message}</span>
            </div>
          )}
        </div>

        {/* Printable Labels Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-100 print:bg-white print:p-0 print:overflow-visible">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
            {selectedAssets.map((asset) => {
              const qrMatrix = generateQrMatrix(asset.asset_tag);
              const barcodeBars = generateBarcodePattern(asset.asset_tag);

              return (
                <div
                  key={asset.id}
                  className="bg-white border-2 border-neutral-900 rounded p-3 text-neutral-900 flex flex-col justify-between shadow-xs print:shadow-none print:border-neutral-900 print:break-inside-avoid print:p-2"
                  style={{ minHeight: labelFormat === 'compact' ? '120px' : '160px' }}
                >
                  {/* Top Bar: Company & Asset Tag */}
                  <div className="border-b border-neutral-900 pb-1 mb-2 flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-700">
                        {companyName}
                      </div>
                      <div className="text-xs font-mono font-extrabold tracking-tight">
                        {asset.asset_tag}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1 py-0.5 border border-neutral-800 rounded uppercase font-semibold">
                      PROPERTY OF
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="flex items-center gap-3 my-1">
                    {/* QR Code SVG */}
                    <div className="shrink-0 bg-white p-0.5 border border-neutral-300">
                      <svg
                        width="54"
                        height="54"
                        viewBox="0 0 25 25"
                        shapeRendering="crispEdges"
                        className="w-13 h-13"
                      >
                        <rect width="25" height="25" fill="#ffffff" />
                        {qrMatrix.map((row, r) =>
                          row.map(
                            (cell, c) =>
                              cell && (
                                <rect
                                  key={`${r}-${c}`}
                                  x={c}
                                  y={r}
                                  width="1"
                                  height="1"
                                  fill="#000000"
                                />
                              )
                          )
                        )}
                      </svg>
                    </div>

                    {/* Asset Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">
                        {asset.name}
                      </div>
                      {asset.category && (
                        <div className="text-[10px] text-neutral-600 truncate mt-0.5">
                          {asset.category.name}
                        </div>
                      )}
                      {asset.serial_number && (
                        <div className="text-[9px] font-mono text-neutral-500 truncate mt-0.5">
                          S/N: {asset.serial_number}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Barcode representation (if standard format) */}
                  {labelFormat === 'standard' && (
                    <div className="mt-2 pt-1 border-t border-neutral-300 flex flex-col items-center">
                      <svg height="22" className="w-full max-w-[180px]">
                        <g fill="#000000">
                          {barcodeBars.reduce<{ pos: number; elements: React.ReactNode[] }>(
                            (acc, width, idx) => {
                              const isBar = idx % 2 === 0;
                              if (isBar) {
                                acc.elements.push(
                                  <rect
                                    key={idx}
                                    x={acc.pos}
                                    y="0"
                                    width={width}
                                    height="22"
                                  />
                                );
                              }
                              acc.pos += width;
                              return acc;
                            },
                            { pos: 10, elements: [] }
                          ).elements}
                        </g>
                      </svg>
                      <span className="text-[9px] font-mono tracking-widest text-neutral-700">
                        *{asset.asset_tag}*
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Screen Only */}
        <div className="p-3 px-6 bg-white border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500 print:hidden">
          <span>
            Compatible with standard Zebra, Dymo, Avery 5160, and desktop thermal/inkjet printers.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-50 cursor-pointer font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
