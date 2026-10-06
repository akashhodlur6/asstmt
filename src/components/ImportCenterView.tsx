/**
 * AssetMT - Controlled CSV Import Center
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * Flow: Upload -> Parse -> Column Mapping -> Validation Preview -> Server Commit
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Download,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  ImportTarget,
  ImportPreviewResponse,
  CommitImportResponse,
} from '../../shared/types.ts';

interface ImportCenterViewProps {
  token: string;
  onNavigateToView?: (view: string) => void;
}

export const ImportCenterView: React.FC<ImportCenterViewProps> = ({ token, onNavigateToView }) => {
  const [target, setTarget] = useState<ImportTarget>('ASSETS');
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Preview, 3: Completed
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitImportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  // Sample CSV Templates
  const sampleTemplates: Record<ImportTarget, { filename: string; text: string }> = {
    ASSETS: {
      filename: 'sample_assets_import.csv',
      text: `name,asset_tag,purchase_cost,status,description\n"Dell XPS 15 Laptop","AST-1001",1899.99,"Available","Engineering workstation"\n"Apple MacBook Pro M3","AST-1002",2499.00,"Available","Design laptop"\n"Ergonomic Chair","AST-1003",350.00,"Available","Executive mesh chair"`,
    },
    EMPLOYEES: {
      filename: 'sample_employees_import.csv',
      text: `full_name,employee_code,email\n"Jane Doe","EMP-101","jane.doe@example.com"\n"John Smith","EMP-102","john.smith@example.com"\n"Alice Johnson","EMP-103","alice.j@example.com"`,
    },
    INVENTORY: {
      filename: 'sample_inventory_import.csv',
      text: `sku,name,quantity_on_hand\n"RAM-DDR5-16GB","16GB DDR5 Crucial RAM",45\n"SSD-NVME-1TB","Samsung 980 Pro 1TB NVMe",20\n"CBL-USBC-6FT","Braided USB-C Cable 6ft",100`,
    },
  };

  const handleDownloadSample = () => {
    const sample = sampleTemplates[target];
    const blob = new Blob([sample.text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sample.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setError('Please select or paste valid CSV content.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.previewImport(token, target, csvContent);
      if (res.success) {
        setPreviewResult(res.data);
        setStep(2);
      } else {
        setError(res.error || 'Failed to parse and validate CSV');
      }
    } catch (err: any) {
      setError(err.message || 'Server error while parsing CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewResult) return;

    // Filter only valid rows
    const validRows = previewResult.rows
      .filter((r) => r.is_valid)
      .map((r) => r.parsed_data);

    if (validRows.length === 0) {
      alert('There are no valid rows to import. Please review validation errors.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.commitImport(token, target, validRows, skipDuplicates);
      if (res.success) {
        setCommitResult(res.data);
        setStep(3);
      } else {
        setError(res.error || 'Failed to commit import records');
      }
    } catch (err: any) {
      setError(err.message || 'Error committing import records to database');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCsvContent('');
    setFileName('');
    setPreviewResult(null);
    setCommitResult(null);
    setStep(1);
    setError(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A1A] tracking-wider uppercase mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Batch Migration Engine</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Controlled CSV Import Center
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Strict multi-tenant staging: Preview, schema validation, and server-side authorization before database commit.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          <span>Download {target} Template</span>
        </button>
      </div>

      {/* Target Selector */}
      {step === 1 && (
        <div className="grid grid-cols-3 gap-3">
          {(['ASSETS', 'EMPLOYEES', 'INVENTORY'] as ImportTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTarget(t);
                setPreviewResult(null);
              }}
              className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                target === t
                  ? 'border-[#FF6A1A] bg-orange-50/40 ring-1 ring-[#FF6A1A]'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div className="text-xs font-bold text-neutral-900">{t} IMPORT</div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {t === 'ASSETS' && 'Import capital assets, tags, costs, and statuses'}
                {t === 'EMPLOYEES' && 'Import directory personnel, codes, and emails'}
                {t === 'INVENTORY' && 'Import consumable SKUs, names, and stock levels'}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Upload / Paste */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">
              Step 1: Upload or Paste {target} CSV
            </h2>
            <span className="text-[11px] text-neutral-400">RFC 4180 Standard</span>
          </div>

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-[#FF6A1A] transition-colors bg-neutral-50/50">
            <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-700">
              {fileName ? `Selected: ${fileName}` : 'Choose a CSV file from your computer'}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5 mb-3">
              Must include valid header row matching column names.
            </p>
            <label className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded cursor-pointer inline-block transition-colors">
              Browse CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-neutral-700">
                Or Paste Raw CSV Data Directly
              </label>
              <button
                type="button"
                onClick={() => setCsvContent(sampleTemplates[target].text)}
                className="text-[10px] text-[#FF6A1A] hover:underline cursor-pointer"
              >
                Load Sample Data
              </button>
            </div>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="name,asset_tag,purchase_cost,status\nLaptop 1,AST-001,1200,Available"
              className="w-full p-3 border border-neutral-300 rounded text-xs font-mono focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                id="skipDup"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded text-[#FF6A1A] focus:ring-0"
              />
              <label htmlFor="skipDup">Skip duplicate tags/SKUs safely without failing entire batch</label>
            </div>

            <button
              onClick={handlePreview}
              disabled={loading || !csvContent.trim()}
              className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Validate & Preview Rows</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Validation Preview */}
      {step === 2 && previewResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Step 2: Validation Preview & Health Check
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Target: <strong>{previewResult.target}</strong> | Total Rows: {previewResult.total_rows}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold">
                ✓ {previewResult.valid_count} Valid
              </div>
              <div className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold">
                ✕ {previewResult.invalid_count} Invalid
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-bold text-neutral-700">
              Row-by-Row Staging Inspection
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-semibold text-neutral-600">
                    <th className="py-2 px-3 w-16">Row</th>
                    <th className="py-2 px-3 w-24">Status</th>
                    <th className="py-2 px-4">Parsed Data</th>
                    <th className="py-2 px-4">Validation Notes / Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {previewResult.rows.map((row) => (
                    <tr
                      key={row.row_number}
                      className={row.is_valid ? 'hover:bg-neutral-50' : 'bg-red-50/30 hover:bg-red-50/50'}
                    >
                      <td className="py-2.5 px-3 font-mono text-neutral-500">
                        #{row.row_number}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.is_valid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>VALID</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3 text-red-600" />
                            <span>ERROR</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-800">
                        {Object.entries(row.parsed_data)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' | ')}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {row.is_valid ? (
                          <span className="text-emerald-600 text-[11px]">Ready for database insertion</span>
                        ) : (
                          <span className="text-red-700 font-medium text-[11px]">
                            {row.errors.join('; ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-neutral-200">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded cursor-pointer"
            >
              Back to Edit CSV
            </button>

            <button
              onClick={handleCommit}
              disabled={loading || previewResult.valid_count === 0}
              className="px-6 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-bold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Commit {previewResult.valid_count} Authorized Records to Database
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Completed Summary */}
      {step === 3 && commitResult && (
        <div className="bg-white rounded-lg border border-neutral-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">
            Batch Import Complete
          </h2>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Authorized records have been committed to your tenant workspace with immutable audit events.
          </p>

          <div className="flex justify-center gap-4 py-2">
            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 min-w-28">
              <div className="text-lg font-bold text-emerald-600">
                {commitResult.imported_count}
              </div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">
                Imported
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 min-w-28">
              <div className="text-lg font-bold text-amber-600">
                {commitResult.skipped_count}
              </div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">
                Skipped (Duplicates)
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 min-w-28">
              <div className="text-lg font-bold text-red-600">
                {commitResult.failed_count}
              </div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">
                Failed
              </div>
            </div>
          </div>

          {commitResult.errors && commitResult.errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 text-left max-w-xl mx-auto space-y-1">
              <div className="font-bold">Errors encountered during commit:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {commitResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded cursor-pointer"
            >
              Import Another File
            </button>
            {onNavigateToView && (
              <button
                onClick={() => onNavigateToView(target.toLowerCase())}
                className="px-5 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-bold rounded shadow-xs cursor-pointer"
              >
                View {target} Registry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
