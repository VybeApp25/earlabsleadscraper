"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface OrbitalNode {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
  view?: string;
}

interface RadialOrbitalTimelineProps {
  timelineData: OrbitalNode[];
  onNodeClick?: (node: OrbitalNode) => void;
}

export default function RadialOrbitalTimeline({ timelineData, onNodeClick }: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) newState[parseInt(key)] = false;
      });
      newState[id] = !prev[id];
      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const related = getRelatedItems(id);
        const pulse: Record<number, boolean> = {};
        related.forEach((rid) => { pulse[rid] = true; });
        setPulseEffect(pulse);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return newState;
    });
  };

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setRotationAngle((prev) => Number(((prev + 0.25) % 360).toFixed(3)));
    }, 50);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 185;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.35, Math.min(1, 0.35 + 0.65 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const item = timelineData.find((i) => i.id === itemId);
    return item ? item.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  const getStatusStyles = (status: OrbitalNode["status"]): string => {
    switch (status) {
      case "completed": return "text-green-400 bg-green-500/10 border-green-500/40";
      case "in-progress": return "text-brand-400 bg-brand-500/10 border-brand-500/40";
      case "pending": return "text-slate-400 bg-slate-500/10 border-slate-500/40";
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div
        className="relative flex items-center justify-center"
        ref={orbitRef}
        style={{ width: 480, height: 480 }}
      >
        {/* Orbit ring */}
        <div className="absolute w-[370px] h-[370px] rounded-full border border-surface-600/50" />
        <div className="absolute w-[340px] h-[340px] rounded-full border border-surface-600/20 border-dashed" />

        {/* Center nucleus */}
        <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-brand-500/40 via-brand-600/30 to-green-500/20 flex items-center justify-center z-10 border border-brand-500/30">
          <div className="absolute w-20 h-20 rounded-full border border-brand-500/15 animate-ping opacity-60" />
          <div className="absolute w-24 h-24 rounded-full border border-brand-500/10 animate-ping opacity-40" style={{ animationDelay: "0.5s" }} />
          <Zap size={20} className="text-brand-400" />
        </div>

        {/* EAR Labs label */}
        <div className="absolute top-[calc(50%+42px)] left-1/2 -translate-x-1/2 text-center z-10 pointer-events-none">
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">EAR Labs</p>
        </div>

        {/* Orbital nodes */}
        {timelineData.map((item, index) => {
          const position = calculateNodePosition(index, timelineData.length);
          const isExpanded = expandedItems[item.id];
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = pulseEffect[item.id];
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              ref={(el) => { nodeRefs.current[item.id] = el; }}
              className="absolute transition-all duration-700 cursor-pointer"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                zIndex: isExpanded ? 200 : position.zIndex,
                opacity: isExpanded ? 1 : position.opacity,
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
            >
              {/* Energy glow */}
              <div
                className={`absolute rounded-full ${isPulsing ? "animate-pulse" : ""}`}
                style={{
                  background: "radial-gradient(circle, rgba(79,110,247,0.15) 0%, transparent 70%)",
                  width: `${item.energy * 0.4 + 36}px`,
                  height: `${item.energy * 0.4 + 36}px`,
                  left: `-${(item.energy * 0.4 + 36 - 36) / 2}px`,
                  top: `-${(item.energy * 0.4 + 36 - 36) / 2}px`,
                }}
              />

              {/* Node icon */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isExpanded
                    ? "bg-brand-500 border-brand-400 shadow-lg shadow-brand-500/30 scale-150"
                    : isRelated
                    ? "bg-brand-500/20 border-brand-400/60 animate-pulse"
                    : "bg-surface-800 border-surface-500 hover:border-brand-500/60"
                  }`}
              >
                <Icon size={14} className={isExpanded ? "text-white" : isRelated ? "text-brand-300" : "text-slate-400"} />
              </div>

              {/* Label */}
              <div className={`absolute top-11 whitespace-nowrap text-xs font-medium tracking-wide transition-all duration-300 -translate-x-1/2 left-1/2
                ${isExpanded ? "text-white scale-110" : "text-slate-400"}`}>
                {item.title}
              </div>

              {/* Expanded card */}
              {isExpanded && (
                <Card className="absolute top-16 left-1/2 -translate-x-1/2 w-60 bg-surface-800/95 backdrop-blur-xl border-surface-500/60 shadow-2xl shadow-black/60 z-50">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-brand-500/50" />
                  <CardHeader className="pb-2 p-4">
                    <div className="flex justify-between items-center">
                      <Badge className={`px-2 text-[10px] border ${getStatusStyles(item.status)}`}>
                        {item.status === "completed" ? "LIVE" : item.status === "in-progress" ? "ACTIVE" : "READY"}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-500">{item.date}</span>
                    </div>
                    <CardTitle className="text-sm mt-2 text-white">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-slate-400 px-4 pb-4 pt-0">
                    <p>{item.content}</p>

                    {/* Energy bar */}
                    <div className="mt-3 pt-3 border-t border-surface-600">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="flex items-center gap-1 text-slate-500"><Zap size={9} />Capacity</span>
                        <span className="font-mono text-slate-400">{item.energy}%</span>
                      </div>
                      <div className="w-full h-1 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-green-400 rounded-full"
                          style={{ width: `${item.energy}%` }}
                        />
                      </div>
                    </div>

                    {/* Navigate button */}
                    {item.view && onNodeClick && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onNodeClick(item); }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 rounded-lg text-brand-400 text-xs font-medium transition-all"
                      >
                        Open {item.title} <ArrowRight size={11} />
                      </button>
                    )}

                    {/* Related nodes */}
                    {item.relatedIds.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-600">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
                          <Link size={9} />Connected
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {item.relatedIds.map((rid) => {
                            const rel = timelineData.find((i) => i.id === rid);
                            return (
                              <Button
                                key={rid}
                                variant="outline"
                                size="sm"
                                className="h-5 px-2 py-0 text-[10px] rounded border-surface-500 bg-transparent hover:bg-surface-700 text-slate-400 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); toggleItem(rid); }}
                              >
                                {rel?.title} <ArrowRight size={8} className="ml-1" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
