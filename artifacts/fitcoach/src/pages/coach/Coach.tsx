import React, { useState, useRef, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useFitCoach, composeGuideline, composeEquipment, composeDislikes, composePreferences, buildPhysiqueContext, physiqueLabel, type Workout } from "@/context/FitCoachContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast } from "@/lib/credits";
import { LockedFeature } from "@/components/subscription/LockedFeature";
import { Send, Cpu, Sparkles, CheckCircle2, Mic, Square, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";

interface CoachReply {
  reply: string;
  planUpdated: boolean;
  planSummary?: string | null;
  updatedPlan?: Workout[] | null;
}

interface CoachVoiceReply extends CoachReply {
  userTranscript: string;
  audio: string;
  audioFormat?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Coach() {
  const {
    chatMessages,
    addChatMessage,
    hasCredit,
    refreshCredits,
    isSubscribed,
    profile,
    goal,
    workoutPlan,
    setWorkoutPlan,
    physiqueAnalysis,
  } = useFitCoach();
  const { toast } = useToast();
  const recorder = useVoiceRecorder();
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isRecording = recorder.state === "recording";
  const busy = isTyping || voiceBusy;

  const prompts = [
    "I want to focus more on arms this week.",
    "My shoulder hurts during bench press.",
    "I only have 30 minutes today.",
    "I want to lose fat faster.",
    "How should I increase weight next week?",
  ];

  const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

  const contextPayload = () => ({
    goal,
    profile: {
      name: profile.name,
      experience: profile.experience,
      targetPhysique: physiqueLabel(profile.targetPhysique),
      activityLevel: profile.activityLevel,
      injuries: composeGuideline(profile.injuries, profile.injuryNotes),
      dietary: composeGuideline(profile.dietary, profile.dietaryNotes),
      equipment: composeEquipment(profile),
      dislikes: composeDislikes(profile),
      preferences: composePreferences(profile),
    },
    plan: workoutPlan,
    physique: buildPhysiqueContext(physiqueAnalysis),
  });

  // Apply the coach's reply: optional plan edit + toast, then the chat bubble.
  const applyCoachReply = (data: CoachReply) => {
    if (data.planUpdated && data.updatedPlan) {
      setWorkoutPlan(data.updatedPlan);
      toast({
        title: "Plan updated",
        description: data.planSummary ?? "Your training plan was adjusted.",
      });
    }
    addChatMessage({
      role: "assistant",
      content: data.reply,
      planSummary: data.planUpdated ? data.planSummary ?? "Plan updated" : undefined,
    });
  };

  const handleSubmit = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;

    if (!hasCredit("coaching")) {
      toast(outOfCreditsToast("coaching requests"));
      return;
    }

    setText("");
    addChatMessage({ role: "user", content: trimmed });

    // Build full history (prior turns + this new message) for the model.
    const history = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    setIsTyping(true);
    try {
      const res = await fetch(`${apiBase()}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: history, ...contextPayload() }),
      });

      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("coaching requests"));
        return;
      }
      if (!res.ok) throw new Error(`Coach request failed (${res.status})`);
      const data = (await res.json()) as CoachReply;
      applyCoachReply(data);
      refreshCredits();
    } catch (err) {
      addChatMessage({
        role: "assistant",
        content:
          "Sorry, I couldn't reach the coach just now. Please check your connection and try again.",
      });
      toast({
        variant: "destructive",
        title: "Coach unavailable",
        description: "Something went wrong reaching the AI coach.",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleMic = async () => {
    if (voiceBusy || isTyping) return;

    if (!isRecording) {
      try {
        await recorder.startRecording();
      } catch {
        toast({
          variant: "destructive",
          title: "Microphone blocked",
          description: "Allow microphone access to talk to your coach.",
        });
      }
      return;
    }

    // Stop recording and send the spoken turn through the same coach brain.
    const blob = await recorder.stopRecording();
    if (!blob.size) return;

    if (!hasCredit("coaching")) {
      toast(outOfCreditsToast("coaching requests"));
      return;
    }

    setVoiceBusy(true);
    setIsTyping(true);
    try {
      const audio = await blobToBase64(blob);
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${apiBase()}/api/coach/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audio,
          audioFormat: "webm",
          messages: history,
          ...contextPayload(),
        }),
      });

      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("coaching requests"));
        return;
      }
      if (!res.ok) throw new Error(`Coach voice request failed (${res.status})`);
      const data = (await res.json()) as CoachVoiceReply;

      addChatMessage({ role: "user", content: data.userTranscript });
      applyCoachReply(data);
      refreshCredits();

      if (data.audio) {
        audioRef.current?.pause();
        const player = new Audio(`data:audio/${data.audioFormat ?? "mp3"};base64,${data.audio}`);
        audioRef.current = player;
        player.play().catch(() => {});
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Coach unavailable",
        description: "Something went wrong with voice. Please try again.",
      });
    } finally {
      setVoiceBusy(false);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  if (!isSubscribed) {
    return (
      <MobileLayout>
        <LockedFeature
          title="AI Coach is locked"
          description="Your AI coach is part of ALLUR Base. Reactivate to chat by text or voice and get live plan changes."
        />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="flex flex-col h-full bg-background relative">
        <header className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" /> ALLUR Coach
            </h1>
            <p className="text-xs text-muted-foreground">Always active</p>
          </div>
          <img
            src={`${import.meta.env.BASE_URL}allur-logo.png`}
            alt="ALLUR"
            className="h-14 w-auto object-contain"
          />
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {/* Welcome Message */}
          <div className="flex flex-col gap-1 items-start max-w-[85%]">
            <div className="bg-secondary/50 rounded-2xl rounded-tl-sm p-4 text-sm border border-border/50 shadow-sm">
              <p>
                Hey {profile.name || "there"}! I'm your AI coach
                {goal ? ` for ${goal}` : ""}. Type or tap the mic to talk — ask me
                anything about your training, and if we agree on a change I'll update
                your plan automatically.
              </p>
            </div>
          </div>

          {chatMessages.map((msg) =>
            msg.role === "user" ? (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-end w-full"
              >
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-4 text-sm font-medium shadow-[0_4px_14px_rgba(0,0,0,0.35)] max-w-[85%]">
                  {msg.content}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-start w-full gap-1.5"
              >
                <div className="bg-secondary/50 rounded-2xl rounded-tl-sm p-4 text-sm border border-border/50 shadow-sm max-w-[85%] whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.planSummary && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Plan updated: {msg.planSummary}
                  </div>
                )}
              </motion.div>
            ),
          )}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 p-4 max-w-[85%] bg-secondary/50 rounded-2xl rounded-tl-sm border border-border/50 w-fit"
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
            </motion.div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-background">
          {isRecording && (
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-red-400">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Listening… tap the stop button when you're done.
            </div>
          )}

          {chatMessages.length === 0 && !isRecording && (
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 hide-scrollbar snap-x">
              {prompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setText(p)}
                  className="whitespace-nowrap shrink-0 snap-start bg-secondary hover:bg-secondary/80 text-xs px-4 py-2 rounded-full border border-border/50 flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-primary" /> {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-full p-1 pr-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={isRecording ? "Stop recording" : "Start voice message"}
              className={`rounded-full w-10 h-10 shrink-0 ${
                isRecording
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "text-muted-foreground hover:text-primary"
              }`}
              onClick={handleMic}
              disabled={voiceBusy || isTyping}
            >
              {voiceBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isRecording ? "Listening…" : "Ask anything..."}
              className="border-0 bg-transparent focus-visible:ring-0 px-2 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(text)}
              disabled={busy || isRecording}
            />
            <Button
              size="icon"
              className="rounded-full w-10 h-10 shrink-0 bg-primary text-black hover:bg-primary/90"
              onClick={() => handleSubmit(text)}
              disabled={!text.trim() || busy || isRecording}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
