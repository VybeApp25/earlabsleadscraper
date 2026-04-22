"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useStore } from "../lib/store";
import clsx from "clsx";

const SOURCES = ["all", "google", "yelp"];
const STATUSES = ["all", "new", "researched", "contacted", "replied", "proposal", "won", "lost"];

interface Props { onClose: () => void; }

export default function AdvancedFilters({ onClose }: Props) {
  const { minScoreFilter, sourceFilter, setMinScoreFilter, setSourceFilter } = useStore();

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl p-4 shadow-xl w-72">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-brand-400" />
          <span className="text-sm font-semibold text-white">Filters</span>
        </div>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300"><X size={13} /></button>
      </div>

      {/* Opportunity score slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400">Min Opportunity Score</label>
          <span className={clsx("text-xs font-bold tabular-nums", minScoreFilter > 0 ? "text-brand-400" : "text-slate-600")}>
            {minScoreFilter > 0 ? `≥ ${minScoreFilter}` : "Any"}
          </span>
        </div>
        <input
          type="range"
          min={0} max={100} step={5}
          value={minScoreFilter}
          onChange={(e) => setMinScoreFilter(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Source filter */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 block">Lead Source</label>
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                sourceFilter === s
                  ? "bg-brand-500 text-white"
                  : "bg-surface-700 text-slate-400 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      {(minScoreFilter > 0 || sourceFilter !== "all") && (
        <button
          onClick={() => { setMinScoreFilter(0); setSourceFilter("all"); }}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
