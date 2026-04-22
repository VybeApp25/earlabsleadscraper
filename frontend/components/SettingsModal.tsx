"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import clsx from "clsx";

interface Props { onClose: () => void; }

type Tab = "keys" | "email" | "webhooks" | "about";

interface KeyDef {
  key: string;
  label: string;
  description: string;
  link: string;
  linkLabel: string;
  required?: boolean;
  placeholder?: string;
}

interface KeyGroup {
  title: string;
  keys: KeyDef[];
}

const KEY_GROUPS: KeyGroup[] = [
  {
    title: "Required",
    keys: [
      { key: "GOOGLE_PLACES_API_KEY", label: "Google Places API Key", required: true, description: "Powers all business searches across Google Maps.", link: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com", linkLabel: "Get key →", placeholder: "AIza..." },
      { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API Key", required: true, description: "AI analysis, email templates, DM generation, and the ZAP chat.", link: "https://console.anthropic.com/", linkLabel: "Get key →", placeholder: "sk-ant-..." },
    ],
  },
  {
    title: "Email — Gmail",
    keys: [
      { key: "GMAIL_CLIENT_ID", label: "Gmail Client ID", description: "OAuth client ID from Google Cloud Console.", link: "https://console.cloud.google.com/apis/library/gmail.googleapis.com", linkLabel: "Setup guide →", placeholder: "xxx.apps.googleusercontent.com" },
      { key: "GMAIL_CLIENT_SECRET", label: "Gmail Client Secret", description: "OAuth client secret.", link: "https://console.cloud.google.com/apis/library/gmail.googleapis.com", linkLabel: "Setup guide →", placeholder: "GOCSPX-..." },
      { key: "GMAIL_REFRESH_TOKEN", label: "Gmail Refresh Token", description: "Long-lived token to send email without re-authenticating.", link: "https://console.cloud.google.com/apis/library/gmail.googleapis.com", linkLabel: "Setup guide →" },
    ],
  },
  {
    title: "Email — Instantly.ai",
    keys: [
      { key: "INSTANTLY_API_KEY", label: "Instantly API Key", description: "For cold outreach at scale with warmup and account rotation.", link: "https://app.instantly.ai/app/settings/integrations", linkLabel: "Get key →", placeholder: "inst_..." },
      { key: "INSTANTLY_CAMPAIGN_ID", label: "Instantly Campaign ID", description: "Leads will be enrolled into this campaign automatically.", link: "https://app.instantly.ai/", linkLabel: "Find in Instantly →" },
    ],
  },
  {
    title: "GoHighLevel CRM",
    keys: [
      { key: "GHL_API_KEY", label: "GHL API Key", description: "Enables pushing leads directly into your GHL pipeline.", link: "https://app.gohighlevel.com/settings/integrations", linkLabel: "Get key →" },
      { key: "GHL_LOCATION_ID", label: "GHL Location ID", description: "The sub-account / location to push contacts into.", link: "https://app.gohighlevel.com/settings/integrations", linkLabel: "Find it →" },
    ],
  },
  {
    title: "Lead Sources",
    keys: [
      { key: "YELP_API_KEY", label: "Yelp Fusion API Key", description: "Second lead source alongside Google Maps.", link: "https://www.yelp.com/developers/v3/manage_app", linkLabel: "Get key →" },
    ],
  },
  {
    title: "Owner Contact Research",
    keys: [
      { key: "HUNTER_API_KEY", label: "Hunter.io API Key", description: "Finds business owner email addresses. Free tier: 25/mo.", link: "https://hunter.io/api-keys", linkLabel: "Get key →" },
      { key: "PDL_API_KEY", label: "People Data Labs Key", description: "Enriches contacts with personal phone numbers and emails.", link: "https://dashboard.peopledatalabs.com/", linkLabel: "Get key →" },
      { key: "GOOGLE_SEARCH_API_KEY", label: "Google Custom Search Key", description: "Web search for owner info. Falls back to DuckDuckGo if missing.", link: "https://programmablesearchengine.google.com/controlpanel/all", linkLabel: "Get key →" },
      { key: "GOOGLE_SEARCH_CX", label: "Google Search Engine ID (CX)", description: "The custom search engine ID paired with the key above.", link: "https://programmablesearchengine.google.com/controlpanel/all", linkLabel: "Find it →" },
    ],
  },
];

export default function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("keys");
  const [emailProvider, setEmailProvider] = useState<"gmail" | "instantly">("gmail");
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhook, setNewWebhook] = useState({ name: "", url: "", trigger: "new_lead", secret: "" });
  const [keyStatus, setKeyStatus] = useState<Record<string, { masked: string; is_set: boolean }>>({});
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  useEffect(() => {
    api.getEmailProvider?.().then((r: any) => setEmailProvider(r.provider)).catch(() => {});
    api.getWebhooks().then(setWebhooks).catch(() => {});
    api.getSettingsKeys().then(setKeyStatus).catch(() => {});
  }, []);

  const handleSaveGroup = async (group: KeyGroup) => {
    const toSave: Record<string, string> = {};
    group.keys.forEach((k) => { if (keyValues[k.key]?.trim()) toSave[k.key] = keyValues[k.key].trim(); });
    if (!Object.keys(toSave).length) { toast("No new values to save"); return; }
    setSavingGroup(group.title);
    try {
      await api.saveSettingsKeys(toSave);
      const updated = { ...keyStatus };
      Object.keys(toSave).forEach((k) => {
        updated[k] = { masked: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + toSave[k].slice(-4), is_set: true };
      });
      setKeyStatus(updated);
      const cleared = { ...keyValues };
      Object.keys(toSave).forEach((k) => delete cleared[k]);
      setKeyValues(cleared);
      toast.success(`${group.title} keys saved`);
    } catch { toast.error("Failed to save"); }
    finally { setSavingGroup(null); }
  };

  const handleAddWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url) return;
    try {
      const created = await api.createWebhook(newWebhook) as any;
      setWebhooks([...webhooks, { ...newWebhook, id: created.id, is_active: true }]);
      setNewWebhook({ name: "", url: "", trigger: "new_lead", secret: "" });
      toast.success("Webhook created");
    } catch { toast.error("Failed to create webhook"); }
  };

  const handleDeleteWebhook = async (id: string) => {
    await api.deleteWebhook(id);
    setWebhooks(webhooks.filter((w) => w.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col relative z-[9999]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div>
            <h2 className="font-bold text-white">EAR Labs Scraper — Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Powered by WeOps</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-6 pt-4 border-b border-surface-600 pb-0">
          {(["keys", "email", "webhooks", "about"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                tab === t ? "border-brand-500 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300")}>
              {t === "keys" ? "API Keys" : t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* API Keys */}
          {tab === "keys" && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                Keys are saved to the database and take effect immediately — no restart needed.
                Leave a field blank to keep the existing value. Green dot means a key is set.
              </p>
              {KEY_GROUPS.map((group) => (
                <div key={group.title} className="bg-surface-700/50 border border-surface-600 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                    <button
                      onClick={() => handleSaveGroup(group)}
                      disabled={savingGroup === group.title}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 text-xs rounded-lg transition-all disabled:opacity-50"
                    >
                      {savingGroup === group.title
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Save size={11} />}
                      Save
                    </button>
                  </div>
                  {group.keys.map((kd) => {
                    const status = keyStatus[kd.key];
                    const isSet = status?.is_set;
                    return (
                      <div key={kd.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={clsx("text-base leading-none", isSet ? "text-green-400" : "text-slate-700")}>●</span>
                            <span className="text-xs font-medium text-slate-300">{kd.label}</span>
                            {kd.required && (
                              <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">Required</span>
                            )}
                          </div>
                          <a href={kd.link} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-0.5">
                            {kd.linkLabel} <ExternalLink size={9} />
                          </a>
                        </div>
                        <p className="text-[11px] text-slate-500 ml-5">{kd.description}</p>
                        <div className="relative ml-5">
                          <input
                            type={showKeys[kd.key] ? "text" : "password"}
                            value={keyValues[kd.key] ?? ""}
                            onChange={(e) => setKeyValues({ ...keyValues, [kd.key]: e.target.value })}
                            placeholder={isSet ? status.masked : (kd.placeholder || "Paste key here...")}
                            className="w-full bg-surface-800 border border-surface-500 focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors pr-16"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys({ ...showKeys, [kd.key]: !showKeys[kd.key] })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {showKeys[kd.key] ? <EyeOff size={11} /> : <Eye size={11} />}
                            {showKeys[kd.key] ? "hide" : "show"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Email Provider */}
          {tab === "email" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Choose which provider handles outreach emails. Set the credentials first in the{" "}
                <button onClick={() => setTab("keys")} className="text-brand-400 underline">API Keys tab</button>.
              </p>
              {(["gmail", "instantly"] as const).map((provider) => (
                <div key={provider} onClick={() => setEmailProvider(provider)}
                  className={clsx("border rounded-xl p-4 cursor-pointer transition-all",
                    emailProvider === provider ? "border-brand-500/50 bg-brand-500/5" : "border-surface-500 hover:border-surface-400")}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={clsx("w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        emailProvider === provider ? "border-brand-500" : "border-slate-600")}>
                        {emailProvider === provider && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {provider === "gmail" ? "Gmail" : "Instantly.ai"}
                      </span>
                    </div>
                    {provider === "gmail"
                      ? <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">Free</span>
                      : <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">Recommended for scale</span>}
                  </div>
                  <p className="text-xs text-slate-400 ml-6">
                    {provider === "gmail"
                      ? "Send from your Google account via OAuth. Best for personal outreach at lower volume."
                      : "Cold outreach at scale with email warmup, account rotation, and deliverability tools. Leads are added to campaigns automatically."}
                  </p>
                </div>
              ))}
              <div className="bg-surface-700 rounded-lg p-3 text-xs text-slate-400">
                Active provider: <strong className="text-brand-400">{emailProvider}</strong>.
                To switch, save <code className="text-brand-400">EMAIL_PROVIDER</code> in the API Keys tab and restart the app.
              </div>
            </div>
          )}

          {/* Webhooks */}
          {tab === "webhooks" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Fire HTTP POST requests to Zapier, Make, n8n, or any URL when events happen.</p>
              <div className="space-y-2">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">{wh.name}</p>
                      <p className="text-xs text-slate-500 truncate">{wh.url}</p>
                      <span className="text-xs text-slate-600">{wh.trigger}</span>
                    </div>
                    <button onClick={() => handleDeleteWebhook(wh.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="bg-surface-700 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">Add Webhook</p>
                <input value={newWebhook.name} onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="Name (e.g. Zapier New Lead)"
                  className="w-full bg-surface-800 border border-surface-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                <input value={newWebhook.url} onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://hooks.zapier.com/..."
                  className="w-full bg-surface-800 border border-surface-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                <select value={newWebhook.trigger} onChange={(e) => setNewWebhook({ ...newWebhook, trigger: e.target.value })}
                  className="w-full bg-surface-800 border border-surface-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500">
                  <option value="new_lead">New Lead Found</option>
                  <option value="analysis_complete">Analysis Complete</option>
                  <option value="status_change">Status Changed</option>
                </select>
                <button onClick={handleAddWebhook} className="btn-primary w-full justify-center text-xs">Add Webhook</button>
              </div>
            </div>
          )}

          {/* About */}
          {tab === "about" && (
            <div className="space-y-4">
              <div className="bg-surface-700 rounded-xl p-4 space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-white font-bold text-base">EAR Labs Scraper</p>
                  <span className="text-xs text-slate-500">v2.0 · powered by WeOps</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  AI-powered lead scraper that finds local businesses from Google Maps and Yelp, researches owner contact info,
                  analyzes digital presence, and generates personalized outreach via Claude AI.
                  Integrates with GoHighLevel, Gmail, Instantly.ai, and any webhook tool.
                </p>
              </div>
              <div className="bg-surface-700 rounded-xl p-4 space-y-2">
                <p className="text-white font-medium text-sm">Quick Start</p>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                  <li>Run <code className="text-brand-400">./start.sh</code> — the wizard sets everything up</li>
                  <li>Open <code className="text-brand-400">http://localhost:3000</code></li>
                  <li>Sign in with your email and enter the 6-digit code you receive</li>
                  <li>Go to <strong className="text-white">Settings → API Keys</strong> to add or update any key at any time</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
