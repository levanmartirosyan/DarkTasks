import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function WindowControls({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isTauriRuntime());
  }, []);

  if (!visible) return null;

  const appWindow = getCurrentWindow();

  return (
    <div className={cn("hidden items-center gap-1 border-l border-border pl-2 lg:flex", className)}>
      <button
        type="button"
        aria-label="Minimize window"
        onClick={() => void appWindow.minimize()}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Maximize window"
        onClick={() => void appWindow.toggleMaximize()}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Close window"
        onClick={() => void appWindow.close()}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
