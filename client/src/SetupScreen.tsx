import React, { useState } from "react";
import type { Genre, StartStoryRequest } from "./types";
import { BookOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SetupScreenProps {
  onStart: (req: StartStoryRequest) => void;
  isLoading: boolean;
}

const GENRES: { id: Genre; label: string; emoji: string }[] = [
  { id: "Fantasy",  label: "Fantasy",  emoji: "🗡️" },
  { id: "Sci-Fi",   label: "Sci-Fi",   emoji: "🚀" },
  { id: "Mystery",  label: "Mystery",  emoji: "🔍" },
  { id: "Romance",  label: "Romance",  emoji: "💌" },
  { id: "Horror",   label: "Horror",   emoji: "👁️" },
  { id: "Comedy",   label: "Comedy",   emoji: "😂" },
];

const LENGTHS = [
  { value: 8, label: "Short Story", desc: "8 Scenes" },
  { value: 12, label: "Epic Tale", desc: "12 Scenes" },
] as const;

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, isLoading }) => {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<Genre>("Fantasy");
  const [totalScenes, setTotalScenes] = useState<8 | 12>(8);
  const [hook, setHook] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hook.trim()) return;
    onStart({
      title: title.trim(),
      genre,
      initial_hook: hook.trim(),
      total_scenes: totalScenes,
      temperature: 0.7,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans selection:bg-slate-200 selection:text-slate-900 relative">
      <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-xl w-full border border-slate-200 bg-white p-10 md:p-14 shadow-sm rounded-xl relative z-10"
      >
        <div className="mb-12 flex flex-col items-center justify-center text-center relative z-10">
          <div className="text-slate-800 mb-4">
            <BookOpen className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-serif font-semibold text-slate-900 mb-2">
            Story Weaver
          </h1>
          <p className="text-slate-500 text-sm font-medium tracking-wide">
            You write the first line. We'll write the rest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
               WHAT'S IT CALLED?
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors text-slate-900 placeholder:text-slate-400 font-serif text-lg shadow-sm"
              placeholder="Give it a name worth remembering"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              WHAT KIND OF STORY?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                    genre === g.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xl leading-none">{g.emoji}</span>
                  <span className={`font-mono text-[10px] font-bold tracking-widest uppercase ${
                    genre === g.id ? "text-white" : "text-slate-500"
                  }`}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Story Length
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {LENGTHS.map((len) => (
                 <button
                  type="button"
                  key={len.value}
                  onClick={() => setTotalScenes(len.value)}
                  className={`p-3 rounded-lg border text-center transition-all cursor-pointer font-serif ${
                    totalScenes === len.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                 >
                   <div className="font-semibold text-sm">{len.label}</div>
                   <div className={`font-mono text-[10px] mt-1 tracking-widest uppercase ${totalScenes === len.value ? "text-slate-300" : "text-slate-400"}`}>
                     {len.desc}
                   </div>
                 </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              WHERE DOES IT BEGIN?
            </label>
            <textarea
              required
              rows={4}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors resize-none text-slate-900 placeholder:text-slate-400 font-serif text-lg leading-relaxed shadow-sm"
              placeholder="Drop one sentence — a place, a moment, a feeling..."
              value={hook}
              onChange={(e) => setHook(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading || !title.trim() || !hook.trim()}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-sm uppercase tracking-widest rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm flex items-center justify-center font-mono"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-3" />
                  Synthesizing...
                </>
              ) : (
                <>Begin Writing</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
