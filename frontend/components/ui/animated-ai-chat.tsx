"use client";

import { useEffect, useRef, useCallback, useTransition, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search, Zap, Download, SlidersHorizontal,
  ArrowUpIcon, Paperclip, Command, SendIcon,
  XIcon, LoaderIcon, Sparkles, LayoutGrid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { api } from "@/lib/api";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = `${minHeight}px`;
    if (!reset) {
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    }
  }, [minHeight, maxHeight]);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; [key: string]: any };
}

interface AnimatedAIChatProps {
  onAction?: (action: { type: string; [key: string]: any }) => void;
  stats?: { total: number; analyzed: number; new: number };
}

export function AnimatedAIChat({ onAction, stats }: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 160 });
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const commandSuggestions: CommandSuggestion[] = [
    { icon: <Search className="w-4 h-4" />, label: "Search Leads", description: "Find businesses by niche + location", prefix: "/search" },
    { icon: <Zap className="w-4 h-4" />, label: "Analyze All", description: "Run AI analysis on new leads", prefix: "/analyze" },
    { icon: <SlidersHorizontal className="w-4 h-4" />, label: "Filter Leads", description: "Smart filter by score or status", prefix: "/filter" },
    { icon: <Download className="w-4 h-4" />, label: "Export", description: "Export leads to CSV or Excel", prefix: "/export" },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);
      const idx = commandSuggestions.findIndex((c) => c.prefix.startsWith(value));
      setActiveSuggestion(idx >= 0 ? idx : -1);
    } else {
      setShowCommandPalette(false);
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = document.querySelector("[data-command-button]");
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(e.target as Node) && !btn?.contains(e.target as Node)) {
        setShowCommandPalette(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((p) => (p < commandSuggestions.length - 1 ? p + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion((p) => (p > 0 ? p - 1 : commandSuggestions.length - 1)); }
      else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) selectCommand(activeSuggestion);
      } else if (e.key === "Escape") { e.preventDefault(); setShowCommandPalette(false); }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isTyping) handleSend();
    }
  };

  const selectCommand = (index: number) => {
    setValue(commandSuggestions[index].prefix + " ");
    setShowCommandPalette(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    const message = value.trim();
    if (!message || isTyping) return;

    const userMsg: ChatMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setValue("");
    adjustHeight(true);
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await (api as any).chat(message, history);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        action: data.action,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.action && onAction) onAction(data.action);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that right now. Try again or use the search panel directly." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Stats row */}
      {stats && (
        <div className="flex items-center gap-4 px-1">
          <span className="text-xs text-slate-500">{stats.total} leads</span>
          <span className="w-px h-3 bg-surface-600" />
          <span className="text-xs text-green-400">{stats.new} new</span>
          <span className="w-px h-3 bg-surface-600" />
          <span className="text-xs text-brand-400">{stats.analyzed} analyzed</span>
        </div>
      )}

      {/* Message history */}
      <AnimatePresence>
        {messages.length > 0 && (
          <motion.div
            className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={11} className="text-brand-400" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-brand-500/15 border border-brand-500/25 text-white"
                    : "bg-surface-700/80 border border-surface-600 text-slate-300"
                )}>
                  {msg.content}
                  {msg.action && onAction && (
                    <button
                      onClick={() => onAction(msg.action!)}
                      className="mt-1.5 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <LayoutGrid size={10} /> Take action →
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div className="flex gap-2 justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={11} className="text-brand-400" />
                </div>
                <div className="bg-surface-700/80 border border-surface-600 rounded-xl px-3 py-2">
                  <TypingDots />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input box */}
      <motion.div
        className="relative backdrop-blur-2xl bg-surface-800/80 rounded-2xl border border-surface-600/80 shadow-2xl"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Command palette */}
        <AnimatePresence>
          {showCommandPalette && (
            <motion.div
              ref={commandPaletteRef}
              className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-surface-800/95 rounded-xl z-50 shadow-xl border border-surface-500 overflow-hidden"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
            >
              {commandSuggestions.map((s, i) => (
                <motion.div
                  key={s.prefix}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 text-xs cursor-pointer transition-colors",
                    activeSuggestion === i ? "bg-brand-500/15 text-white" : "text-slate-400 hover:bg-surface-700"
                  )}
                  onClick={() => selectCommand(i)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span className={cn("w-5 h-5 flex items-center justify-center", activeSuggestion === i ? "text-brand-400" : "text-slate-500")}>
                    {s.icon}
                  </span>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-slate-600 ml-1">{s.prefix}</span>
                  <span className="ml-auto text-slate-500">{s.description}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask ZAP about your leads... (try /search plumbers Austin)"
            className="w-full px-2 py-1 resize-none bg-transparent border-none text-white/90 text-sm focus:outline-none placeholder:text-slate-600 min-h-[52px]"
            style={{ overflow: "hidden" }}
          />
        </div>

        <div className="px-3 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-command-button
              onClick={() => setShowCommandPalette((p) => !p)}
              className={cn(
                "p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors",
                showCommandPalette && "bg-surface-700 text-slate-300"
              )}
              title="Command palette"
            >
              <Command className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Clear
              </button>
            )}
            <motion.button
              type="button"
              onClick={handleSend}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={isTyping || !value.trim()}
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                value.trim() && !isTyping
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                  : "bg-surface-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {isTyping ? <LoaderIcon className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
              {isTyping ? "Thinking..." : "Ask ZAP"}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Quick action chips */}
      {messages.length === 0 && (
        <motion.div
          className="flex flex-wrap gap-1.5 justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {commandSuggestions.map((s, i) => (
            <button
              key={s.prefix}
              onClick={() => selectCommand(i)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800/50 hover:bg-surface-700/70 border border-surface-600/60 hover:border-brand-500/40 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-all"
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-brand-400 rounded-full"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
