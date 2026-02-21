"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { createNotification, getActiveUsers } from "../actions";
import { toast } from "sonner";

export function CreateNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAll, setTargetAll] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<{ user_id: string; full_name: string; role: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (open && !targetAll && users.length === 0) {
      loadUsers();
    }
  }, [open, targetAll, users.length]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const data = await getActiveUsers();
      setUsers(data);
    } catch {
      toast.error("Kullanıcı listesi yüklenemedi");
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createNotification({
      title: title.trim(),
      message: message.trim() || null,
      target_users: targetAll ? [] : selectedUsers,
    });

    setLoading(false);

    if (result.success) {
      toast.success("Bildirim oluşturuldu");
      setOpen(false);
      resetForm();
    } else {
      toast.error(result.error);
    }
  }

  function resetForm() {
    setTitle("");
    setMessage("");
    setTargetAll(true);
    setSelectedUsers([]);
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Bildirim
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Bildirim Oluştur</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Başlık *</Label>
            <Input
              id="notif-title"
              placeholder="Bildirim başlığı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-message">Mesaj</Label>
            <Textarea
              id="notif-message"
              placeholder="Bildirim detayı (opsiyonel)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label>Hedef</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="target-all"
                checked={targetAll}
                onCheckedChange={(v) => {
                  setTargetAll(!!v);
                  if (v) setSelectedUsers([]);
                  if (!v && users.length === 0) loadUsers();
                }}
              />
              <Label htmlFor="target-all" className="text-sm font-normal">
                Tüm kullanıcılara gönder
              </Label>
            </div>

            {!targetAll && (
              <div className="rounded-md border">
                {usersLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-48">
                    <div className="space-y-1 p-2">
                      {users.map((u) => (
                        <label
                          key={u.user_id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                          <Checkbox
                            checked={selectedUsers.includes(u.user_id)}
                            onCheckedChange={() => toggleUser(u.user_id)}
                          />
                          <span className="text-sm">{u.full_name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {u.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {selectedUsers.length > 0 && (
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {selectedUsers.length} kullanıcı seçildi
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || (!targetAll && selectedUsers.length === 0)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gönder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
