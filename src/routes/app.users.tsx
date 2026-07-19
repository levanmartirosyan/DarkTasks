import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react";
import { users, type User } from "@/lib/app-data";
import { DataRefreshButton } from "@/components/app/data-refresh-button";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users - DarkTasks" }] }),
});

function UsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "Admin" | "User">("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ user: User; x: number; y: number; placement: "top" | "bottom" } | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [version, setVersion] = useState(0);

  const filtered = users.filter(
    (user) =>
      (role === "all" || user.role === role) &&
      ((user.username || user.name).toLowerCase().includes(q.toLowerCase()) ||
        user.email.toLowerCase().includes(q.toLowerCase())),
  );

  async function deleteUser(user: User) {
    await api.deleteUser(user.id);
    const index = users.findIndex((item) => item.id === user.id);
    if (index >= 0) users.splice(index, 1);
    setMenu(null);
    setVersion((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage members and their access.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataRefreshButton onRefreshed={() => setVersion((value) => value + 1)} />
          <Button
            onClick={() => setCreating(true)}
            className="rounded-xl gradient-primary px-3.5 py-2 text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Invite user
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by name or email..."
            className="rounded-xl border-border bg-surface pl-9"
          />
        </div>
        <div className="flex gap-0.5 rounded-xl border border-border bg-surface p-0.5">
          {(["all", "Admin", "User"] as const).map((item) => (
            <Button
              key={item}
              variant="ghost"
              size="sm"
              onClick={() => setRole(item)}
              className={cn(
                "rounded-lg capitalize",
                role === item
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "all" ? "All roles" : `${item}s`}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setQ("");
            setRole("all");
          }}
          className="rounded-xl border-border bg-surface px-3 hover:bg-surface-2"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Member</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Last active</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2/60 transition"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{user.username || user.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                      user.role === "Admin"
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-3 text-muted-foreground",
                    )}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Active
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-xs text-muted-foreground"
                  title={user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : undefined}
                >
                  {user.lastActive}
                </td>
                <td className="px-4 py-3 text-right relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placement = window.innerHeight - rect.bottom < 110 ? "top" : "bottom";
                      setMenu((current) =>
                        current?.user.id === user.id
                          ? null
                          : {
                              user,
                              x: rect.right,
                              y: placement === "top" ? rect.top : rect.bottom,
                              placement,
                            },
                      );
                    }}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menu && (
        <UserMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditing(menu.user);
            setMenu(null);
          }}
          onDelete={() => {
            setDeleting(menu.user);
            setMenu(null);
          }}
        />
      )}

      {creating && (
        <UserModal
          title="Invite user"
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            users.push(created);
            setCreating(false);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {editing && (
        <UserModal
          title="Edit user"
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            const index = users.findIndex((item) => item.id === updated.id);
            if (index >= 0) users[index] = updated;
            setEditing(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {deleting && (
        <DeleteUserDialog
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteUser(deleting).then(() => setDeleting(null))}
        />
      )}
    </div>
  );
}

function UserMenu({
  menu,
  onClose,
  onEdit,
  onDelete,
}: {
  menu: { user: User; x: number; y: number; placement: "top" | "bottom" };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-elevated)] animate-scale-in"
        style={{
          left: Math.max(12, menu.x - 208),
          top: menu.placement === "bottom" ? menu.y + 6 : undefined,
          bottom: menu.placement === "top" ? window.innerHeight - menu.y + 6 : undefined,
        }}
      >
        <button
          onClick={onEdit}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
        >
          Edit user
        </button>
        <div className="border-t border-border">
          <button
            onClick={onDelete}
            className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition"
          >
            Delete user
          </button>
        </div>
      </div>
    </>
  );
}

function DeleteUserDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      await onConfirm();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete user.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-border bg-popover">
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This removes the member account from DarkTasks.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Delete {user.username || user.name}? This cannot be undone.
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={saving} onClick={() => void confirm()}>
            <Trash2 className="h-4 w-4" /> {saving ? "Deleting..." : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserModal({
  title,
  user,
  onClose,
  onSaved,
}: {
  title: string;
  user?: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const [username, setUsername] = useState(user?.username || user?.name || "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<"Admin" | "User">(user?.role ?? "User");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const saved = user
        ? ((await api.updateUser(user.id, { username, email, role })) as User)
        : ((await api.createUser({ username, email, role, password })) as User);
      onSaved(saved);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-border bg-popover">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {user ? "Update this member's profile and role." : "Create a member account in your workspace."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="DARKNESS"
            />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@company.com" />
          </Field>
          {!user && (
            <Field label="Temporary password">
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="DarkTasks123!"
              />
            </Field>
          )}
          <Field label="Role">
            <Select value={role} onValueChange={(value: "Admin" | "User") => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving..." : "Save user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
