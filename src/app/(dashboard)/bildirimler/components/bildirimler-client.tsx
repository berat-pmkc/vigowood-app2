"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, CheckCheck } from "lucide-react";
import { NotificationCard } from "./notification-card";
import { CreateNotificationDialog } from "./create-notification-dialog";
import { DeleteNotificationDialog } from "./delete-notification-dialog";
import { useNotificationRealtime } from "@/hooks/use-notification-realtime";
import { markAllAsRead } from "../actions";
import { toast } from "sonner";

type Notification = {
  notif_id: string;
  title: string;
  message: string | null;
  target_user: string | null;
  created_by: string | null;
  created_at: string;
};

type BildirimlerClientProps = {
  notifications: Notification[];
  readNotifIds: string[];
  isAdmin: boolean;
  userId: string;
};

type FilterType = "all" | "unread" | "read";

export function BildirimlerClient({
  notifications,
  readNotifIds,
  isAdmin,
  userId,
}: BildirimlerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFilter = (searchParams.get("filter") as FilterType) || "all";
  const currentSearch = searchParams.get("search") || "";

  const [search, setSearch] = useState(currentSearch);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useNotificationRealtime();

  const readSet = new Set(readNotifIds);

  // Kullanıcıya görünen bildirimler
  const visible = notifications.filter((n) => {
    if (!n.target_user) return true;
    return n.target_user.split(",").includes(userId);
  });

  // Filtre
  const filtered = visible.filter((n) => {
    const isRead = readSet.has(n.notif_id);
    if (currentFilter === "unread" && isRead) return false;
    if (currentFilter === "read" && !isRead) return false;
    return true;
  });

  // Arama
  const searched = filtered.filter((n) => {
    if (!currentSearch) return true;
    const q = currentSearch.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.message && n.message.toLowerCase().includes(q))
    );
  });

  const unreadCount = visible.filter((n) => !readSet.has(n.notif_id)).length;

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/bildirimler?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams("search", search.trim());
  }

  async function handleMarkAllAsRead() {
    setMarkingAll(true);
    const result = await markAllAsRead();
    setMarkingAll(false);
    if (result.success) {
      toast.success("Tüm bildirimler okundu olarak işaretlendi");
    } else {
      toast.error(result.error);
    }
  }

  const filterTabs: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "Tümü", count: visible.length },
    { key: "unread", label: "Okunmadı", count: unreadCount },
    { key: "read", label: "Okundu", count: visible.length - unreadCount },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-vw-primary" />
          <h1 className="text-xl font-semibold text-foreground">Bildirimler</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Tümünü Okundu Yap
            </Button>
          )}
          {isAdmin && <CreateNotificationDialog />}
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {filterTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={currentFilter === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams("filter", tab.key === "all" ? "" : tab.key)}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
              )}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Bildirim ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Ara
          </Button>
        </form>
      </div>

      {/* Notification list */}
      {searched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {currentSearch
              ? "Aramayla eşleşen bildirim bulunamadı"
              : currentFilter === "unread"
                ? "Okunmamış bildirim yok"
                : currentFilter === "read"
                  ? "Okunmuş bildirim yok"
                  : "Henüz bildirim yok"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {searched.map((n) => (
            <NotificationCard
              key={n.notif_id}
              notifId={n.notif_id}
              title={n.title}
              message={n.message}
              createdBy={n.created_by}
              createdAt={n.created_at}
              isRead={readSet.has(n.notif_id)}
              isAdmin={isAdmin}
              onDeleteClick={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete dialog */}
      <DeleteNotificationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        notifId={deleteTarget}
      />
    </div>
  );
}
