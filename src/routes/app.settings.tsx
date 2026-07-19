import { createFileRoute } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { User, Bell, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/lib/app-data";
import { UserAvatar } from "@/components/app/user-avatar";
import { api } from "@/lib/api-client";
import { isTauriRuntime } from "@/lib/app-updater";

const settingsTabIds = ["general", "profile", "notifications"] as const;
type SettingsTab = (typeof settingsTabIds)[number];

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => ({
    tab: settingsTabIds.includes(search.tab as SettingsTab)
      ? (search.tab as SettingsTab)
      : undefined,
  }),
  head: () => ({ meta: [{ title: "Settings - DarkTasks" }] }),
});

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
] satisfies Array<{ id: SettingsTab; label: string; icon: typeof SettingsIcon }>;

function SettingsPage() {
  const { tab } = Route.useSearch();
  const [active, setActive] = useState<SettingsTab>(tab ?? "general");

  useEffect(() => {
    if (tab) setActive(tab);
  }, [tab]);

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
          {active === "profile" && <ProfileSection />}
          {active === "notifications" && <NotificationSection />}
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
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(__APP_VERSION__));
  }, []);

  return (
    <>
      <Card title="Application" description="Installed DarkTasks version.">
        <Row label="Version" hint="Use this when checking updates or reporting an issue.">
          <span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">
            {appVersion}
          </span>
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function saveProfile() {
    if (profileSaving) return;
    setProfileSaving(true);
    setProfileStatus("");

    try {
      const updated = (await api.updateProfile({ name, email })) as typeof currentUser;
      Object.assign(currentUser, updated);
      setProfileStatus("Profile saved.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword() {
    if (passwordSaving) return;
    setPasswordStatus("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus("Enter your current password and the new password twice.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password changed.");
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <Card title="Your profile" description="Manage your account details and password.">
      <div className="flex items-center gap-4 pb-5">
        <UserAvatar user={currentUser} size={64} />
        <div className="min-w-0">
          <div className="text-base font-semibold">{currentUser.name}</div>
          <div className="text-xs text-muted-foreground">{currentUser.email}</div>
        </div>
        <div className="ml-auto rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          Avatar locked
        </div>
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
      <Row label="Role" hint="Role is managed by the app owner.">
        <div className="flex justify-end">
          <span className="rounded-md gradient-primary px-2 py-1 text-xs font-medium text-primary-foreground">
            {currentUser.role}
          </span>
        </div>
      </Row>
      {profileStatus && <div className="pt-3 text-xs text-muted-foreground">{profileStatus}</div>}
      <div className="mt-5 flex justify-end border-t border-border/60 pt-4">
        <button
          disabled={profileSaving}
          onClick={() => void saveProfile()}
          className="rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          {profileSaving ? "Saving..." : "Save profile"}
        </button>
      </div>
      <div className="mt-6 border-t border-border/60 pt-5">
        <h4 className="text-sm font-semibold">Password</h4>
        <p className="mt-1 text-xs text-muted-foreground">Change the password for this account.</p>
      </div>
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
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            placeholder="Confirm new password"
            className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </Row>
      {passwordStatus && <div className="pt-3 text-xs text-muted-foreground">{passwordStatus}</div>}
      <div className="mt-5 flex justify-end gap-2 border-t border-border/60 pt-4">
        <button
          disabled={passwordSaving}
          onClick={() => void savePassword()}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:bg-surface-2 disabled:opacity-60"
        >
          {passwordSaving ? "Changing..." : "Change password"}
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
