"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Globe, Phone, Star, Mail, Building2 } from "lucide-react";
import { useStore, Business, LeadStatus } from "../lib/store";
import { api } from "../lib/api";
import { toast } from "sonner";
import clsx from "clsx";

const COLUMNS: { id: LeadStatus; label: string; color: string; bg: string }[] = [
  { id: "new", label: "New", color: "text-blue-400", bg: "border-blue-500/20" },
  { id: "researched", label: "Researched", color: "text-cyan-400", bg: "border-cyan-500/20" },
  { id: "contacted", label: "Contacted", color: "text-amber-400", bg: "border-amber-500/20" },
  { id: "replied", label: "Replied", color: "text-lime-400", bg: "border-lime-500/20" },
  { id: "proposal", label: "Proposal", color: "text-purple-400", bg: "border-purple-500/20" },
  { id: "won", label: "Won", color: "text-green-400", bg: "border-green-500/30" },
  { id: "lost", label: "Lost", color: "text-red-400", bg: "border-red-500/20" },
];

export default function KanbanBoard() {
  const { businesses, updateBusiness } = useStore();
  const [dragging, setDragging] = useState(false);

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = businesses.filter((b) => (b.status || "new") === col.id);
    return acc;
  }, {} as Record<LeadStatus, Business[]>);

  const onDragEnd = async (result: DropResult) => {
    setDragging(false);
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as LeadStatus;

    updateBusiness(draggableId, { status: newStatus });
    try {
      await api.updateStatus(draggableId, newStatus);
      toast.success(`Moved to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="p-6 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Pipeline</h1>
        <span className="text-xs text-slate-500">Drag leads between stages</span>
      </div>

      <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 h-full">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex-shrink-0 w-64">
              {/* Column header */}
              <div className={clsx("flex items-center justify-between mb-3 px-1")}>
                <span className={clsx("text-xs font-semibold uppercase tracking-wide", col.color)}>
                  {col.label}
                </span>
                <span className="text-xs bg-surface-700 text-slate-400 rounded-full px-2 py-0.5">
                  {byStatus[col.id]?.length || 0}
                </span>
              </div>

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={clsx(
                      "min-h-32 rounded-xl border p-2 space-y-2 transition-colors",
                      snapshot.isDraggingOver
                        ? "bg-surface-700 border-brand-500/40"
                        : `bg-surface-800 ${col.bg}`
                    )}
                  >
                    {byStatus[col.id]?.map((biz, index) => (
                      <Draggable key={biz.id} draggableId={biz.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={clsx(
                              "bg-surface-700 border border-surface-500 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all",
                              snap.isDragging && "shadow-2xl ring-1 ring-brand-500/50 rotate-1"
                            )}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <div className="w-6 h-6 rounded-md bg-surface-600 flex items-center justify-center shrink-0">
                                <Building2 size={11} className="text-slate-400" />
                              </div>
                              <p className="text-xs font-semibold text-white leading-tight line-clamp-2">
                                {biz.name}
                              </p>
                            </div>

                            {biz.niche && (
                              <span className="text-xs bg-surface-600 text-slate-400 px-1.5 py-0.5 rounded mb-2 inline-block">
                                {biz.niche}
                              </span>
                            )}

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {biz.google_rating && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-400">
                                  <Star size={9} className="fill-amber-400" />
                                  {biz.google_rating}
                                </span>
                              )}
                              {biz.phone && <Phone size={10} className="text-slate-500" />}
                              {biz.emails?.length > 0 && <Mail size={10} className="text-slate-500" />}
                              {biz.website && <Globe size={10} className="text-slate-500" />}
                              {biz.is_new && (
                                <span className="text-xs text-green-400 font-medium">NEW</span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {byStatus[col.id]?.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center py-6 text-xs text-slate-600">
                        Drop leads here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
