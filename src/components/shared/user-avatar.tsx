"use client";

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarSize = "sm" | "default" | "lg" | "xl";

interface UserAvatarProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  size?: UserAvatarSize;
  className?: string;
}

const sizeClasses: Record<UserAvatarSize, string> = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
  xl: "size-20",
};

const textClasses: Record<UserAvatarSize, string> = {
  sm: "text-[10px]",
  default: "text-xs",
  lg: "text-sm",
  xl: "text-2xl",
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({
  avatarUrl,
  fullName,
  size = "default",
  className,
}: UserAvatarProps) {
  return (
    <Avatar
      className={cn(sizeClasses[size], className)}
    >
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={fullName || "Avatar"}
          className="object-cover"
        />
      )}
      <AvatarFallback
        className={cn(
          "bg-vw-side/20 text-vw-deep font-semibold",
          textClasses[size]
        )}
      >
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
