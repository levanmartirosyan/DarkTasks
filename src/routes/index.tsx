import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/app/brand-logo";
import { WindowDragRegion } from "@/components/app/window-drag-region";
import { WindowControls } from "@/components/app/window-controls";
import { API_BASE_URL, API_TIMEOUT_MS, api } from "@/lib/api-client";
import { hasSessionToken, saveSessionToken } from "@/lib/auth-session";
import { bootstrapApiData } from "@/lib/bootstrap-api-data";

const LINKEDIN_URL = "https://www.linkedin.com/in/levan-martirosyan/";

function isTauriRuntime() {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in - DarkTasks" },
      { name: "description", content: "Sign in to your DarkTasks workspace." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (hasSessionToken()) {
      void navigate({ to: "/app/dashboard", replace: true });
    }
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      if (API_BASE_URL) {
        const result = (await api.login({ username, password })) as { token: string };
        saveSessionToken(result.token);
        await bootstrapApiData({ timeoutMs: API_TIMEOUT_MS });
      }

      navigate({ to: "/app/dashboard" });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  async function openLinkedIn(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!isTauriRuntime()) return;

    event.preventDefault();

    try {
      await invoke("open_external_url", { url: LINKEDIN_URL });
    } catch {
      window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="aurora-bg relative min-h-screen overflow-hidden" data-tauri-drag-region>
      <WindowDragRegion />
      <WindowControls className="fixed right-4 top-4 z-50 border-l-0 rounded-xl border border-border bg-surface/60 px-1.5 py-1 pl-1.5 backdrop-blur" />

      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-40 blur-3xl gradient-primary animate-float" />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-25 blur-3xl bg-[oklch(0.7_0.17_220)] animate-float"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-9 shadow-[var(--shadow-glow)]" />
            <span className="text-lg font-semibold tracking-tight">DarkTasks</span>
          </div>
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> v2.4 - Boards & repositories
            </div>
            <h1 className="text-4xl font-semibold tracking-tight leading-[1.1]">
              A calm, focused workspace for teams that ship.
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Plan projects, organize by repository, and glide through your day with boards,
              calendars, and activity that feel effortless.
            </p>
            <div className="flex gap-3 pt-2">
              {["Boards", "Repositories", "Calendar", "Activity"].map((f) => (
                <div
                  key={f}
                  className="rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026{" "}
            <a
              href={LINKEDIN_URL}
              onClick={(event) => void openLinkedIn(event)}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-primary-glow transition"
            >
              Levan Martirosyan
            </a>
          </p>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm animate-fade-in">
            <div className="lg:hidden mb-8 flex items-center gap-2.5">
              <BrandLogo className="h-9 w-9" />
              <span className="text-lg font-semibold">DarkTasks</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Email or username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:bg-surface-2 focus:ring-2 focus:ring-ring/40"
                  placeholder="example@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  {/* <button
                    type="button"
                    className="text-xs text-primary hover:text-primary-glow transition"
                  >
                    Forgot password?
                  </button> */}
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-11 text-sm outline-none transition focus:border-primary/60 focus:bg-surface-2 focus:ring-2 focus:ring-ring/40"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* <label className="flex items-center gap-2 select-none cursor-pointer">
                <input type="checkbox" defaultChecked className="peer sr-only" />
                <span className="grid h-4 w-4 place-items-center rounded border border-border-strong bg-surface transition peer-checked:border-primary peer-checked:gradient-primary">
                  <svg
                    viewBox="0 0 12 12"
                    className="h-3 w-3 stroke-primary-foreground opacity-0 peer-checked:opacity-100 [.peer:checked~&]:opacity-100"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2.5 6.5 5 9 9.5 3.5" />
                  </svg>
                </span>
                <span className="text-xs text-muted-foreground">Remember me for 30 days</span>
              </label> */}

              {error && <div className="text-xs text-destructive">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Need access?{" "}
              <a
                href={LINKEDIN_URL}
                onClick={(event) => void openLinkedIn(event)}
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:text-primary transition"
              >
                Contact your admin
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
