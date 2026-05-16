import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Spinner from './Spinner';

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Download Template', 'Upload File', 'Review Results'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const num   = i + 1;
        const done  = current > num;
        const active = current === num;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${done   ? 'bg-green-500 border-green-500 text-white'
                : active ? 'border-brand-700 text-brand-700'
                :          'border-gray-300 text-gray-400'}`}
              >
                {done ? '✓' : num}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-brand-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile, uploading }) {
  const inputRef  = useRef();
  const [drag, setDrag] = useState(false);

  const handle = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Only .xlsx or .xls files are accepted');
      return;
    }
    onFile(file);
  }, [onFile]);

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    handle(e.dataTransfer.files[0]);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${drag    ? 'border-brand-500 bg-brand-50'
        : uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
        :            'border-gray-300 hover:border-brand-400 hover:bg-gray-50'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => handle(e.target.files[0])}
        disabled={uploading}
      />
      <div className="text-4xl mb-3">{uploading ? '⏳' : '📂'}</div>
      {uploading
        ? <p className="text-sm font-medium text-gray-600">Uploading and validating…</p>
        : <>
            <p className="text-sm font-semibold text-gray-700">Drag &amp; drop your file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx / .xls, max 5 MB</p>
          </>
      }
    </div>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────
function Results({ result, entityLabel }) {
  const { total, inserted, skipped, errors } = result;
  const allGood = skipped === 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{inserted}</p>
          <p className="text-xs text-green-600 mt-0.5">Imported</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${skipped > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
          <p className={`text-2xl font-bold ${skipped > 0 ? 'text-red-600' : 'text-gray-400'}`}>{skipped}</p>
          <p className={`text-xs mt-0.5 ${skipped > 0 ? 'text-red-500' : 'text-gray-400'}`}>Skipped</p>
        </div>
      </div>

      {allGood && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
          <span>✅</span> All {inserted} {entityLabel} imported successfully!
        </div>
      )}

      {/* Error table */}
      {errors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-red-600 mb-2">
            {errors.length} row{errors.length > 1 ? 's' : ''} had errors and were skipped:
          </p>
          <div className="border border-red-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-red-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-red-700 w-14">Row</th>
                  <th className="text-left px-3 py-2 font-semibold text-red-700">Error(s)</th>
                  <th className="text-left px-3 py-2 font-semibold text-red-700 hidden sm:table-cell">Row Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {errors.map((e, i) => (
                  <tr key={i} className="bg-white hover:bg-red-50">
                    <td className="px-3 py-2 font-mono font-bold text-red-600">{e.row}</td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5">
                        {e.errors.map((msg, j) => (
                          <li key={j} className="flex items-start gap-1 text-red-700">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>{msg}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell max-w-xs truncate">
                      {Object.entries(e.data)
                        .filter(([, v]) => v !== '')
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Fix the errors in your file and re-upload — successfully imported rows will not be duplicated.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main BulkUploadModal ─────────────────────────────────────────────────────
export default function BulkUploadModal({
  open,
  onClose,
  entityLabel,       // e.g. "Products"
  templateApiFn,     // e.g. productApi.bulkTemplate
  uploadApiFn,       // e.g. productApi.bulkUpload
  invalidateKeys,    // e.g. ['products']
  mandatoryFields,   // string[] for the info box
}) {
  const qc = useQueryClient();
  const [step, setStep]         = useState(1);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);

  function reset() { setStep(1); setResult(null); setUploading(false); }
  function handleClose() { reset(); onClose(); }

  async function downloadTemplate() {
    try {
      const res  = await templateApiFn();
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${entityLabel.toLowerCase().replace(/\s+/g, '_')}_upload_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setStep(2);
    } catch {
      toast.error('Failed to download template');
    }
  }

  async function handleFile(file) {
    setUploading(true);
    try {
      const { data } = await uploadApiFn(file);
      setResult(data.data);
      setStep(3);
      if (data.data.inserted > 0) {
        invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
        toast.success(`${data.data.inserted} ${entityLabel} imported`);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Upload — {entityLabel}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Import multiple records from an Excel file</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Steps current={step} />

          {/* Step 1 — Download template */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">Before you upload, download the template:</p>
                <ul className="space-y-1 list-disc list-inside text-blue-700">
                  <li>Fill data in the <strong>Data</strong> sheet only (do not rename columns)</li>
                  <li>Check the <strong>Instructions</strong> sheet for allowed values</li>
                  <li>Fields marked <strong>*</strong> are mandatory</li>
                  <li>Maximum 1 000 rows per file</li>
                </ul>
              </div>

              {/* Mandatory fields */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">Mandatory fields (marked * in template):</p>
                <div className="flex flex-wrap gap-1.5">
                  {mandatoryFields.map(f => (
                    <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-mono font-medium border border-amber-200">
                      {f} *
                    </span>
                  ))}
                </div>
              </div>

              <button onClick={downloadTemplate} className="btn-primary w-full py-3 text-base gap-2">
                <span>⬇</span> Download Template (.xlsx)
              </button>

              <button onClick={() => setStep(2)} className="btn-secondary w-full text-sm">
                I already have the template → Skip to upload
              </button>
            </div>
          )}

          {/* Step 2 — Upload */}
          {step === 2 && (
            <div className="space-y-4">
              {uploading
                ? <div className="flex flex-col items-center py-10 gap-3">
                    <Spinner size="lg" />
                    <p className="text-sm text-gray-600 font-medium">Validating and importing rows…</p>
                  </div>
                : <DropZone onFile={handleFile} uploading={uploading} />
              }
              <button onClick={() => setStep(1)} className="btn-secondary w-full text-sm" disabled={uploading}>
                ← Back to template download
              </button>
            </div>
          )}

          {/* Step 3 — Results */}
          {step === 3 && result && (
            <Results result={result} entityLabel={entityLabel} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          {step === 3 ? (
            <>
              <button
                onClick={() => { setResult(null); setStep(2); }}
                className="btn-secondary text-sm"
              >
                Upload Another File
              </button>
              <button onClick={handleClose} className="btn-primary">Done</button>
            </>
          ) : (
            <button onClick={handleClose} className="btn-secondary text-sm ml-auto">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
