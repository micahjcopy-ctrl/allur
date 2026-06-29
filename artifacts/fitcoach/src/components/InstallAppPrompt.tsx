import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, SquarePlus, MoreVertical, Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * One-time, dismissible prompt shown right after a user finishes onboarding,
 * nudging them to install ALLUR to their home screen. Platform-aware:
 * Android / desktop Chrome get a native "Install" button (when the browser has
 * fired `beforeinstallprompt`); iOS and other browsers get the Add-to-Home-Screen
 * steps. Anyone can skip with "Maybe later", and the full QR / instructions live
 * at /get. Never shown when already running installed (standalone).
 */
export default function InstallAppPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const { platform, installed, canInstall, promptInstall } = usePwaInstall();

  // Already installed (opened from the home screen) → nothing to prompt.
  if (installed) return null;

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") onClose();
  };

  const steps =
    platform === "ios"
      ? [
          { icon: Share, text: "Tap the Share button in Safari's toolbar." },
          { icon: SquarePlus, text: "Choose \u201CAdd to Home Screen,\u201D then tap Add." },
        ]
      : platform === "android"
        ? [
            { icon: MoreVertical, text: "Tap the \u22EE menu in Chrome (top-right)." },
            { icon: SquarePlus, text: "Choose \u201CInstall app\u201D or \u201CAdd to Home screen.\u201D" },
          ]
        : [
            { icon: Smartphone, text: "Open ALLUR on your phone (scan the QR on the next screen)." },
            { icon: SquarePlus, text: "Use your browser's Share menu \u2192 \u201CAdd to Home Screen.\u201D" },
          ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Add ALLUR to your phone</DialogTitle>
          <DialogDescription className="text-center">
            Install ALLUR to your home screen and it opens full-screen, one tap away — just like a
            native app. Your account, plan, and progress stay in sync.
          </DialogDescription>
        </DialogHeader>

        {canInstall ? (
          <Button onClick={handleInstall} className="w-full h-12 font-bold gap-2">
            <Download className="h-4 w-4" /> Install ALLUR
          </Button>
        ) : (
          <ol className="space-y-3 py-1">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{s.text}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => {
              onClose();
              setLocation("/get");
            }}
          >
            See full instructions
          </Button>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
