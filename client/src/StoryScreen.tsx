import React, { useRef, useEffect, useState } from "react";
import type { StoryContext, StoryScene, ChoiceOption } from "./types";
import { Send, Loader2, Image as ImageIcon, Copy, ExternalLink, Settings2, Download, Undo2, BookOpen, Sparkles, GitFork } from "lucide-react";
import { generateVisualPrompt } from "./api";
import { motion, AnimatePresence } from "framer-motion";

interface StoryScreenProps {
  context: StoryContext;
  scenes: StoryScene[];
  pendingChoices: ChoiceOption[] | null;
  onContinue: (userText: string) => void;
  onGetChoices: () => void;
  onSelectChoice: (choiceTitle: string) => void;
  onUndo: () => void;
  onUpdateTemperature: (temp: number) => void;
  isLoading: boolean;
}

export const StoryScreen: React.FC<StoryScreenProps> = ({
  context,
  scenes,
  pendingChoices,
  onContinue,
  onGetChoices,
  onSelectChoice,
  onUndo,
  onUpdateTemperature,
  isLoading,
}) => {
  const [userText, setUserText] = useState("");
  const [visualPrompts, setVisualPrompts] = useState<Record<number, string>>({});
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<Record<number, boolean>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scenes, isLoading, pendingChoices]);

  const handleContinueAsText = () => {
    onContinue(userText);
    setUserText("");
  };

  const handleGeneratePrompt = async (sceneIdx: number, sceneText: string) => {
    if (visualPrompts[sceneIdx]) return;
    setIsGeneratingPrompt(prev => ({ ...prev, [sceneIdx]: true }));
    try {
      const res = await generateVisualPrompt({ scene_text: sceneText });
      setVisualPrompts(prev => ({ ...prev, [sceneIdx]: res.visual_prompt }));
    } catch (e: unknown) {
      console.error("Failed to generate visual prompt", e);
    } finally {
      setIsGeneratingPrompt(prev => ({ ...prev, [sceneIdx]: false }));
    }
  };

  const currentSceneIndex = scenes.length - 1;
  const isChapterComplete = context.current_scene >= context.total_scenes;

  const exportStory = () => {
    const lines = [
      `# ${context.title}`,
      `**Genre:** ${context.genre} | **Length:** ${context.total_scenes} scenes`,
      ...scenes.map((s, i) => [
        `## Scene ${i + 1} — ${s.scene_title}`,
        ...s.story_blocks.map(b =>
          b.type === "dialogue" ? `**${b.speaker}:** "${b.text}"` : b.text
        ),
      ].join("\n\n")),
    ].join("\n\n");
    const blob = new Blob([lines], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${context.title.replace(/\s+/g, "-").toLowerCase()}-export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans selection:bg-slate-200 selection:text-slate-900 overflow-hidden text-slate-800 relative">
      
      <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 pointer-events-none"></div>

      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200 text-slate-900 p-4 flex justify-between items-center z-10 sticky top-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-5 h-5 text-slate-600" />
          <h1 className="font-serif font-bold tracking-wide text-lg">
            {context.title}
          </h1>
        </div>
        <div className="font-mono text-xs text-slate-600 flex items-center space-x-4">
          <span className="hidden sm:inline bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-bold uppercase tracking-wide">
            Genre: {context.genre}
          </span>
          <span className="bg-slate-800 text-white px-3 py-1 rounded-full font-bold uppercase tracking-wide">
            Scene {context.current_scene} / {context.total_scenes}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:px-14 lg:py-12 scroll-smooth z-10 relative">
        <div className="max-w-3xl mx-auto space-y-12 pb-24">
          
          <AnimatePresence initial={false}>
            {scenes.map((scene, sceneIdx) => {
              const isLatest = sceneIdx === currentSceneIndex;
              const plainSceneText = scene.story_blocks.map((b) => b.text).join(" ");

              return (
                <motion.div 
                  key={`scene-${sceneIdx}`} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="space-y-6 pt-6 pl-0 sm:pl-12"
                >
                  
                  {sceneIdx > 0 && context.past_recaps[sceneIdx - 1] && (
                    <div className="bg-slate-50 border-l-4 border-slate-300 p-4 rounded-r-lg mb-8">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                        Previous Action
                      </span>
                      <p className="font-mono text-sm text-slate-600 italic leading-relaxed">
                        [ Continuing Narrative Flow ]
                      </p>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 p-6 md:p-8 rounded-r-xl shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-md mb-6 inline-block">
                      SCENE {String(sceneIdx + 1).padStart(2, '0')}: {scene.scene_title.toUpperCase()}
                    </span>
                    
                    {scene.hook && (
                      <p className="font-serif text-xl font-bold text-slate-900 leading-relaxed mb-6">
                        {scene.hook}
                      </p>
                    )}

                    <div className="space-y-6 text-slate-800 font-serif text-lg leading-loose">
                      {scene.story_blocks.map((block, blockIdx) => (
                        <div key={blockIdx}>
                          {block.type === "dialogue" ? (
                            <div className="my-6 bg-slate-50 border-l-2 border-slate-300 p-4 rounded-r-md">
                              <span className="font-mono text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                {block.speaker}:
                              </span>
                              <span className="italic text-slate-800">"{block.text}"</span>
                            </div>
                          ) : (
                            <p>{block.text}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                      <div className="flex flex-col space-y-4">
                        {!visualPrompts[sceneIdx] && !isGeneratingPrompt[sceneIdx] && (
                          <button 
                            onClick={() => handleGeneratePrompt(sceneIdx, plainSceneText)} 
                            className="self-start flex items-center space-x-2 text-xs font-mono font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest border border-slate-300 hover:border-slate-900 px-4 py-2 rounded-lg cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4"/> 
                            <span>Generate Image Reference</span>
                          </button>
                        )}
                        
                        {isGeneratingPrompt[sceneIdx] && (
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="self-start flex items-center space-x-2 text-xs font-mono font-bold text-slate-500 uppercase tracking-widest border border-slate-200 bg-slate-50 px-4 py-2 rounded-lg cursor-wait"
                          >
                            <Loader2 className="w-4 h-4 animate-spin"/> 
                            <span>Drafting Image Prompt...</span>
                          </motion.span>
                        )}

                        {visualPrompts[sceneIdx] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="bg-slate-50 rounded-lg p-5 border border-slate-200 relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-slate-400"></div>
                            <div className="flex items-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-3 pb-3 border-b border-slate-200">
                              <ImageIcon className="w-4 h-4 mr-2" />
                              <span>Visual Metadata Extracted</span>
                            </div>
                            <p className="font-mono text-sm leading-relaxed text-slate-700 italic mb-5 select-all font-medium">
                              "{visualPrompts[sceneIdx]}"
                            </p>
                            <div className="flex flex-wrap gap-3">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(visualPrompts[sceneIdx]);
                                  setCopiedIdx(sceneIdx);
                                  setTimeout(() => setCopiedIdx(null), 2000);
                                }}
                                className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-mono font-bold tracking-widest transition-colors cursor-pointer"
                              >
                                <Copy className="w-3 h-3 mr-2" />
                                {copiedIdx === sceneIdx ? "Copied!" : "Copy"}
                              </button>
                              <a 
                                href={`https://chatgpt.com/?q=${encodeURIComponent("Generate an image based on this highly detailed prompt:\n\n" + visualPrompts[sceneIdx])}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-md text-xs font-mono font-bold tracking-widest transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Render on DALL-E
                              </a>
                              <a 
                                href={`https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-md text-xs font-mono font-bold tracking-widest transition-colors cursor-pointer"
                                title="HuggingFace Spaces don't support auto-paste. Copy the prompt first!"
                              >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Render on FLUX
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isLatest && !isChapterComplete && !isLoading && pendingChoices && pendingChoices.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="pt-8"
                    >
                      <h4 className="font-mono text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center bg-slate-100 p-2 rounded-md">
                        <span className="bg-slate-400 w-2 h-2 rounded-full mr-3"></span>
                          What happens next?
                      </h4>
                      <div className="grid grid-cols-1 gap-3 pl-4">
                        {pendingChoices.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => onSelectChoice(opt.title)}
                            className="text-left w-full border border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50 rounded-xl p-5 transition-all duration-200 group flex items-start shadow-sm hover:shadow-md cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-slate-500 flex items-center justify-center mr-4 mt-0.5 shrink-0 transition-colors">
                              <div className="w-2 h-2 rounded-full bg-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <div>
                              <div className="font-serif font-bold text-lg text-slate-900 mb-1 group-hover:text-black transition-colors">
                                {opt.title}
                              </div>
                              <div className="text-sm font-serif text-slate-500">
                                {opt.teaser}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <AnimatePresence>
            {isChapterComplete && !isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 bg-white overflow-y-auto"
              >
                <div className="min-h-full py-16 md:py-24 px-6 md:px-12">
                  <div className="max-w-2xl mx-auto w-full">
                    
                    <div className="text-center mb-20">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-6" />
                      <h2 className="font-serif text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                        {context.title}
                      </h2>
                      <div className="flex items-center justify-center space-x-4 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>{context.genre}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>{context.total_scenes} Scenes</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>Simulation Complete</span>
                      </div>
                    </div>

                    <div className="font-serif text-lg text-slate-800 leading-loose space-y-8">
                      {scenes.map((s, idx) => (
                        <div key={idx} className="space-y-6">
                          {s.hook && (
                            <p className="font-bold text-slate-900 mb-6 first-letter:text-4xl first-letter:float-left first-letter:mr-3 first-letter:font-bold first-letter:text-slate-900">
                              {s.hook}
                            </p>
                          )}
                          {s.story_blocks.map((b, bIdx) => (
                            <div key={bIdx}>
                              {b.type === "dialogue" ? (
                                <p className="pl-6 md:pl-10 my-6 italic text-slate-700 border-l border-slate-200">
                                  "{b.text}"
                                </p>
                              ) : (
                                <p className="mb-6">{b.text}</p>
                              )}
                            </div>
                          ))}
                          {idx !== scenes.length - 1 && (
                            <div className="flex justify-center py-6">
                              <span className="w-1 h-1 bg-slate-200 rounded-full mx-1"></span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full mx-1"></span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full mx-1"></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-24 pt-12 border-t border-slate-100 flex flex-col md:flex-row items-center justify-center gap-4">
                      <button 
                        onClick={() => window.location.reload()}
                        className="w-full md:w-auto px-8 py-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-mono font-bold uppercase tracking-widest rounded-lg transition-colors shadow-sm cursor-pointer"
                      >
                        Start New Tale
                      </button>
                      <button 
                        className="w-full md:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center text-xs font-mono font-bold uppercase tracking-widest rounded-lg transition-colors shadow-lg cursor-pointer"
                        onClick={exportStory}
                      >
                        <Download className="w-4 h-4 mr-3" /> Export to Markdown
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center space-y-4 py-12 opacity-50 bg-white border border-slate-200 rounded-xl shadow-sm pl-0 sm:pl-12"
              >
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                <span className="font-mono text-sm font-bold uppercase tracking-widest text-slate-500">
                  Synthesizing Sequence...
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div ref={endOfMessagesRef} className="h-4" />
        </div>
      </div>

      {!isChapterComplete && (
        <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 md:p-6 shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] relative">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center">
            
            <div className="flex flex-1 w-full gap-3">
              {scenes.length > 1 && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={isLoading}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 rounded-lg px-4 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                  title="Undo last turn"
                >
                  <Undo2 className="w-5 h-5" />
                </button>
              )}
              <input
                type="text"
                placeholder="Write your own line..."
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading && userText.trim()) handleContinueAsText();
                }}
                disabled={isLoading}
                className="flex-1 bg-[#f8fafc] border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors font-serif text-lg placeholder:text-slate-400 placeholder:font-mono placeholder:text-[11px] placeholder:font-bold placeholder:uppercase placeholder:tracking-widest text-slate-900 shadow-inner"
              />
              <button
                onClick={handleContinueAsText}
                disabled={isLoading || !userText.trim()}
                className="bg-slate-900 text-white rounded-lg px-5 py-3 font-mono font-bold text-[11px] uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>

            <div className="flex w-full md:w-auto gap-2">
              <button
                onClick={() => onContinue("")}
                disabled={isLoading}
                className="flex-1 md:flex-none bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-4 py-3 font-mono font-bold text-[11px] uppercase tracking-widest disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Continue with AI
              </button>
              <button
                onClick={() => onGetChoices()}
                disabled={isLoading}
                className="flex-1 md:flex-none bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-4 py-3 font-mono font-bold text-[11px] uppercase tracking-widest disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm cursor-pointer whitespace-nowrap"
              >
                <GitFork className="w-4 h-4 mr-2" />
                Give Me Choices
              </button>
            </div>

            <div className="flex items-center space-x-4 md:border-l md:border-slate-200 md:pl-6 ml-2 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg border border-slate-200 md:border-none">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-slate-500 flex items-center">
                    <Settings2 className="w-3 h-3 mr-1" /> Chaos Engine (temperature)
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded ml-3">
                    {context.temperature.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Precise</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={context.temperature}
                    onChange={(e) => onUpdateTemperature(parseFloat(e.target.value))}
                    className="w-28 h-1.5 bg-slate-300 rounded-full appearance-none cursor-pointer accent-slate-900"
                  />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Chaotic</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
