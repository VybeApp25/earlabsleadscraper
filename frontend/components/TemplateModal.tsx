"use client";

import { useState } from "react";
import { X, Copy, Check, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Business, Analysis } from "../lib/store";
import { api } from "../lib/api";
import clsx from "clsx";

interface Props {
  type: "email" | "dm" | "lovable";
  business: Business;
  analysis: Analysis;
  onClose: () => void;
}

const TITLES = {
  email: "Cold Email Template",
  dm: "Social DM Template",
  lovable: "Lovable.ai Website Prompt",
};

const COLORS = {
  email: "text-blue-400",
  dm: "text-purple-400",
  lovable: "text-violet-400",
};

export default function TemplateModal({ type, business, analysis, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [editedContent, setEditedContent] = useState(
    type === "email"
      ? analysis.email_template || ""
      : type === "dm"
      ? analysis.dm_template || ""
      : analysis.lovable_prompt || ""
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLovable = () => {
    navigator.clipboard.writeText(editedContent);
    toast.success("Prompt copied — opening Lovable.ai");
    window.open("https://lovable.dev", "_blank");
  };

  const handleSendEmail = async () => {
    if (!business.emails.length) {
      toast.error("No email address found for this business");
      return;
    }
    const lines = editedContent.split("\n");
    const subjectLine = lines.find((l) => l.startsWith("Subject:"));
    const subject = subjectLine?.replace("Subject:", "").trim() || `Following up on ${business.name}`;
    const body = lines.filter((l) => !l.startsWith("Subject:")).join("\n").trim();

    setSending(true);
    try {
      const res: any = await api.sendEmail(business.emails[0], subject, body);
      if (res.success) toast.success(`Email sent to ${business.emails[0]}`);
      else toast.error(res.error || "Send failed — check Gmail config");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-800 border border-surface-500 rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div>
            <h2 className={clsx("font-semibold text-base", COLORS[type])}>{TITLES[type]}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{business.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        {/* Lovable info banner */}
        {type === "lovable" && (
          <div className="mx-6 mt-4 bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-violet-300 leading-relaxed">
              Copy this prompt and paste it into <strong>Lovable.ai</strong> to instantly generate a modern website for this business.
              {analysis.website_is_outdated && (
                <span className="block mt-1 text-amber-300">
                  ⚠ Their current site is outdated — this prompt includes a full redesign brief.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Editable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-64 bg-surface-700 border border-surface-500 rounded-xl p-4 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:border-brand-500 leading-relaxed"
            spellCheck={false}
          />
          <p className="text-xs text-slate-600 mt-2">You can edit this before copying or sending.</p>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-surface-600 flex items-center gap-3 flex-wrap">
          <button onClick={handleCopy} className="btn-primary">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>

          {type === "lovable" && (
            <button
              onClick={handleOpenLovable}
              className="btn-outline text-violet-400 border-violet-500/30 hover:border-violet-400"
            >
              <ExternalLink size={14} />
              Open Lovable.ai
            </button>
          )}

          {type === "email" && (
            <button
              onClick={handleSendEmail}
              disabled={sending || !business.emails.length}
              className="btn-outline text-blue-400 border-blue-500/30 hover:border-blue-400"
            >
              <Send size={14} />
              {sending ? "Sending..." : `Send via Gmail`}
            </button>
          )}

          <button onClick={onClose} className="btn-ghost ml-auto text-slate-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
