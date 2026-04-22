"use client";

import { useState } from "react";
import {
  Globe, Phone, Mail, Star, ExternalLink, Zap, MessageSquare,
  Send, BarChart2, Trash2, ChevronDown, ChevronUp, Building2,
  Instagram, Facebook, Linkedin, Twitter, AlertTriangle, CheckCircle,
  StickyNote, User, CheckSquare, Square
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Business, Analysis, useStore } from "../lib/store";
import { api } from "../lib/api";
import ScoreRing from "./ScoreRing";
import TemplateModal from "./TemplateModal";
import OwnerContactPanel from "./OwnerContactPanel";
import NotesDrawer from "./NotesDrawer";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  researched: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  replied: "bg-lime-500/10 text-lime-400 border-lime-500/20",
  proposal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  won: "bg-green-500/10 text-green-400 border-green-500/20",
  lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} />,
  facebook: <Facebook size={12} />,
  linkedin: <Linkedin size={12} />,
  twitter: <Twitter size={12} />,
};

interface Props {
  business: Business;
  analysis?: Analysis;
  onAnalyze: () => void;
  onDelete: () => void;
  onMarkSeen: () => void;
}

export default function BusinessCard({ business, analysis, onAnalyze, onDelete, onMarkSeen }: Props) {
  const { selectedIds, toggleSelected, updateBusiness, notes } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<"email" | "dm" | "lovable" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const isSelected = selectedIds.has(business.id);
  const noteCount = notes[business.id]?.length || 0;

  const handleExportGHL = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExporting(true);
    try {
      const res: any = await api.exportGHL(business.id);
      if (res.success) toast.success("Exported to GoHighLevel");
      else toast.error(res.error || "GHL export failed");
    } catch {
      toast.error("GHL export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setStatusOpen(false);
    updateBusiness(business.id, { status: status as any });
    await api.updateStatus(business.id, status);
    toast.success(`Status → ${status}`);
  };

  const handleCardClick = () => {
    if (business.is_new) onMarkSeen();
    setExpanded(!expanded);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-surface-800 border rounded-xl overflow-hidden card-hover transition-all duration-300",
          business.is_new
            ? "border-green-500/40 new-glow animate-pulse-new"
            : isSelected
            ? "border-brand-500/50 ring-1 ring-brand-500/20"
            : "border-surface-600 hover:border-surface-500"
        )}
      >
        {/* NEW badge */}
        {business.is_new && (
          <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-green-400 tracking-wide">NEW LEAD</span>
            <span className="ml-auto text-xs text-green-300/50 capitalize">{business.source}</span>
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            {/* Checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelected(business.id); }}
              className="mt-0.5 text-slate-600 hover:text-brand-400 transition-colors shrink-0"
            >
              {isSelected ? <CheckSquare size={16} className="text-brand-400" /> : <Square size={16} />}
            </button>

            <div className="w-9 h-9 rounded-lg bg-surface-600 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-slate-400" />
            </div>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={handleCardClick}>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white text-sm leading-tight">{business.name}</h3>
                <span className={clsx("text-xs px-1.5 py-0.5 rounded-full border capitalize", STATUS_COLORS[business.status || "new"])}>
                  {business.status || "new"}
                </span>
                {business.is_duplicate && (
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    duplicate
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{business.address}</p>
            </div>

            {analysis && (
              <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <ScoreRing score={analysis.social_proof_score} size={42} label="Social" />
                <ScoreRing score={analysis.opportunity_score} size={42} label="Oppty" />
              </div>
            )}
          </div>

          {/* Quick info */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
            {business.phone && (
              <a href={`tel:${business.phone}`} onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone size={11} className="text-slate-500" />{business.phone}
              </a>
            )}
            {business.emails.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Mail size={11} className="text-slate-500" />
                {business.emails[0]}
                {business.emails.length > 1 && <span className="text-slate-600">+{business.emails.length - 1}</span>}
              </span>
            )}
            {business.google_rating && (
              <span className="flex items-center gap-1">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span className="text-amber-400 font-medium">{business.google_rating}</span>
                <span className="text-slate-600">({business.google_review_count?.toLocaleString()})</span>
              </span>
            )}
          </div>

          {/* Website + social */}
          <div className="flex items-center gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
            {business.website ? (
              <a href={business.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                <Globe size={11} />
                {business.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-400/70">
                <AlertTriangle size={11} />No website
              </span>
            )}
            <div className="flex gap-1.5 ml-2">
              {Object.entries(business.social_links || {}).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                  className="w-6 h-6 rounded-md bg-surface-600 flex items-center justify-center text-slate-400 hover:text-brand-400 transition-colors">
                  {SOCIAL_ICONS[platform] ?? <Globe size={11} />}
                </a>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {!business.is_analyzed ? (
              <button onClick={onAnalyze} className="btn-primary text-xs py-1.5">
                <BarChart2 size={13} />Analyze
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-green-400/80">
                <CheckCircle size={12} />Analyzed
              </span>
            )}

            {analysis && (
              <>
                <button onClick={() => setModal("lovable")}
                  className="btn-outline text-xs py-1.5 text-purple-400 border-purple-500/30 hover:border-purple-400">
                  <Zap size={13} />Lovable
                </button>
                <button onClick={() => setModal("email")} className="btn-outline text-xs py-1.5">
                  <Mail size={13} />Email
                </button>
                <button onClick={() => setModal("dm")} className="btn-outline text-xs py-1.5">
                  <MessageSquare size={13} />DM
                </button>
                <button onClick={handleExportGHL} disabled={exporting}
                  className="btn-outline text-xs py-1.5 text-orange-400 border-orange-500/30 hover:border-orange-400">
                  <Send size={13} />{exporting ? "..." : "→ GHL"}
                </button>
              </>
            )}

            {/* Status selector */}
            <div className="relative">
              <button onClick={() => setStatusOpen(!statusOpen)}
                className="btn-ghost text-xs py-1.5 text-slate-500">
                Status
              </button>
              {statusOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-surface-700 border border-surface-500 rounded-lg shadow-xl z-20 overflow-hidden min-w-32">
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-surface-600 capitalize transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <button onClick={() => setNotesOpen(true)}
              className="btn-ghost text-xs py-1.5 relative">
              <StickyNote size={13} />
              Notes
              {noteCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-xs text-black font-bold flex items-center justify-center">
                  {noteCount}
                </span>
              )}
            </button>

            <button onClick={onDelete} className="btn-ghost text-xs py-1.5 text-red-400/60 hover:text-red-400 ml-auto">
              <Trash2 size={13} />
            </button>
            <button onClick={handleCardClick} className="btn-ghost text-xs py-1.5 text-slate-500">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Owner contact panel */}
        <OwnerContactPanel businessId={business.id} businessName={business.name} />

        {/* Expanded analysis */}
        {expanded && analysis && (
          <div className="border-t border-surface-600 px-4 py-4 space-y-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 flex-wrap">
              <div className={clsx("px-2.5 py-1 rounded-md text-xs font-medium border",
                analysis.website_is_outdated
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-green-500/10 text-green-400 border-green-500/20"
              )}>
                {analysis.website_is_outdated ? "⚠ Outdated Website" : "✓ Modern Website"}
              </div>
              {analysis.website_age_years && (
                <span className="text-xs text-slate-500 mt-1">Domain: {analysis.website_age_years}yr old</span>
              )}
            </div>

            {analysis.traffic_monthly ? (
              <div>
                <p className="text-xs text-slate-500 mb-2">Estimated Traffic</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Daily", value: analysis.traffic_daily },
                    { label: "Weekly", value: analysis.traffic_weekly },
                    { label: "Monthly", value: analysis.traffic_monthly },
                    { label: "Yearly", value: analysis.traffic_yearly },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-700 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-white">{value?.toLocaleString() ?? "—"}</p>
                      <p className="text-xs text-slate-600">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.pain_points?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Pain Points</p>
                <ul className="space-y-1">
                  {analysis.pain_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-red-400 mt-0.5">•</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.website_summary && (
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Website Analysis</p>
                <p className="text-xs text-slate-300 leading-relaxed">{analysis.website_summary}</p>
              </div>
            )}

            {analysis.social_proof_breakdown && Object.keys(analysis.social_proof_breakdown).length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Social Proof Breakdown</p>
                {Object.entries(analysis.social_proof_breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 mb-1.5">
                    <span className="text-xs text-slate-400 w-36 capitalize">{key.replace(/_/g, " ")}</span>
                    <div className="flex-1 bg-surface-700 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(val) / 25) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{val}/25</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && analysis && (
        <TemplateModal type={modal} business={business} analysis={analysis} onClose={() => setModal(null)} />
      )}
      {notesOpen && (
        <NotesDrawer businessId={business.id} businessName={business.name} onClose={() => setNotesOpen(false)} />
      )}
    </>
  );
}
