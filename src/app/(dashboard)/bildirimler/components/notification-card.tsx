"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Check } from "lucide-react";
import { markAsRead } from "../actions";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";

type NotificationCardProps = {
  notifId: string;
  title: string;
  message: string | null;
  createdBy: string | null;
  createdAt: string;
  isRead: boolean;
  isAdmin: boolean;
  onDeleteClick: (notifId: string) => void;
};

export function NotificationCard({
  notifId,
  title,
  message,
  createdBy,
  createdAt,
  isRead,
  isAdmin,
  onDeleteClick,
}: NotificationCardProps) {
  async function handleClick() {
    if (isRead) return;
    const result = await markAsRead(notifId);
    if (!result.success) {
      toast.error(result.error);
    }
  }

  return (
    <Card
      className={`cursor-pointer border-l-4 transition-colors ${
        isRead
          ? "border-l-muted bg-card"
          : "border-l-vw-info bg-blue-50/50 dark:bg-blue-950/20"
      }`}
      onClick={handleClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        {/* Okunmadı göstergesi */}
        <div className="mt-1.5 flex-shrink-0">
          {!isRead ? (
            <div className="h-2.5 w-2.5 rounded-full bg-vw-info" />
          ) : (
            <Check className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* İçerik */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-sm leading-snug ${
                isRead ? "font-normal text-foreground" : "font-semibold text-foreground"
              }`}
            >
              {title}
            </h3>
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(createdAt)}
            </span>
          </div>

          {message && (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {message}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            {createdBy && (
              <span className="text-xs text-muted-foreground">
                {createdBy}
              </span>
            )}
            {!createdBy && <span />}

            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(notifId);
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Sil
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
