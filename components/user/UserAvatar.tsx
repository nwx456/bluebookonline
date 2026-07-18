import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

export type UserAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function UserAvatar({
  displayName,
  avatarUrl,
  size = "sm",
  className,
}: UserAvatarProps) {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600",
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
