import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function WindowDragRegion({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isTauriRuntime());
  }, []);

  if (!visible) return null;

  return (
    <div
      data-tauri-drag-region
      className={cn("fixed left-0 right-0 top-0 z-40 h-9 cursor-default", className)}
    />
  );
}
