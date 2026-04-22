"use client";

import { useState } from "react";
import { User, Phone, Mail, Linkedin, Facebook, Search, Loader2, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useStore, OwnerContact } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

interface Props {
  businessId: string;
  businessName: string;
}

const CONFIDENCE_STYLES = {
  high: { icon: <ShieldCheck size={12} />, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "High Confidence" },
  medium: { icon: <Shield size={12} />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Medium Confidence" },
  low: { icon: <ShieldAlert size={12} />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Low Confidence" },
};

export default function OwnerContactPanel({ businessId, businessName }: Props) {
  const { owners, setOwner } = useStore();
  const owner = owners[businessId];
  const [loading, setLoading] = useState(false);

  const handleFindOwner = async () => {
    setLoading(true);
    try {
      await api.findOwner(businessId);
      toast("Searching for owner contact info...", { description: "This may take 15-30 seconds" });

      // Poll for result
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const result = await api.getOwner(businessId);
          setOwner(result);
          clearInterval(poll);
          toast.success("Owner contact info found!");
        } catch {
          if (attempts > 15) {
            clearInterval(poll);
            toast("Search complete", { description: "Limited data found for this business" });
          }
        }
      }, 2000);
    } catch {
      toast.error("Owner search failed");
    } finally {
      setLoading(false);
    }
  };

  if (!owner) {
    return (
      <div className="border-t border-surface-600 px-4 py-3">
        <button
          onClick={handleFindOwner}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-surface-500 hover:border-brand-500 text-slate-500 hover:text-brand-400 text-xs font-medium transition-all"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {loading ? "Searching owner info..." : "Find Owner Contact"}
        </button>
        <p className="text-xs text-slate-600 text-center mt-1.5">
          Searches Google, WHOIS, Hunter.io & People Data Labs
        </p>
      </div>
    );
  }

  const conf = CONFIDENCE_STYLES[owner.confidence as keyof typeof CONFIDENCE_STYLES] || CONFIDENCE_STYLES.low;
  const hasAnyData = owner.owner_name || owner.personal_phone || owner.personal_email || owner.linkedin_url;

  return (
    <div className="border-t border-surface-600 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <User size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Owner Contact</span>
        </div>
        <div className={clsx("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", conf.color, conf.bg)}>
          {conf.icon}
          {conf.label}
        </div>
      </div>

      {!hasAnyData ? (
        <div className="text-xs text-slate-600 py-2 text-center">No owner data found publicly</div>
      ) : (
        <div className="space-y-2">
          {owner.owner_name && (
            <ContactRow icon={<User size={12} />} label={owner.owner_name} sub={owner.owner_title} />
          )}
          {owner.personal_phone && (
            <ContactRow
              icon={<Phone size={12} />}
              label={owner.personal_phone}
              sub="Personal phone"
              copyable
              href={`tel:${owner.personal_phone}`}
            />
          )}
          {owner.personal_email && (
            <ContactRow
              icon={<Mail size={12} />}
              label={owner.personal_email}
              sub="Personal email"
              copyable
              href={`mailto:${owner.personal_email}`}
            />
          )}
          {owner.linkedin_url && (
            <ContactRow
              icon={<Linkedin size={12} />}
              label="LinkedIn Profile"
              href={owner.linkedin_url}
              external
            />
          )}
          {owner.facebook_url && (
            <ContactRow
              icon={<Facebook size={12} />}
              label="Facebook Profile"
              href={owner.facebook_url}
              external
            />
          )}
        </div>
      )}

      {owner.sources?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {owner.sources.map((s) => (
            <span key={s} className="text-xs bg-surface-700 text-slate-500 px-1.5 py-0.5 rounded">
              {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={handleFindOwner}
        disabled={loading}
        className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
        Refresh search
      </button>
    </div>
  );
}

function ContactRow({ icon, label, sub, copyable, href, external }: {
  icon: React.ReactNode; label: string; sub?: string;
  copyable?: boolean; href?: string; external?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(label);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const content = (
    <div className="flex items-center gap-2 group">
      <span className="text-slate-500">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{label}</p>
        {sub && <p className="text-xs text-slate-600">{sub}</p>}
      </div>
      {copyable && (
        <button onClick={handleCopy} className="text-xs text-slate-600 hover:text-brand-400 transition-colors opacity-0 group-hover:opacity-100">
          {copied ? "✓" : "copy"}
        </button>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel="noopener noreferrer"
        className="block hover:bg-surface-700 rounded-md px-2 py-1.5 transition-colors">
        {content}
      </a>
    );
  }

  return <div className="px-2 py-1.5">{content}</div>;
}
