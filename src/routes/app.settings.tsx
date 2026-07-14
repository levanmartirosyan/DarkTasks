import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  User,
  Palette,
  UsersIcon,
  GitBranch,
  FolderKanban,
  Bell,
  Settings as SettingsIcon,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/lib/app-data";
import { UserAvatar } from "@/components/app/user-avatar";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings - DarkTasks" }] }),
});

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "profile", label: "Profile", icon: User },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "repositories", label: "Repositories", icon: GitBranch },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function SettingsPage() {
  const [active, setActive] = useState("general");
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your workspace and preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition whitespace-nowrap",
                  active === s.id
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" /> {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          {active === "general" && <GeneralSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "profile" && <ProfileSection />}
          {active === "notifications" && <NotificationSection />}
          {active === "users" && (
            <PlaceholderSection
              title="Users"
              description="Manage team members from the Users page."
            />
          )}
          {active === "repositories" && (
            <PlaceholderSection
              title="Repositories"
              description="Manage repositories from within each project."
            />
          )}
          {active === "projects" && (
            <PlaceholderSection
              title="Projects"
              description="Create and manage projects from the Projects page."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 surface-card">
      <div className="mb-5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 py-4 last:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Switch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        on ? "gradient-primary shadow-[0_0_0_1px_var(--color-primary)]" : "bg-surface-3",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function GeneralSection() {
  return (
    <>
      <Card title="Workspace" description="How your workspace shows up across the app.">
        <div className="space-y-0">
          <div className="grid grid-cols-[100px_1fr] items-center gap-4 pb-4">
            <div className="text-sm font-medium">Icon</div>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-2xl">
                D
              </div>
              <button className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 transition">
                Change
              </button>
            </div>
          </div>
          <Row label="Workspace name">
            <input
              defaultValue="Nyctoswear"
              className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40 transition"
            />
          </Row>
          <Row label="URL slug" hint="darktasks.app/nyctoswear">
            <input
              defaultValue="nyctoswear"
              className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40 transition"
            />
          </Row>
          <Row label="Timezone">
            <select className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none">
              <option>Europe / Amsterdam</option>
              <option>America / New York</option>
            </select>
          </Row>
        </div>
      </Card>
    </>
  );
}

function AppearanceSection() {
  const accents = [
    { name: "Violet", val: "oklch(0.66 0.19 275)" },
    { name: "Blue", val: "oklch(0.66 0.18 235)" },
    { name: "Emerald", val: "oklch(0.7 0.15 165)" },
    { name: "Rose", val: "oklch(0.7 0.18 340)" },
    { name: "Amber", val: "oklch(0.78 0.14 75)" },
  ];
  return (
    <>
      <Card title="Theme" description="This workspace uses a comfortable dark theme.">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-primary/60 bg-background p-3 shadow-[var(--shadow-glow)]">
            <div className="mb-3 h-16 rounded-lg aurora-bg" />
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" /> Dark (default)
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 opacity-60">
            <div className="mb-3 h-16 rounded-lg bg-gradient-to-br from-white to-slate-200" />
            <div className="text-sm text-muted-foreground">Light (coming soon)</div>
          </div>
        </div>
      </Card>
      <Card title="Accent color" description="Pick your workspace accent.">
        <div className="flex flex-wrap gap-3">
          {accents.map((a, i) => (
            <button
              key={a.name}
              className={cn("group flex flex-col items-center gap-1.5", i === 0 && "")}
            >
              <span
                className={cn(
                  "h-11 w-11 rounded-2xl transition",
                  i === 0 && "ring-2 ring-offset-2 ring-offset-background ring-primary",
                )}
                style={{
                  background: `linear-gradient(135deg, ${a.val}, color-mix(in oklab, ${a.val} 60%, oklch(0.5 0.15 275)))`,
                }}
              />
              <span className="text-[11px] text-muted-foreground">{a.name}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Motion">
        <Row label="Reduce motion" hint="Minimize animations across the app.">
          <Switch />
        </Row>
        <Row label="Smooth transitions" hint="Elegant transitions between views.">
          <Switch defaultOn />
        </Row>
      </Card>
    </>
  );
}

function ProfileSection() {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    setStatus("");

    try {
      const updated = (await api.updateProfile({ name, email })) as typeof currentUser;
      Object.assign(currentUser, updated);
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (saving) return;
    setSaving(true);
    setStatus("");

    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setStatus("Password changed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Your profile">
      <div className="flex items-center gap-4 pb-5">
        <UserAvatar user={currentUser} size={64} />
        <div className="min-w-0">
          <div className="text-base font-semibold">{currentUser.name}</div>
          <div className="text-xs text-muted-foreground">{currentUser.email}</div>
        </div>
        <button className="ml-auto rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 transition">
          Change avatar
        </button>
      </div>
      <Row label="Full name">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
        />
      </Row>
      <Row label="Email">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
        />
      </Row>
      <Row label="Role" hint="Contact an admin to change.">
        <span className="rounded-md gradient-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          {currentUser.role}
        </span>
      </Row>
      <Row label="Password" hint="Change the password for this account.">
        <div className="grid gap-2">
          <input
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            type="password"
            placeholder="Current password"
            className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
          />
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            placeholder="New password"
            className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </Row>
      {status && <div className="pt-3 text-xs text-muted-foreground">{status}</div>}
      <div className="mt-5 flex justify-end gap-2 border-t border-border/60 pt-4">
        <button
          disabled={saving}
          onClick={() => void savePassword()}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:bg-surface-2 disabled:opacity-60"
        >
          Change password
        </button>
        <button
          disabled={saving}
          onClick={() => void saveProfile()}
          className="rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          Save profile
        </button>
      </div>
    </Card>
  );
}

function NotificationSection() {
  return (
    <Card title="Notifications">
      <Row label="Task assigned" hint="When a task is assigned to you.">
        <Switch defaultOn />
      </Row>
      <Row label="Comments & mentions" hint="Someone comments on your task or @mentions you.">
        <Switch defaultOn />
      </Row>
      <Row label="Deadline reminders" hint="Get notified 24h before a deadline.">
        <Switch defaultOn />
      </Row>
      <Row label="Weekly digest" hint="A summary every Monday morning.">
        <Switch />
      </Row>
      <Row label="Email notifications" hint="Send to alex@darktasks.local.">
        <Switch defaultOn />
      </Row>
    </Card>
  );
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <Card title={title} description={description}>
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center">
        <Sparkles className="h-6 w-6 text-muted-foreground" />
        <div className="mt-2 text-sm text-muted-foreground">Managed elsewhere in the app.</div>
      </div>
    </Card>
  );
}
