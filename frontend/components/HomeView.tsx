"use client";

import { useStore, AppView } from "../lib/store";
import { toast } from "sonner";
import RadialOrbitalTimeline, { OrbitalNode } from "./ui/radial-orbital-timeline";
import {
  LayoutGrid, Kanban, BarChart2, Mail, User, Zap, Download, MessageSquare
} from "lucide-react";

export default function HomeView() {
  const { stats, setActiveView } = useStore();

  const orbitalNodes: OrbitalNode[] = [
    {
      id: 1,
      title: "Leads",
      date: `${stats.total} found`,
      content: "Search and discover businesses via Google Places and Yelp. Filter by niche, location, and opportunity score.",
      category: "Core",
      icon: LayoutGrid,
      relatedIds: [5, 7],
      status: stats.total > 0 ? "completed" : "in-progress",
      energy: Math.min(100, stats.total > 0 ? 70 + Math.min(30, stats.total) : 40),
      view: "leads",
    },
    {
      id: 2,
      title: "Pipeline",
      date: `${stats.won} won`,
      content: "Visual Kanban board — move leads through New → Researched → Contacted → Replied → Proposal → Won.",
      category: "CRM",
      icon: Kanban,
      relatedIds: [1, 4],
      status: stats.contacted > 0 ? "in-progress" : "pending",
      energy: stats.contacted > 0 ? 65 : 30,
      view: "pipeline",
    },
    {
      id: 3,
      title: "Dashboard",
      date: "Analytics",
      content: "Live charts: activity timeline, top niches, pipeline breakdown, and lead source comparison.",
      category: "Analytics",
      icon: BarChart2,
      relatedIds: [1, 5],
      status: stats.total > 0 ? "completed" : "pending",
      energy: stats.total > 0 ? 85 : 20,
      view: "dashboard",
    },
    {
      id: 4,
      title: "Sequences",
      date: "Outreach",
      content: "Build multi-step email sequences with day delays. Auto-enroll leads and track opens via Gmail or Instantly.ai.",
      category: "Outreach",
      icon: Mail,
      relatedIds: [2, 6],
      status: "in-progress",
      energy: 60,
      view: "sequences",
    },
    {
      id: 5,
      title: "AI Analysis",
      date: `${stats.analyzed} done`,
      content: "Claude-powered analysis: website quality, traffic estimates, social proof score, pain points, and personalized cold email templates.",
      category: "AI",
      icon: Zap,
      relatedIds: [1, 6],
      status: stats.analyzed > 0 ? "completed" : "pending",
      energy: stats.analyzed > 0 ? Math.min(95, 40 + stats.analyzed * 5) : 15,
      view: "leads",
    },
    {
      id: 6,
      title: "Owner Finder",
      date: "Multi-source",
      content: "Finds personal phones, emails, and LinkedIn profiles using Hunter.io, People Data Labs, WHOIS, and Google Search.",
      category: "Research",
      icon: User,
      relatedIds: [5, 4],
      status: "completed",
      energy: 78,
      view: "leads",
    },
    {
      id: 7,
      title: "Export",
      date: "CSV · Excel · GHL",
      content: "Export all leads to CSV, styled Excel with summary sheet, or push directly to GoHighLevel CRM as contacts.",
      category: "Export",
      icon: Download,
      relatedIds: [1],
      status: "completed",
      energy: 92,
      view: "leads",
    },
    {
      id: 8,
      title: "AI Chat",
      date: "Ask ZAP",
      content: "Natural language interface for your leads. Search, filter, analyze, and export using plain English.",
      category: "AI",
      icon: MessageSquare,
      relatedIds: [5, 1],
      status: "completed",
      energy: 88,
      view: "ai-chat",
    },
  ];

  const handleNodeClick = (node: OrbitalNode) => {
    if (node.view) {
      setActiveView(node.view as AppView);
      toast(`Opening ${node.title}`);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-6 pb-2 shrink-0">
        <h2 className="text-xl font-semibold text-white tracking-tight">Command Center</h2>
        <p className="text-sm text-slate-500 mt-0.5">Click any node to open that feature</p>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <RadialOrbitalTimeline timelineData={orbitalNodes} onNodeClick={handleNodeClick} />
      </div>
    </div>
  );
}
