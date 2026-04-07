import { useState, useCallback, useRef, useEffect } from "react";
import { SetupScreen } from "./SetupScreen";
import { StoryScreen } from "./StoryScreen";
import type { StoryContext, StartStoryRequest, StoryScene, ChoiceOption } from "./types";
import { startStory, continueStory, getChoices, ApiError } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, Key, ServerCrash, WifiOff } from "lucide-react";

// ── Error Toast Types ─────────────────────────────────────────────────────────
interface AppError {
  statusCode: number;
  message: string;
}

function getErrorConfig(err: AppError): {
  icon: React.ReactNode;
  label: string;
  bg: string;
  retrying: boolean;
} {
  switch (err.statusCode) {
    case 429:
      return {
        icon: <Clock className="w-4 h-4 shrink-0" />,
        label: "Rate Limited",
        bg: "bg-amber-500",
        retrying: true,
      };
    case 401:
      return {
        icon: <Key className="w-4 h-4 shrink-0" />,
        label: "Auth Error",
        bg: "bg-red-600",
        retrying: false,
      };
    case 413:
      return {
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        label: "Context Too Long",
        bg: "bg-orange-500",
        retrying: false,
      };
    case 422:
      return {
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        label: "Parse Error",
        bg: "bg-orange-500",
        retrying: false,
      };
    case 503:
    case 500:
      return {
        icon: <ServerCrash className="w-4 h-4 shrink-0" />,
        label: "Server Error",
        bg: "bg-red-500",
        retrying: true,
      };
    default:
      return {
        icon: <WifiOff className="w-4 h-4 shrink-0" />,
        label: "Connection Error",
        bg: "bg-slate-700",
        retrying: false,
      };
  }
}

function App() {
  const [context, setContext] = useState<StoryContext | null>(null);
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const pendingRetryRef = useRef<(() => Promise<void>) | null>(null);

  // Choices fetched via "Give Me Choices" — separate from scene data
  const [pendingChoices, setPendingChoices] = useState<ChoiceOption[] | null>(null);

  // ── Countdown tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return;
    const timer = setTimeout(() => {
      setRetryCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  // ── Fire retry when countdown reaches 0 ─────────────────────────────────────
  useEffect(() => {
    if (retryCountdown === 0 && pendingRetryRef.current) {
      const action = pendingRetryRef.current;
      pendingRetryRef.current = null;
      setRetryCountdown(null);
      setAppError(null);
      action();
    }
  }, [retryCountdown]);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      setAppError({ statusCode: e.statusCode, message: e.detail });
    } else if (e instanceof Error) {
      setAppError({ statusCode: 0, message: e.message });
    } else {
      setAppError({ statusCode: 0, message: "An unexpected error occurred." });
    }
    setTimeout(() => setAppError(null), 7000);
  }, []);

  const scheduleRetry = useCallback((action: () => Promise<void>) => {
    pendingRetryRef.current = action;
    setRetryCountdown(10);
    setAppError({ statusCode: 429, message: "Rate limited — auto-retrying..." });
  }, []);

  // ── Helper: extract plain text from a scene ─────────────────────────────────
  const getSceneText = (scene: StoryScene): string =>
    scene.story_blocks.map((b) => b.text).join(" ");

  // ── Start Story ─────────────────────────────────────────────────────────────
  const handleStart = async (req: StartStoryRequest) => {
    setIsLoading(true);
    setAppError(null);
    try {
      const res = await startStory(req);
      const scene = res.scene;

      setScenes([scene]);
      setContext({
        title: req.title,
        genre: req.genre,
        initial_hook: req.initial_hook,
        total_scenes: req.total_scenes,
        current_scene: 1,
        temperature: req.temperature,
        past_recaps: [scene.one_line_recap],
        past_scene_texts: [getSceneText(scene)],
        memory_state: {
          characters: scene.continuity_updates.characters || [],
          new_facts: scene.continuity_updates.new_facts || [],
          open_threads: scene.continuity_updates.open_threads || [],
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 429) {
        setIsLoading(false);
        scheduleRetry(() => handleStart(req));
        return;
      }
      handleError(e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Continue Story (generates a new scene) ──────────────────────────────────
  const handleContinue = async (userAddition: string) => {
    if (!context) return;
    setIsLoading(true);
    setAppError(null);
    setPendingChoices(null); // clear any showing choices

    const nextSceneIndex = context.current_scene + 1;

    try {
      const res = await continueStory({
        ...context,
        user_addition: userAddition,
        include_choices: false, // scenes never include choices — use "Give Me Choices" button
      });

      const scene = res.scene;
      setScenes((prev) => [...prev, scene]);

      setContext((prevContext) => {
        if (!prevContext) return prevContext;
        return {
          ...prevContext,
          current_scene: nextSceneIndex,
          past_recaps: [...prevContext.past_recaps, scene.one_line_recap],
          past_scene_texts: [...prevContext.past_scene_texts, getSceneText(scene)],
          memory_state: {
            characters: scene.continuity_updates.characters || [],
            new_facts: scene.continuity_updates.new_facts || [],
            open_threads: scene.continuity_updates.open_threads || [],
          },
        };
      });
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 429) {
        setIsLoading(false);
        scheduleRetry(() => handleContinue(userAddition));
        return;
      }
      handleError(e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Get Choices (fetches 3 options without advancing the scene) ─────────────
  const handleGetChoices = async () => {
    if (!context) return;
    setIsLoading(true);
    setAppError(null);
    try {
      const res = await getChoices(context);
      setPendingChoices(res.choices);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 429) {
        setIsLoading(false);
        scheduleRetry(() => handleGetChoices());
        return;
      }
      handleError(e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Select a Choice (continues story with that choice) ──────────────────────
  const handleSelectChoice = (choiceTitle: string) => {
    setPendingChoices(null);
    handleContinue(`I choose to: ${choiceTitle}`);
  };

  const handleUndo = () => {
    if (!context || scenes.length <= 1) return;
    setPendingChoices(null);
    setScenes((prev) => prev.slice(0, -1));
    setContext((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        current_scene: prev.current_scene - 1,
        past_recaps: prev.past_recaps.slice(0, -1),
        past_scene_texts: prev.past_scene_texts.slice(0, -1),
      };
    });
  };

  const handleUpdateTemperature = (temperature: number) => {
    if (context) {
      setContext({ ...context, temperature });
    }
  };

  return (
    <>
      {/* ── Smart Error Toast ──────────────────────────────────────── */}
      <AnimatePresence>
        {appError && (() => {
          const cfg = getErrorConfig(appError);
          return (
            <motion.div
              key="error-toast"
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className={`fixed top-5 left-1/2 -translate-x-1/2 z-100 ${cfg.bg} text-white px-5 py-3 rounded-xl shadow-2xl font-mono text-sm flex items-center gap-3 max-w-md`}
            >
              {cfg.icon}
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold uppercase tracking-widest text-[10px] opacity-80">
                  {cfg.label}
                  {retryCountdown !== null
                    ? ` — retrying in ${retryCountdown}s`
                    : cfg.retrying ? " — retrying…" : ""}
                </span>
                <span className="text-white/90 text-xs mt-0.5 truncate">{appError.message}</span>
              </div>
              <button
                onClick={() => {
                  setAppError(null);
                  setRetryCountdown(null);
                  pendingRetryRef.current = null;
                }}
                className="ml-2 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none cursor-pointer shrink-0"
              >
                ×
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── App Screens ─────────────────────────────────────────────── */}
      {!context ? (
        <SetupScreen onStart={handleStart} isLoading={isLoading} />
      ) : (
        <StoryScreen
          context={context}
          scenes={scenes}
          pendingChoices={pendingChoices}
          onContinue={handleContinue}
          onGetChoices={handleGetChoices}
          onSelectChoice={handleSelectChoice}
          onUndo={handleUndo}
          onUpdateTemperature={handleUpdateTemperature}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

export default App;
