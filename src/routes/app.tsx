import { Link, Outlet, createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Activity,
  Calendar,
  Settings,
  Search,
  Bell,
  Plus,
  LogOut,
  ChevronsLeft,
  Command,
  Menu,
  X,
  Users as UsersIcon,
} from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import {
  currentUser,
  notifications,
  projects,
  users,
  tasks,
  priorityMeta,
  userById,
  projectById,
} from "@/lib/app-data";
import { BrandLogo } from "@/components/app/brand-logo";
import { UserAvatar } from "@/components/app/user-avatar";
import { WindowDragRegion } from "@/components/app/window-drag-region";
import { WindowControls } from "@/components/app/window-controls";
import { cn } from "@/lib/utils";
import { clearSessionToken, hasSessionToken } from "@/lib/auth-session";
import { api } from "@/lib/api-client";

import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  beforeLoad: ({ location }) => {
    if (!hasSessionToken()) {
      throw redirect({ to: "/" });
    }

    if (location.pathname === "/app" || location.pathname === "/app/") {
      throw redirect({ to: "/app/dashboard" });
    }
  },
});

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/my-tasks", label: "My Tasks", icon: CheckSquare },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/users", label: "Users", icon: UsersIcon },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WindowDragRegion />
      {/* Sidebar - desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out",
          collapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        <SidebarInner collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar lg:hidden animate-fade-in">
            <SidebarInner collapsed={false} onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main */}
      <div
        className={cn(
          "transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]",
        )}
      >
        <TopBar
          onMenu={() => setMobileOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onNotif={() => setNotifOpen((v) => !v)}
          notifOpen={notifOpen}
        />
        <main className="pb-24 lg:pb-8">
          <Outlet />
        </main>
        {/* Mobile bottom nav */}
        <MobileTabBar />
      </div>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function SidebarInner({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}) {
  const navigate = useNavigate();

  function signOut() {
    clearSessionToken();
    void navigate({ to: "/", replace: true });
  }

  return (
    <>
      <div
        className={cn("flex items-center gap-2.5 px-4 py-5", collapsed && "justify-center px-2")}
      >
        <BrandLogo className="h-9 w-9 shadow-[var(--shadow-glow)]" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-tight">DarkTasks</div>
            <div className="text-[11px] text-muted-foreground">Workspace</div>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {onToggle && !onClose && (
          <button
            onClick={onToggle}
            className={cn(
              "rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition",
              collapsed && "absolute right-2 top-6",
            )}
          >
            <ChevronsLeft
              className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
            />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            Icon={item.icon}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom: user */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "group flex items-center gap-2.5 rounded-xl p-2 hover:bg-sidebar-accent transition",
            collapsed && "justify-center",
          )}
        >
          <UserAvatar user={currentUser} size={32} />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{currentUser.name}</div>
                <div className="text-[11px] text-muted-foreground">{currentUser.role}</div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function NavLink({
  to,
  label,
  Icon,
  collapsed,
}: {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground transition"
      activeProps={{
        className:
          "!bg-sidebar-accent !text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]",
      }}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      <span className="pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary opacity-0 transition group-[.active]:opacity-100" />
    </Link>
  );
}

function TopBar({
  onMenu,
  onSearch,
  onNotif,
  notifOpen,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onNotif: () => void;
  notifOpen: boolean;
}) {
  const workspace = projects[0];
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <header className="sticky top-0 z-20 glass" data-tauri-drag-region>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6" data-tauri-drag-region>
        <button
          onClick={onMenu}
          className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden md:flex items-center gap-2 text-sm" data-tauri-drag-region>
          <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-xs">
            {workspace?.icon ?? "D"}
          </div>
          <span className="font-medium">{workspace?.name ?? "DarkTasks"}</span>
          <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Workspace
          </span>
        </div>

        <button
          onClick={onSearch}
          className="ml-auto flex min-w-0 flex-1 max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition hover:border-border-strong hover:bg-surface-2"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search projects, tasks, people</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <Link
          to={workspace ? "/app/projects/$slug" : "/app/projects"}
          params={workspace ? { slug: workspace.slug } : undefined}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl gradient-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition hover:opacity-95 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">{workspace ? "New task" : "New project"}</span>
        </Link>

        <div className="relative">
          <button
            onClick={onNotif}
            className="relative rounded-xl border border-border bg-surface p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </button>
          {notifOpen && <NotifDropdown onClose={onNotif} />}
        </div>

        <UserAvatar user={currentUser} size={34} />
        <WindowControls />
      </div>
    </header>
  );
}

function NotifDropdown({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState(0);

  async function markAllRead() {
    notifications.forEach((notification) => {
      notification.read = true;
    });
    setVersion((value) => value + 1);

    try {
      await api.markNotificationsRead();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full z-40 mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)] animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          <button
            onClick={() => void markAllRead()}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "group flex gap-3 border-b border-border/60 px-4 py-3 hover:bg-surface-2 transition cursor-pointer",
                !n.read && "bg-primary/[0.03]",
              )}
            >
              <div
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: !n.read ? "var(--color-primary)" : "transparent" }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{n.title}</div>
                <div className="text-xs text-muted-foreground truncate">{n.detail}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/app/activity"
            className="block rounded-lg p-2 text-center text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
          >
            View all activity
          </Link>
        </div>
      </div>
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const query = q.toLowerCase();
  const matchTasks = tasks
    .filter(
      (t) =>
        !query || t.title.toLowerCase().includes(query) || t.code.toLowerCase().includes(query),
    )
    .slice(0, 5);
  const matchProjects = projects
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .slice(0, 3);
  const matchUsers = users
    .filter((u) => !query || u.name.toLowerCase().includes(query))
    .slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 backdrop-blur-md p-4 pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, projects, people…"
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {matchTasks.length > 0 && (
            <Section title="Tasks">
              {matchTasks.map((t) => {
                const p = priorityMeta[t.priority];
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      const project = projectById(t.projectId);
                      if (project) {
                        navigate({ to: "/app/projects/$slug", params: { slug: project.slug } });
                      }
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
                  >
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {t.code}
                    </span>
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-xs" style={{ color: p.color }}>
                      {p.icon} {p.label}
                    </span>
                  </button>
                );
              })}
            </Section>
          )}
          {matchProjects.length > 0 && (
            <Section title="Projects">
              {matchProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    navigate({ to: "/app/projects/$slug", params: { slug: p.slug } });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-xs">
                    {p.icon}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.taskCount} tasks</span>
                </button>
              ))}
            </Section>
          )}
          {matchUsers.length > 0 && (
            <Section title="People">
              {matchUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    navigate({ to: "/app/users" });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
                >
                  <UserAvatar user={u} size={22} />
                  <span className="flex-1 truncate">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.role}</span>
                </button>
              ))}
            </Section>
          )}
          {matchTasks.length + matchProjects.length + matchUsers.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No results for "{q}"
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex gap-3">
            <span>
              <kbd className="rounded bg-surface-2 px-1 py-0.5">Up</kbd>{" "}
              <kbd className="rounded bg-surface-2 px-1 py-0.5">Down</kbd> navigate
            </span>
            <span>
              <kbd className="rounded bg-surface-2 px-1 py-0.5">Enter</kbd> open
            </span>
          </div>
          <span>Powered by DarkTasks</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MobileTabBar() {
  const items = navItems.slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border glass lg:hidden">
      <div className="flex items-stretch justify-around px-2 py-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition"
            activeProps={{ className: "!text-primary" }}
          >
            <item.icon className="h-[18px] w-[18px]" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

// re-export helper for children
export { userById };
