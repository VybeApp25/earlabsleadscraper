"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { toast } from "sonner";
import TopBar from "../components/TopBar";
import AuthGuard from "../components/AuthGuard";
import HomeView from "../components/HomeView";
import { AnimatedAIChat } from "../components/ui/animated-ai-chat";
import SearchPanel from "../components/SearchPanel";
import BusinessCard from "../components/BusinessCard";
import JobsPanel from "../components/JobsPanel";
import SettingsModal from "../components/SettingsModal";
import DashboardView from "../components/DashboardView";
import KanbanBoard from "../components/KanbanBoard";
import BulkActionsBar from "../components/BulkActionsBar";
import AdvancedFilters from "../components/AdvancedFilters";
import SearchHistoryPanel from "../components/SearchHistoryPanel";
import EmailSequencePanel from "../components/EmailSequencePanel";
import { useStore, Business, Analysis, SearchJob, SearchHistoryItem, OwnerContact, AppView } from "../lib/store";
import { api } from "../lib/api";
import { Search, Loader2, LayoutGrid, Kanban, BarChart2, Mail, SlidersHorizontal, Download, Home as HomeIcon } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <HomeIcon size={15} /> },
  { id: "leads", label: "Leads", icon: <LayoutGrid size={15} /> },
  { id: "pipeline", label: "Pipeline", icon: <Kanban size={15} /> },
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 size={15} /> },
  { id: "sequences", label: "Sequences", icon: <Mail size={15} /> },
];

function AIChatPage() {
  const { stats, businesses, setActiveView, setSearchQuery, setIsSearching } = useStore();

  const handleAction = async (action: { type: string; [key: string]: any }) => {
    switch (action.type) {
      case "navigate":
        if (action.view) setActiveView(action.view as AppView);
        break;
      case "search":
        if (action.niche) {
          setSearchQuery({ niche: action.niche, location: action.location || "" });
          setIsSearching(true);
          try {
            await api.search(action.niche, action.location || "");
            const result = await api.getBusinesses();
            useStore.getState().setBusinesses(result as any[]);
            setActiveView("leads");
            toast.success(`Search started for ${action.niche}`);
          } catch { toast.error("Search failed"); }
          finally { setIsSearching(false); }
        }
        break;
      case "filter":
        if (action.minScore !== undefined) useStore.getState().setMinScoreFilter(action.minScore);
        setActiveView("leads");
        break;
      case "analyze":
        const ids = businesses.filter((b) => !b.is_analyzed).map((b) => b.id).slice(0, 10);
        if (ids.length > 0) {
          try { await api.bulkAnalyze(ids); toast.success(`Analyzing ${ids.length} leads`); setActiveView("leads"); }
          catch { toast.error("Analyze failed"); }
        } else { toast("All leads already analyzed"); }
        break;
      case "export":
        api.exportCSV();
        break;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-[128px]" />
      </div>

      <div className="shrink-0 px-6 pt-5 pb-2 relative z-10">
        <button
          onClick={() => setActiveView("home")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pb-8 relative z-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40">
              How can I help today?
            </h1>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <p className="text-sm text-slate-500">Ask ZAP about your leads, run searches, or trigger actions</p>
          </div>
          <AnimatedAIChat
            onAction={handleAction}
            stats={{ total: stats.total, analyzed: stats.analyzed, new: stats.new }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const {
    businesses, setBusinesses, addBusiness, updateBusiness,
    analyses, setAnalysis, owners, setOwner,
    jobs, setJobs, setStats, stats,
    autonomousMode, searchQuery, setSearchQuery,
    activeView, setActiveView,
    selectedIds, clearSelected, selectAll,
    minScoreFilter, sourceFilter,
    searchHistory, setSearchHistory,
  } = useStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "analyzed" | "unanalyzed">("all");
  const [sortBy, setSortBy] = useState<"newest" | "score" | "rating">("newest");
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [bizList, jobList, statsData, history] = await Promise.all([
        api.getBusinesses(),
        api.getJobs(),
        api.getStats(),
        api.getSearchHistory(),
      ]);
      setBusinesses(bizList as Business[]);
      setJobs(jobList as SearchJob[]);
      setStats(statsData);
      setSearchHistory(history as SearchHistoryItem[]);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const connect = () => {
      const es = new EventSource("/api/events");
      eventSourceRef.current = es;

      es.onmessage = async (e) => {
        const data = JSON.parse(e.data);

        if (data.type === "new_business") {
          addBusiness(data.business as Business);
          setStats({ ...stats, total: stats.total + 1, new: stats.new + 1 });
          toast.success(`New lead: ${data.business.name}`, {
            description: data.business.city, duration: 4000,
          });
        }

        if (data.type === "analysis_complete") {
          try {
            const analysis = await api.getAnalysis(data.business_id);
            setAnalysis(analysis as Analysis);
            updateBusiness(data.business_id, { is_analyzed: true });
            setStats(await api.getStats());
          } catch { }
        }

        if (data.type === "owner_found") {
          setOwner(data.data as OwnerContact);
          toast.success("Owner contact info found!", { description: data.data.owner_name });
        }
      };

      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => eventSourceRef.current?.close();
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnalyze = async (id: string) => {
    await api.analyze(id);
    toast("Analyzing...", { description: "AI is examining this business" });
    setTimeout(async () => {
      try {
        const analysis = await api.getAnalysis(id);
        setAnalysis(analysis as Analysis);
        updateBusiness(id, { is_analyzed: true });
        setStats(await api.getStats());
      } catch { }
    }, 8000);
  };

  const handleDelete = async (id: string) => {
    await api.deleteBusiness(id);
    setBusinesses(businesses.filter((b) => b.id !== id));
    setStats(await api.getStats());
  };

  const handleMarkSeen = async (id: string) => {
    await api.markSeen(id);
    updateBusiness(id, { is_new: false });
    setStats({ ...stats, new: Math.max(0, stats.new - 1) });
  };

  const handleRerunSearch = (niche: string, location: string) => {
    setSearchQuery({ niche, location });
    api.search(niche, location).then(() => loadData());
  };

  const filtered = businesses
    .filter((b) => {
      if (filter === "new") return b.is_new;
      if (filter === "analyzed") return b.is_analyzed;
      if (filter === "unanalyzed") return !b.is_analyzed;
      return true;
    })
    .filter((b) => sourceFilter === "all" || b.source === sourceFilter)
    .filter((b) => {
      if (minScoreFilter === 0) return true;
      const score = analyses[b.id]?.opportunity_score ?? 0;
      return score >= minScoreFilter;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (analyses[b.id]?.opportunity_score ?? 0) - (analyses[a.id]?.opportunity_score ?? 0);
      if (sortBy === "rating") return (b.google_rating ?? 0) - (a.google_rating ?? 0);
      return new Date(b.found_at ?? 0).getTime() - new Date(a.found_at ?? 0).getTime();
    });

  const allFilteredIds = filtered.map((b) => b.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  return (
    <AuthGuard>
    <div className="min-h-screen bg-surface-900 flex flex-col">
      <TopBar onSettingsOpen={() => setSettingsOpen(true)} onSearch={loadData} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-surface-600 bg-surface-800 flex flex-col overflow-hidden shrink-0">
          {/* Nav */}
          <div className="p-3 border-b border-surface-600">
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={clsx(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    activeView === item.id
                      ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                      : "text-slate-500 hover:text-slate-300 hover:bg-surface-700"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <SearchPanel onSearchStarted={loadData} />
            <SearchHistoryPanel onRerun={handleRerunSearch} />
            <JobsPanel onJobsChanged={loadData} />

            {autonomousMode && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold text-green-400">Autonomous Active</span>
                </div>
                <p className="text-xs text-green-300/70">Auto-refresh + AI analysis running on all new leads.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeView === "home" && <HomeView />}
          {activeView === "dashboard" && <DashboardView />}
          {activeView === "pipeline" && <KanbanBoard />}
          {activeView === "sequences" && <EmailSequencePanel />}
          {activeView === "ai-chat" && <AIChatPage />}

          {activeView === "leads" && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Filter bar */}
              <div className="sticky top-0 z-20 bg-surface-900/90 backdrop-blur-sm border-b border-surface-600 px-6 py-3 flex items-center gap-3 flex-wrap">
                {/* Select all */}
                <button
                  onClick={() => allSelected ? clearSelected() : selectAll(allFilteredIds)}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                <div className="w-px h-4 bg-surface-600" />

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
                  {(["all", "new", "analyzed", "unanalyzed"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={clsx(
                        "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
                        filter === f ? "bg-brand-500 text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {f}
                      {f === "new" && stats.new > 0 && (
                        <span className="ml-1.5 bg-green-500/20 text-green-400 rounded-full px-1.5 text-xs">{stats.new}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Advanced filters */}
                  <div className="relative">
                    <button
                      onClick={() => setFiltersOpen(!filtersOpen)}
                      className={clsx(
                        "btn-ghost text-xs",
                        (minScoreFilter > 0 || sourceFilter !== "all") && "text-brand-400"
                      )}
                    >
                      <SlidersHorizontal size={13} />
                      Filters
                      {(minScoreFilter > 0 || sourceFilter !== "all") && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      )}
                    </button>
                    {filtersOpen && (
                      <div className="absolute top-full right-0 mt-1 z-30">
                        <AdvancedFilters onClose={() => setFiltersOpen(false)} />
                      </div>
                    )}
                  </div>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-surface-800 border border-surface-600 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                  >
                    <option value="newest">Newest</option>
                    <option value="score">Opp. Score</option>
                    <option value="rating">Rating</option>
                  </select>

                  {/* Export */}
                  <div className="flex gap-1">
                    <button onClick={() => api.exportCSV()} className="btn-ghost text-xs" title="Download CSV">
                      <Download size={13} />CSV
                    </button>
                    <button onClick={() => api.exportExcel()} className="btn-ghost text-xs" title="Download Excel">
                      <Download size={13} />Excel
                    </button>
                  </div>

                  <span className="text-slate-600 text-xs">{filtered.length} leads</span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-6 flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
                    <Loader2 size={20} className="animate-spin" /><span>Loading leads...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center">
                      <Search size={24} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">No leads found</p>
                      <p className="text-slate-600 text-sm mt-1">Search for a niche and location to start finding businesses</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                    {filtered.map((biz) => (
                      <BusinessCard
                        key={biz.id}
                        business={biz}
                        analysis={analyses[biz.id]}
                        onAnalyze={() => handleAnalyze(biz.id)}
                        onDelete={() => handleDelete(biz.id)}
                        onMarkSeen={() => handleMarkSeen(biz.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <BulkActionsBar />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
    </AuthGuard>
  );
}
