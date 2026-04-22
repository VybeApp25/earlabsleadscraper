const BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ear_labs_token");
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem("ear_labs_token");
    localStorage.removeItem("ear_labs_user");
    document.cookie = "ear_labs_token=; path=/; max-age=0";
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Search
  search: (niche: string, location: string, radius_km = 10, sources = ["google"]) =>
    req("/search", { method: "POST", body: JSON.stringify({ niche, location, radius_km, sources }) }),

  // Businesses
  getBusinesses: (params?: Record<string, string | number>) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return req<any[]>(`/businesses${qs}`);
  },
  getBusiness: (id: string) => req<any>(`/businesses/${id}`),
  updateStatus: (id: string, status: string) =>
    req(`/businesses/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  markSeen: (id: string) => req(`/businesses/${id}/mark-seen`, { method: "POST" }),
  markAllSeen: () => req("/businesses/mark-all-seen", { method: "POST" }),
  deleteBusiness: (id: string) => req(`/businesses/${id}`, { method: "DELETE" }),

  // Bulk
  bulkAnalyze: (ids: string[]) =>
    req("/businesses/bulk-analyze", { method: "POST", body: JSON.stringify({ business_ids: ids }) }),
  bulkExportGHL: (ids: string[]) =>
    req("/businesses/bulk-export-ghl", { method: "POST", body: JSON.stringify({ business_ids: ids }) }),
  bulkDelete: (ids: string[]) =>
    req("/businesses/bulk-delete", { method: "POST", body: JSON.stringify({ business_ids: ids }) }),

  // Analysis
  analyze: (id: string) => req(`/businesses/${id}/analyze`, { method: "POST" }),
  getAnalysis: (id: string) => req<any>(`/businesses/${id}/analysis`),

  // Owner contact
  findOwner: (id: string) => req(`/businesses/${id}/find-owner`, { method: "POST" }),
  getOwner: (id: string) => req<any>(`/businesses/${id}/owner`),

  // Notes
  getNotes: (id: string) => req<any[]>(`/businesses/${id}/notes`),
  addNote: (id: string, content: string) =>
    req<any>(`/businesses/${id}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteNote: (noteId: string) => req(`/notes/${noteId}`, { method: "DELETE" }),

  // Export
  exportCSV: () => window.open(`${BASE}/export/csv`, "_blank"),
  exportExcel: () => window.open(`${BASE}/export/excel`, "_blank"),

  // Integrations
  exportGHL: (id: string) => req(`/businesses/${id}/export-ghl`, { method: "POST" }),
  sendEmail: (to: string, subject: string, body: string) =>
    req("/send-email", { method: "POST", body: JSON.stringify({ to, subject, body }) }),

  // Email sequences
  getSequences: () => req<any[]>("/sequences"),
  createSequence: (data: any) => req("/sequences", { method: "POST", body: JSON.stringify(data) }),
  deleteSequence: (id: string) => req(`/sequences/${id}`, { method: "DELETE" }),
  enrollInSequence: (seqId: string, businessId: string) =>
    req(`/sequences/${seqId}/enroll/${businessId}`, { method: "POST" }),

  // Email provider
  getEmailProvider: () => req<any>("/email-provider"),
  getInstantlyCampaigns: () => req<any[]>("/instantly/campaigns"),

  // Webhooks
  getWebhooks: () => req<any[]>("/webhooks"),
  createWebhook: (data: any) => req("/webhooks", { method: "POST", body: JSON.stringify(data) }),
  deleteWebhook: (id: string) => req(`/webhooks/${id}`, { method: "DELETE" }),

  // Jobs
  getJobs: () => req<any[]>("/jobs"),
  createJob: (data: any) => req("/jobs", { method: "POST", body: JSON.stringify(data) }),
  deleteJob: (id: string) => req(`/jobs/${id}`, { method: "DELETE" }),
  toggleJob: (id: string) => req(`/jobs/${id}/toggle`, { method: "PATCH" }),

  // Search history
  getSearchHistory: () => req<any[]>("/search-history"),
  deleteHistory: (id: string) => req(`/search-history/${id}`, { method: "DELETE" }),

  // Stats
  getStats: () => req<any>("/stats"),
  getTimeline: (days = 30) => req<any[]>(`/stats/timeline?days=${days}`),
  getByNiche: () => req<any[]>("/stats/by-niche"),
  getByStatus: () => req<any[]>("/stats/by-status"),

  // AI Chat
  chat: (message: string, history: { role: string; content: string }[] = []) =>
    req<{ response: string; action?: any }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),

  // App Settings (API keys)
  getSettingsKeys: () => req<Record<string, { masked: string; is_set: boolean }>>("/settings/keys"),
  saveSettingsKeys: (settings: Record<string, string>) =>
    req("/settings/keys", { method: "POST", body: JSON.stringify({ settings }) }),
};
