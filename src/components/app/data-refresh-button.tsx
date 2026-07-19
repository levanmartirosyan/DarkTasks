import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { bootstrapApiData } from "@/lib/bootstrap-api-data";
import { cn } from "@/lib/utils";

export function DataRefreshButton({
  onRefreshed,
  className,
  label = "Refresh",
}: {
  onRefreshed?: () => void;
  className?: string;
  label?: string;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    try {
      await bootstrapApiData();
      onRefreshed?.();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <button
      type="button"
      disabled={refreshing}
      onClick={() => void refresh()}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60",
        className,
      )}
      title="Refresh data from database"
    >
      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
      <span>{refreshing ? "Refreshing..." : label}</span>
    </button>
  );
}
