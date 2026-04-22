"use client";

import { useState } from "react";
import { Search, MapPin, Briefcase, Sliders } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

const NICHES = [
  "Restaurant", "Hair Salon", "Auto Repair", "Dentist", "Gym/Fitness",
  "Plumber", "HVAC", "Real Estate Agent", "Law Firm", "Retail Store",
  "Coffee Shop", "Chiropractor", "Landscaping", "Cleaning Service", "Photographer",
];

interface Props { onSearchStarted: () => void; }

export default function SearchPanel({ onSearchStarted }: Props) {
  const { setIsSearching, setSearchQuery, autonomousMode } = useStore();
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) {
      toast.error("Enter both a niche and location");
      return;
    }
    setLoading(true);
    setIsSearching(true);
    setSearchQuery({ niche: niche.trim(), location: location.trim() });
    try {
      await api.search(niche.trim(), location.trim(), radius);
      toast.success(`Searching for "${niche}" in ${location}...`);
      onSearchStarted();
    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <Search size={14} className="text-brand-400" />
        Lead Search
      </h2>

      <form onSubmit={handleSearch} className="space-y-3">
        {/* Niche */}
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Business Niche</label>
          <div className="relative">
            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              list="niches"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Hair Salon, Dentist..."
              className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
            <datalist id="niches">
              {NICHES.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Location</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State or ZIP..."
              className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          <Sliders size={11} />
          {showAdvanced ? "Hide" : "Show"} advanced
        </button>

        {showAdvanced && (
          <div className="animate-fade-in">
            <label className="text-xs text-slate-500 mb-1.5 block">Radius: {radius} km</label>
            <input
              type="range"
              min={1} max={50} value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={clsx(
            "w-full btn-primary justify-center py-2.5",
            autonomousMode && "ring-1 ring-green-500/30"
          )}
        >
          <Search size={14} />
          {loading ? "Starting search..." : autonomousMode ? "Search (Autonomous)" : "Search"}
        </button>
      </form>
    </div>
  );
}
