"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, Users, Mail, Trophy, Phone, BarChart2, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import clsx from "clsx";

const COLORS = ["#4f6ef7", "#4ade80", "#fbbf24", "#f87171", "#a78bfa", "#34d399", "#fb923c"];
const STATUS_COLORS: Record<string, string> = {
  new: "#4f6ef7", researched: "#60a5fa", contacted: "#fbbf24",
  replied: "#4ade80", proposal: "#a78bfa", won: "#22c55e", lost: "#f87171",
};

export default function DashboardView() {
  const { stats, businesses, analyses } = useStore();
  const [timeline, setTimeline] = useState<any[]>([]);
  const [byNiche, setByNiche] = useState<any[]>([]);
  const [byStatus, setByStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tl, niches, statuses] = await Promise.all([
          api.getTimeline(timeRange),
          api.getByNiche(),
          api.getByStatus(),
        ]);
        setTimeline(tl);
        setByNiche(niches.slice(0, 8));
        setByStatus(statuses);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [timeRange]);

  const avgScore = Object.values(analyses).length
    ? Math.round(Object.values(analyses).reduce((sum, a) => sum + (a.opportunity_score || 0), 0) / Object.values(analyses).length)
    : 0;

  const conversionRate = stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setTimeRange(d)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                timeRange === d ? "bg-brand-500 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} />} label="Total Leads" value={stats.total} color="text-brand-400" />
        <StatCard icon={<Mail size={18} />} label="With Email" value={stats.with_email} color="text-blue-400" />
        <StatCard icon={<Phone size={18} />} label="Contacted" value={stats.contacted} color="text-amber-400" />
        <StatCard icon={<Trophy size={18} />} label="Won" value={stats.won} color="text-green-400" sub={`${conversionRate}% rate`} />
        <StatCard icon={<BarChart2 size={18} />} label="Analyzed" value={stats.analyzed} color="text-purple-400" />
        <StatCard icon={<TrendingUp size={18} />} label="Avg Opp. Score" value={avgScore} color="text-cyan-400" sub="out of 100" />
        <StatCard icon={<Users size={18} />} label="New Today" value={stats.new} color="text-green-400" pulse />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Analyze Rate"
          value={stats.total > 0 ? `${Math.round((stats.analyzed / stats.total) * 100)}%` : "0%"}
          color="text-violet-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading charts...
        </div>
      ) : (
        <>
          {/* Leads over time */}
          <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Leads Found Over Time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232b42" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1a2033", border: "1px solid #232b42", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#4f6ef7" }} />
                <Area type="monotone" dataKey="count" stroke="#4f6ef7" strokeWidth={2}
                  fill="url(#colorLeads)" name="New Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By niche */}
            <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Leads by Niche</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byNiche} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b42" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="niche" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip contentStyle={{ background: "#1a2033", border: "1px solid #232b42", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#4f6ef7" }} />
                  <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                    {byNiche.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By status */}
            <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Pipeline Status</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      dataKey="count" nameKey="status" paddingAngle={3}>
                      {byStatus.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a2033", border: "1px solid #232b42", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {byStatus.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.status] || COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-400 capitalize flex-1">{s.status}</span>
                      <span className="text-xs font-bold text-white">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, sub, pulse }: {
  icon: React.ReactNode; label: string; value: number | string;
  color?: string; sub?: string; pulse?: boolean;
}) {
  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <span className={clsx("opacity-70", color)}>{icon}</span>
        {pulse && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
      </div>
      <p className={clsx("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}
