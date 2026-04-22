"use client";

import { useState } from "react";
import { X, BarChart2, Send, Trash2, Download, CheckSquare } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

export default function BulkActionsBar() {
  const { selectedIds, clearSelected, businesses, setBusinesses } = useStore();
  const [loading, setLoading] = useState<string | null>(null);
  const count = selectedIds.size;

  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleBulkAnalyze = async () => {
    setLoading("analyze");
    try {
      await api.bulkAnalyze(ids);
      toast.success(`Queued ${count} leads for AI analysis`);
      clearSelected();
    } catch {
      toast.error("Bulk analyze failed");
    } finally {
      setLoading(null);
    }
  };

  const handleBulkGHL = async () => {
    setLoading("ghl");
    try {
      const results = await api.bulkExportGHL(ids) as any[];
      const ok = results.filter((r) => r.success).length;
      toast.success(`Exported ${ok}/${count} leads to GoHighLevel`);
      clearSelected();
    } catch {
      toast.error("Bulk GHL export failed");
    } finally {
      setLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${count} leads? This cannot be undone.`)) return;
    setLoading("delete");
    try {
      await api.bulkDelete(ids);
      setBusinesses(businesses.filter((b) => !selectedIds.has(b.id)));
      toast.success(`Deleted ${count} leads`);
      clearSelected();
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-center gap-2 bg-surface-700 border border-brand-500/30 rounded-2xl px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mr-2">
          <CheckSquare size={15} className="text-brand-400" />
          <span className="text-sm font-semibold text-white">{count} selected</span>
        </div>

        <div className="w-px h-5 bg-surface-500" />

        <button
          onClick={handleBulkAnalyze}
          disabled={!!loading}
          className={clsx("btn-primary text-xs py-1.5", loading === "analyze" && "opacity-75")}
        >
          <BarChart2 size={13} />
          {loading === "analyze" ? "Analyzing..." : "Analyze All"}
        </button>

        <button
          onClick={handleBulkGHL}
          disabled={!!loading}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
            "border-orange-500/30 text-orange-400 hover:border-orange-400 hover:bg-orange-500/10",
            loading === "ghl" && "opacity-75"
          )}
        >
          <Send size={13} />
          {loading === "ghl" ? "Exporting..." : "→ GHL"}
        </button>

        <button
          onClick={() => { api.exportCSV(); clearSelected(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-500 text-slate-400 hover:border-green-500/40 hover:text-green-400 transition-all"
        >
          <Download size={13} />
          Export CSV
        </button>

        <button
          onClick={() => { api.exportExcel(); clearSelected(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-500 text-slate-400 hover:border-green-500/40 hover:text-green-400 transition-all"
        >
          <Download size={13} />
          Export Excel
        </button>

        <div className="w-px h-5 bg-surface-500" />

        <button
          onClick={handleBulkDelete}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={13} />
          Delete
        </button>

        <button onClick={clearSelected} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors ml-1">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
