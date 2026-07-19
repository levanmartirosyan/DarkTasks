import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";
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

  const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      onPointerDown={stopDrag}
      className={cn(
        "relative z-50 hidden items-center gap-1 border-l border-border pl-2 lg:flex",
        className,
      )}
      style={noDragStyle}
    >
      <button
        type="button"
        aria-label="Minimize window"
        onClick={() => void appWindow.minimize()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-75 hover:bg-surface-2 hover:text-foreground"
        style={noDragStyle}
      >
        <Minus className="pointer-events-none h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Maximize window"
        onClick={() => void appWindow.toggleMaximize()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-75 hover:bg-surface-2 hover:text-foreground"
        style={noDragStyle}
      >
        <Square className="pointer-events-none h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Close window"
        onClick={() => void appWindow.close()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-75 hover:bg-destructive hover:text-destructive-foreground"
        style={noDragStyle}
      >
        <X className="pointer-events-none h-4 w-4" />
      </button>
    </div>
  );
}
