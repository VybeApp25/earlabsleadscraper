"use client";

import { History, RotateCcw, Trash2, MapPin, Briefcase } from "lucide-react";
import { useStore, SearchHistoryItem } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  onRerun: (niche: string, location: string) => void;
}

export default function SearchHistoryPanel({ onRerun }: Props) {
  const { searchHistory, setSearchHistory } = useStore();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteHistory(id);
    setSearchHistory(searchHistory.filter((h) => h.id !== id));
  };

  const handleRerun = (item: SearchHistoryItem) => {
    onRerun(item.niche, item.location);
    toast.success(`Re-running search: ${item.niche} in ${item.location}`);
  };

  if (searchHistory.length === 0) {
    return (
      <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <History size={14} className="text-brand-400" />
          Search History
        </h2>
        <p className="text-xs text-slate-600 text-center py-3">No searches yet</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <History size={14} className="text-brand-400" />
        Recent Searches
      </h2>

      <div className="space-y-1.5">
        {searchHistory.slice(0, 8).map((item) => (
          <div
            key={item.id}
            onClick={() => handleRerun(item)}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-700 cursor-pointer group transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs">
                <Briefcase size={10} className="text-slate-500 shrink-0" />
                <span className="text-slate-300 truncate">{item.niche}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <MapPin size={10} className="text-slate-600 shrink-0" />
                <span className="text-slate-500 truncate">{item.location}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500">{item.results_count} found</p>
              <p className="text-xs text-slate-600">
                {formatDistanceToNow(new Date(item.searched_at), { addSuffix: true })}
              </p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="p-1 text-brand-400" title="Re-run">
                <RotateCcw size={11} />
              </div>
              <button
                onClick={(e) => handleDelete(item.id, e)}
                className="p-1 text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
