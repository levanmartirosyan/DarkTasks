import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { bootstrapApiData } from "./lib/bootstrap-api-data";
import { getRouter } from "./router";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

function isTauriRuntime() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

if (isTauriRuntime() || import.meta.env.PROD) {
  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

function BootstrappedApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    bootstrapApiData()
      .catch((error) => console.error("Startup bootstrap failed.", error))
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="relative grid h-28 w-28 place-items-center">
          <div className="absolute inset-0 rounded-[2rem] bg-primary/20 blur-2xl animate-pulse" />
          <div className="absolute h-24 w-24 rounded-[1.75rem] border border-primary/30 animate-ping" />
          <img
            src="/darktasks-logo.png"
            alt="DarkTasks"
            className="relative h-20 w-20 rounded-2xl object-cover shadow-[var(--shadow-glow)] animate-pulse"
          />
        </div>
      </div>
    );
  }

  return <RouterProvider router={getRouter()} />;
}

createRoot(rootElement).render(
  <StrictMode>
    <BootstrappedApp />
  </StrictMode>,
);
