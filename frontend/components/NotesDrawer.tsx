"use client";

import { useEffect, useState } from "react";
import { StickyNote, Plus, Trash2, X } from "lucide-react";
import { useStore, LeadNote } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  businessId: string;
  businessName: string;
  onClose: () => void;
}

export default function NotesDrawer({ businessId, businessName, onClose }: Props) {
  const { notes, setNotes, addNote, removeNote } = useStore();
  const businessNotes = notes[businessId] || [];
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getNotes(businessId)
      .then((data) => setNotes(businessId, data as LeadNote[]))
      .catch(() => {});
  }, [businessId]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const note = await api.addNote(businessId, newNote.trim());
      addNote(businessId, note as LeadNote);
      setNewNote("");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    await api.deleteNote(noteId);
    removeNote(businessId, noteId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <div className="flex items-center gap-2">
            <StickyNote size={15} className="text-amber-400" />
            <h3 className="font-semibold text-white text-sm">Notes</h3>
            <span className="text-xs text-slate-500">— {businessName}</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>

        <div className="max-h-72 overflow-y-auto px-5 py-3 space-y-2">
          {businessNotes.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">No notes yet. Add your first note below.</p>
          ) : (
            businessNotes.map((note) => (
              <div key={note.id} className="bg-surface-700 rounded-lg px-3 py-2.5 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-200 leading-relaxed flex-1">{note.content}</p>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-0.5"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1.5">
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-surface-600">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleAdd(); }}
              placeholder="Add a note... (⌘+Enter to save)"
              rows={2}
              className="flex-1 bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 resize-none focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newNote.trim()}
              className="btn-primary px-3 self-end"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
