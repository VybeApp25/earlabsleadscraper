"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, Trash2, Play, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

interface Step { subject: string; body: string; delay_days: number; }
interface Sequence { id: string; name: string; description: string; is_active: boolean; steps: any[]; }

export default function EmailSequencePanel() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [steps, setSteps] = useState<Step[]>([
    { subject: "", body: "", delay_days: 0 },
    { subject: "", body: "", delay_days: 3 },
    { subject: "", body: "", delay_days: 7 },
  ]);

  useEffect(() => {
    api.getSequences().then((data) => setSequences(data as Sequence[])).catch(() => {});
  }, []);

  const addStep = () => setSteps([...steps, { subject: "", body: "", delay_days: 0 }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: keyof Step, value: string | number) =>
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Sequence needs a name"); return; }
    try {
      const created: any = await api.createSequence({ ...form, steps });
      const updated: any = await api.getSequences();
      setSequences(updated);
      toast.success(`Sequence "${form.name}" created`);
      setCreating(false);
      setForm({ name: "", description: "" });
      setSteps([{ subject: "", body: "", delay_days: 0 }, { subject: "", body: "", delay_days: 3 }]);
    } catch {
      toast.error("Failed to create sequence");
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteSequence(id);
    setSequences(sequences.filter((s) => s.id !== id));
    toast.success("Sequence deleted");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Email Sequences</h1>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus size={14} /> New Sequence
        </button>
      </div>

      {creating && (
        <div className="bg-surface-800 border border-brand-500/30 rounded-xl p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">Create Sequence</h3>

          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sequence name (e.g. Hair Salon Outreach)"
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">Steps</p>
              <button onClick={addStep} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <Plus size={11} /> Add step
              </button>
            </div>

            {steps.map((step, i) => (
              <div key={i} className="bg-surface-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    Step {i + 1} {i === 0 ? "(Day 0 — Initial)" : `(Day ${step.delay_days})`}
                  </span>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="text-slate-600 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {i > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Send after day:</label>
                    <input
                      type="number" min={1} max={30}
                      value={step.delay_days}
                      onChange={(e) => updateStep(i, "delay_days", Number(e.target.value))}
                      className="w-16 bg-surface-800 border border-surface-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                <input
                  value={step.subject}
                  onChange={(e) => updateStep(i, "subject", e.target.value)}
                  placeholder="Subject line..."
                  className="w-full bg-surface-800 border border-surface-500 rounded-md px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
                <textarea
                  value={step.body}
                  onChange={(e) => updateStep(i, "body", e.target.value)}
                  placeholder="Email body... Use {{name}}, {{city}}, {{niche}} as placeholders"
                  rows={3}
                  className="w-full bg-surface-800 border border-surface-500 rounded-md px-3 py-2 text-xs text-white placeholder-slate-600 resize-none focus:outline-none focus:border-brand-500"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary">Create Sequence</button>
            <button onClick={() => setCreating(false)} className="btn-ghost text-slate-500">Cancel</button>
          </div>
        </div>
      )}

      {sequences.length === 0 && !creating ? (
        <div className="text-center py-12 text-slate-600">
          <Mail size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sequences yet</p>
          <p className="text-xs mt-1">Create a multi-step email sequence to automate follow-ups</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div key={seq.id} className="bg-surface-800 border border-surface-600 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-700 transition-colors"
                onClick={() => setExpanded(expanded === seq.id ? null : seq.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                    <Mail size={14} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{seq.name}</p>
                    <p className="text-xs text-slate-500">{seq.steps.length} steps{seq.description ? ` · ${seq.description}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(seq.id); }}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  {expanded === seq.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
              </div>

              {expanded === seq.id && (
                <div className="border-t border-surface-600 px-4 py-3 space-y-2 animate-fade-in">
                  {seq.steps.map((step: any, i: number) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                          {i + 1}
                        </div>
                        {i < seq.steps.length - 1 && <div className="w-px flex-1 bg-surface-600 my-1" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-slate-400">{i === 0 ? "Day 0" : `Day ${step.delay_days}`} · {step.subject || "(no subject)"}</p>
                        <p className="text-slate-600 truncate">{step.body?.slice(0, 80)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
