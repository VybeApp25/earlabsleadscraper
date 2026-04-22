import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LeadStatus = "new" | "researched" | "contacted" | "replied" | "proposal" | "won" | "lost";

export interface Business {
  id: string;
  name: string;
  phone?: string;
  emails: string[];
  website?: string;
  address?: string;
  city?: string;
  niche?: string;
  source?: string;
  google_rating?: number;
  google_review_count?: number;
  social_links: Record<string, string>;
  is_new: boolean;
  is_analyzed: boolean;
  is_duplicate?: boolean;
  status: LeadStatus;
  found_at?: string;
  contacted_at?: string;
}

export interface Analysis {
  id: string;
  business_id: string;
  social_proof_score: number;
  social_proof_breakdown: Record<string, number>;
  website_age_years?: number;
  website_tech_stack?: string;
  website_is_outdated: boolean;
  traffic_monthly?: number;
  traffic_weekly?: number;
  traffic_daily?: number;
  traffic_yearly?: number;
  pain_points: string[];
  opportunity_score: number;
  lovable_prompt?: string;
  email_template?: string;
  dm_template?: string;
  website_summary?: string;
}

export interface OwnerContact {
  id: string;
  business_id: string;
  owner_name?: string;
  owner_title?: string;
  personal_phone?: string;
  personal_email?: string;
  linkedin_url?: string;
  facebook_url?: string;
  sources: string[];
  confidence?: string;
  found_at?: string;
}

export interface SearchJob {
  id: string;
  niche: string;
  location: string;
  interval_minutes: number;
  is_active: boolean;
  is_autonomous: boolean;
  last_run?: string;
  total_found: number;
}

export interface SearchHistoryItem {
  id: string;
  niche: string;
  location: string;
  radius_km: number;
  results_count: number;
  searched_at: string;
}

export interface LeadNote {
  id: string;
  content: string;
  created_at: string;
}

export type AppView = "home" | "leads" | "pipeline" | "dashboard" | "sequences" | "ai-chat" | "settings";

interface AppStore {
  businesses: Business[];
  analyses: Record<string, Analysis>;
  owners: Record<string, OwnerContact>;
  notes: Record<string, LeadNote[]>;
  jobs: SearchJob[];
  searchHistory: SearchHistoryItem[];
  stats: { total: number; analyzed: number; new: number; won: number; contacted: number; with_email: number };
  autonomousMode: boolean;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  isSearching: boolean;
  searchQuery: { niche: string; location: string };
  activeView: AppView;
  theme: "dark" | "light";
  selectedIds: Set<string>;
  minScoreFilter: number;
  sourceFilter: string;

  setBusinesses: (b: Business[]) => void;
  addBusiness: (b: Business) => void;
  updateBusiness: (id: string, updates: Partial<Business>) => void;
  setAnalysis: (a: Analysis) => void;
  setOwner: (o: OwnerContact) => void;
  setNotes: (businessId: string, notes: LeadNote[]) => void;
  addNote: (businessId: string, note: LeadNote) => void;
  removeNote: (businessId: string, noteId: string) => void;
  setJobs: (j: SearchJob[]) => void;
  setSearchHistory: (h: SearchHistoryItem[]) => void;
  setStats: (s: AppStore["stats"]) => void;
  setAutonomousMode: (v: boolean) => void;
  setAutoRefresh: (v: boolean) => void;
  setAutoRefreshInterval: (v: number) => void;
  setIsSearching: (v: boolean) => void;
  setSearchQuery: (q: { niche: string; location: string }) => void;
  setActiveView: (v: AppView) => void;
  setTheme: (t: "dark" | "light") => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelected: () => void;
  setMinScoreFilter: (v: number) => void;
  setSourceFilter: (v: string) => void;
  markAllSeen: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      businesses: [],
      analyses: {},
      owners: {},
      notes: {},
      jobs: [],
      searchHistory: [],
      stats: { total: 0, analyzed: 0, new: 0, won: 0, contacted: 0, with_email: 0 },
      autonomousMode: false,
      autoRefresh: false,
      autoRefreshInterval: 15,
      isSearching: false,
      searchQuery: { niche: "", location: "" },
      activeView: "home",
      theme: "dark",
      selectedIds: new Set(),
      minScoreFilter: 0,
      sourceFilter: "all",

      setBusinesses: (b) => set({ businesses: b }),
      addBusiness: (b) => set((s) => ({ businesses: [b, ...s.businesses.filter((x) => x.id !== b.id)] })),
      updateBusiness: (id, updates) =>
        set((s) => ({ businesses: s.businesses.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),
      setAnalysis: (a) => set((s) => ({ analyses: { ...s.analyses, [a.business_id]: a } })),
      setOwner: (o) => set((s) => ({ owners: { ...s.owners, [o.business_id]: o } })),
      setNotes: (bid, notes) => set((s) => ({ notes: { ...s.notes, [bid]: notes } })),
      addNote: (bid, note) =>
        set((s) => ({ notes: { ...s.notes, [bid]: [note, ...(s.notes[bid] || [])] } })),
      removeNote: (bid, noteId) =>
        set((s) => ({ notes: { ...s.notes, [bid]: (s.notes[bid] || []).filter((n) => n.id !== noteId) } })),
      setJobs: (j) => set({ jobs: j }),
      setSearchHistory: (h) => set({ searchHistory: h }),
      setStats: (s) => set({ stats: s }),
      setAutonomousMode: (v) => set({ autonomousMode: v, autoRefresh: v ? true : false }),
      setAutoRefresh: (v) => set({ autoRefresh: v }),
      setAutoRefreshInterval: (v) => set({ autoRefreshInterval: v }),
      setIsSearching: (v) => set({ isSearching: v }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setActiveView: (v) => set({ activeView: v }),
      setTheme: (t) => set({ theme: t }),
      toggleSelected: (id) =>
        set((s) => {
          const next = new Set(s.selectedIds);
          next.has(id) ? next.delete(id) : next.add(id);
          return { selectedIds: next };
        }),
      selectAll: (ids) => set({ selectedIds: new Set(ids) }),
      clearSelected: () => set({ selectedIds: new Set() }),
      setMinScoreFilter: (v) => set({ minScoreFilter: v }),
      setSourceFilter: (v) => set({ sourceFilter: v }),
      markAllSeen: () => set((s) => ({ businesses: s.businesses.map((b) => ({ ...b, is_new: false })) })),
    }),
    {
      name: "ear-labs-store",
      partialize: (s) => ({
        theme: s.theme,
        autonomousMode: s.autonomousMode,
        autoRefresh: s.autoRefresh,
        autoRefreshInterval: s.autoRefreshInterval,
        searchQuery: s.searchQuery,
        activeView: s.activeView,
      }),
    }
  )
);
