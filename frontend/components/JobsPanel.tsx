"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, PlayCircle, PauseCircle, Zap } from "lucide-react";
import { useStore, SearchJob } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

interface Props { onJobsChanged: () => void; }

export default function JobsPanel({ onJobsChanged }: Props) {
  const { jobs, setJobs, autonomousMode } = useStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ niche: "", location: "", interval_minutes: 60 });

  const handleCreate = async () => {
    if (!form.niche || !form.location) return;
    try {
      await api.createJob({ ...form, is_autonomous: autonomousMode });
      const updated = await api.getJobs();
      setJobs(updated as SearchJob[]);
      toast.success("Scheduled job created");
      setCreating(false);
      setForm({ niche: "", location: "", interval_minutes: 60 });
      onJobsChanged();
    } catch {
      toast.error("Failed to create job");
    }
  };

  const handleToggle = async (id: string) => {
    await api.toggleJob(id);
    const updated = await api.getJobs();
    setJobs(updated as SearchJob[]);
    onJobsChanged();
  };

  const handleDelete = async (id: string) => {
    await api.deleteJob(id);
    setJobs(jobs.filter((j) => j.id !== id));
    onJobsChanged();
  };

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Clock size={14} className="text-brand-400" />
          Scheduled Jobs
        </h2>
        <button
          onClick={() => setCreating(!creating)}
          className="btn-ghost text-xs p-1.5"
          title="New scheduled job"
        >
          <Plus size={14} />
        </button>
      </div>

      {creating && (
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 mb-3 space-y-2 animate-fade-in">
          <input
            placeholder="Niche (e.g. Hair Salon)"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            className="w-full bg-surface-800 border border-surface-500 rounded-md px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
          <input
            placeholder="Location (e.g. Atlanta, GA)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full bg-surface-800 border border-surface-500 rounded-md px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
          <select
            value={form.interval_minutes}
            onChange={(e) => setForm({ ...form, interval_minutes: Number(e.target.value) })}
            className="w-full bg-surface-800 border border-surface-500 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value={15}>Every 15 min</option>
            <option value={30}>Every 30 min</option>
            <option value={60}>Every hour</option>
            <option value={360}>Every 6 hours</option>
            <option value={1440}>Daily</option>
          </select>
          <button onClick={handleCreate} className="btn-primary w-full text-xs justify-center py-2">
            Create Job
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-4">No scheduled jobs yet</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="bg-surface-700 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {job.is_autonomous && <Zap size={10} className="text-green-400" />}
                    <span className="text-xs font-medium text-white truncate">{job.niche}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{job.location} · every {job.interval_minutes}m</p>
                  {job.last_run && (
                    <p className="text-xs text-slate-600">
                      Last: {new Date(job.last_run).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-slate-500 mr-1">{job.total_found}</span>
                  <button
                    onClick={() => handleToggle(job.id)}
                    className={clsx("p-1 rounded transition-colors", job.is_active ? "text-green-400" : "text-slate-600 hover:text-slate-400")}
                  >
                    {job.is_active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
