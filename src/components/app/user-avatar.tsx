import { cn } from "@/lib/utils";
import type { User } from "@/lib/app-data";

export function UserAvatar({ user, size = 28, ring = false, className }: { user: Pick<User, "initials" | "color" | "name">; size?: number; ring?: boolean; className?: string }) {
  return (
    <div
      title={user.name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-medium text-primary-foreground select-none",
        ring && "ring-2 ring-background",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${user.color}, color-mix(in oklab, ${user.color} 60%, oklch(0.5 0.15 275)))`,
      }}
    >
      {user.initials}
    </div>
  );
}

export function AvatarStack({ users, max = 4, size = 26 }: { users: User[]; max?: number; size?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <UserAvatar key={u.id} user={u} size={size} ring />
      ))}
      {extra > 0 && (
        <div
          className="grid place-items-center rounded-full border-2 border-background bg-surface-3 text-[10px] font-medium text-muted-foreground"
          style={{ width: size, height: size }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
