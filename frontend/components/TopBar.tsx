"use client";

import { useEffect, useRef, useState } from "react";
import {
  RefreshCw, Zap, Settings, ChevronDown, CheckCheck, LogOut, User, Sun, Moon
} from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { getUser, logout } from "../lib/auth";
import { toast } from "sonner";
import clsx from "clsx";

const INTERVALS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
];

interface TopBarProps {
  onSettingsOpen: () => void;
  onSearch: () => void;
}

export default function TopBar({ onSettingsOpen, onSearch }: TopBarProps) {
  const {
    stats, autoRefresh, autoRefreshInterval, autonomousMode,
    setAutoRefresh, setAutoRefreshInterval, setAutonomousMode, markAllSeen,
    isSearching, searchQuery, theme, setTheme,
  } = useStore();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.remove("dark");
      html.classList.add("light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
    }
  }, [theme]);

  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const currentUser = getUser();

  // Auto-refresh timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!autoRefresh || !searchQuery.niche) return;

    timerRef.current = setInterval(() => {
      handleRefresh();
    }, autoRefreshInterval * 60 * 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, autoRefreshInterval, searchQuery]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowIntervalMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRefresh = async () => {
    if (!searchQuery.niche || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await api.search(searchQuery.niche, searchQuery.location);
      toast.success("Refresh started — new leads will appear highlighted");
      onSearch();
    } catch {
      toast.error("Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAllSeen = async () => {
    await api.markAllSeen();
    markAllSeen();
    toast.success("All leads marked as seen");
  };

  const toggleAutoRefresh = () => {
    if (autonomousMode) return; // locked when autonomous
    setAutoRefresh(!autoRefresh);
    toast(autoRefresh ? "Auto-refresh disabled" : `Auto-refresh enabled — every ${autoRefreshInterval} min`);
  };

  const toggleAutonomous = () => {
    const next = !autonomousMode;
    setAutonomousMode(next);
    toast(next
      ? "Autonomous mode ON — auto-refresh + analysis enabled"
      : "Autonomous mode OFF"
    );
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-surface-600 bg-surface-800 sticky top-0 z-30">
      {/* Left — Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <span className="font-bold text-white text-lg tracking-tight">EAR Labs Scraper</span>
          <span className="block text-[10px] text-slate-500 leading-none -mt-0.5 tracking-widest uppercase">powered by WeOps</span>
        </div>
      </div>

      {/* Center — Stats */}
      <div className="flex items-center gap-6 text-sm">
        <Stat label="Total" value={stats.total} />
        <Stat label="Analyzed" value={stats.analyzed} color="text-brand-400" />
        <Stat label="New" value={stats.new} color="text-green-400" pulse={stats.new > 0} />
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-2">
        {/* Mark all seen */}
        {stats.new > 0 && (
          <button onClick={handleMarkAllSeen} className="btn-ghost text-xs gap-1.5">
            <CheckCheck size={14} />
            Mark all seen
          </button>
        )}

        {/* Auto-refresh toggle + interval */}
        <div className="flex items-center gap-1 bg-surface-700 rounded-lg p-1">
          <button
            onClick={toggleAutoRefresh}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              autoRefresh
                ? "bg-brand-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-surface-600",
              autonomousMode && "opacity-75 cursor-default"
            )}
          >
            <span className={clsx(
              "w-1.5 h-1.5 rounded-full",
              autoRefresh ? "bg-green-400 animate-pulse" : "bg-slate-600"
            )} />
            Auto
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowIntervalMenu(!showIntervalMenu)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-400 hover:text-white hover:bg-surface-600 transition-all"
            >
              {INTERVALS.find(i => i.value === autoRefreshInterval)?.label}
              <ChevronDown size={11} />
            </button>
            {showIntervalMenu && (
              <div className="absolute top-full right-0 mt-1 bg-surface-700 border border-surface-500 rounded-lg shadow-xl overflow-hidden z-50 min-w-24">
                {INTERVALS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => { setAutoRefreshInterval(value); setShowIntervalMenu(false); }}
                    className={clsx(
                      "w-full px-3 py-2 text-xs text-left hover:bg-surface-600 transition-colors",
                      value === autoRefreshInterval ? "text-brand-400" : "text-slate-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isSearching || !searchQuery.niche}
          className="btn-outline"
          title="Refresh — re-scan and highlight new businesses"
        >
          <RefreshCw size={14} className={clsx(isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>

        {/* Autonomous mode */}
        <button
          onClick={toggleAutonomous}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            autonomousMode
              ? "bg-green-500/20 border border-green-500/40 text-green-400"
              : "border border-surface-500 text-slate-400 hover:border-brand-500 hover:text-brand-400"
          )}
        >
          <span className={clsx("w-2 h-2 rounded-full", autonomousMode ? "bg-green-400 animate-pulse" : "bg-slate-600")} />
          {autonomousMode ? "Autonomous ON" : "Autonomous"}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="btn-ghost p-2"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Settings */}
        <button onClick={onSettingsOpen} className="btn-ghost p-2">
          <Settings size={16} />
        </button>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-surface-500 hover:border-brand-500/50 text-slate-300 hover:text-white transition-all text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-brand-500/30 border border-brand-500/40 flex items-center justify-center">
              <User size={12} className="text-brand-400" />
            </div>
            <span className="max-w-[120px] truncate text-xs">
              {currentUser?.name || currentUser?.email || "Account"}
            </span>
            <ChevronDown size={11} className="text-slate-500" />
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1.5 bg-surface-700 border border-surface-500 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px]">
              <div className="px-3 py-2.5 border-b border-surface-600">
                <p className="text-xs font-medium text-white truncate">{currentUser?.name || "User"}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
                {currentUser?.role === "admin" && (
                  <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">Admin</span>
                )}
              </div>
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, color = "text-white", pulse = false }: {
  label: string; value: number; color?: string; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={clsx("font-bold tabular-nums", color, pulse && "animate-pulse")}>
        {value}
      </span>
    </div>
  );
}
