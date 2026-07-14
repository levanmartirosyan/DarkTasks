import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/darktasks-logo.png"
      alt="DarkTasks"
      className={cn("shrink-0 rounded-xl object-cover", className)}
      draggable={false}
    />
  );
}
