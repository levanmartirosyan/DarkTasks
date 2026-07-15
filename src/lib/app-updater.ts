import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";

export function isTauriRuntime() {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export async function checkForAppUpdate() {
  if (!isTauriRuntime()) return null;
  return check();
}

export async function downloadInstallAndRelaunch(
  update: Update,
  onProgress?: (progress: number) => void,
) {
  let downloaded = 0;
  let contentLength = 0;

  await invoke("stop_api_sidecar_for_update");

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      downloaded = 0;
      contentLength = event.data.contentLength ?? 0;
      onProgress?.(0);
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (contentLength > 0) onProgress?.(Math.round((downloaded / contentLength) * 100));
    }

    if (event.event === "Finished") {
      onProgress?.(100);
    }
  });

  await relaunch();
}
