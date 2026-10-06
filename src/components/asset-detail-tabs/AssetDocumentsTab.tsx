/**
 * AssetMT - Asset Documents & Attachments Tab
 * Secure tenant-isolated document metadata, attachments, invoice receipts, and photos
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Trash2,
  Download,
  Calendar,
  User,
  Plus,
  X,
  RefreshCw,
  FileSpreadsheet,
  FileCheck,
  Image,
} from 'lucide-react';
import { Asset, DocumentRecord, CreateDocumentInput } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetDocumentsTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
}

export const AssetDocumentsTab: React.FC<AssetDocumentsTabProps> = ({
  token,
  asset,
  isTenantAdmin,
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateDocumentInput>({
    entity_type: 'ASSET',
    entity_id: asset.id,
    original_filename: '',
    content_type: 'application/pdf',
    file_size: 1024,
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.getDocuments(token, 'ASSET', asset.id);
      if (res.success && res.data) {
        setDocuments(res.data);
      }
    } catch (err) {
      console.error('Failed to load asset documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [token, asset.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFormData({
        ...formData,
        original_filename: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size: file.size,
      });
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.original_filename) {
      setFormError('Please select a file to upload or enter a filename');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const res = await api.createDocument(token, formData);
      if (res.success) {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        await loadDocuments();
      } else {
        setFormError(res.error || 'Failed to attach document metadata');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error uploading document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to remove this document attachment record?')) return;
    try {
      const res = await api.deleteDocument(token, docId);
      if (res.success) {
        await loadDocuments();
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('image')) return Image;
    if (contentType.includes('sheet') || contentType.includes('csv') || contentType.includes('excel'))
      return FileSpreadsheet;
    return FileText;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Documents & Attachment Records
          </h3>
          <p className="text-[11px] text-neutral-500">
            Secure tenant-scoped attachment storage: invoices, purchase receipts, warranties, inspection photos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setSelectedFile(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FF6A1A] hover:bg-[#e55a10] text-white transition shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-xs">
            <Paperclip className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No documents attached yet</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Upload invoices, purchase orders, warranties, or maintenance proof for compliance records.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {documents.map((doc) => {
              const Icon = getFileIcon(doc.content_type);
              return (
                <div
                  key={doc.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-neutral-900">{doc.original_filename}</div>
                      {doc.description && (
                        <div className="text-[11px] text-neutral-600 mt-0.5">{doc.description}</div>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-neutral-400 mt-1 font-mono">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px]">{doc.stored_path}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => alert(`Simulating authenticated secure download for: ${doc.original_filename}\nPath: ${doc.stored_path}`)}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-neutral-500" />
                      <span>Download</span>
                    </button>
                    {isTenantAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="p-1 rounded text-neutral-400 hover:text-red-600 cursor-pointer"
                        title="Remove attachment record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Upload Asset Document</h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Select File</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs p-2 border border-neutral-300 rounded bg-neutral-50 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#FF6A1A] file:text-white file:cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Document Filename *</label>
                <input
                  type="text"
                  value={formData.original_filename}
                  onChange={(e) => setFormData({ ...formData, original_filename: e.target.value })}
                  placeholder="e.g. invoice_apple_2026.pdf"
                  className="w-full p-2 border border-neutral-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Description / Category</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Purchase invoice, warranty certificate, condition photo"
                  className="w-full p-2 border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Attaching...' : 'Attach Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
