"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "sonner";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface AvatarUploadProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  userId: string;
  onUpload: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  onDelete: (userId: string) => Promise<{ success: boolean; error?: string }>;
}

export function AvatarUpload({
  avatarUrl,
  fullName,
  userId,
  onUpload,
  onDelete,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayUrl = preview || avatarUrl;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Sadece JPEG, PNG veya WebP formatı destekleniyor");
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error("Dosya boyutu en fazla 2MB olabilir");
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    startTransition(async () => {
      const result = await onUpload(formData);
      if (result.success) {
        toast.success("Profil fotoğrafı güncellendi");
      } else {
        toast.error(result.error || "Yükleme başarısız");
        setPreview(null);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete(userId);
      if (result.success) {
        toast.success("Profil fotoğrafı kaldırıldı");
        setPreview(null);
      } else {
        toast.error(result.error || "Silme başarısız");
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar
          avatarUrl={displayUrl}
          fullName={fullName}
          size="xl"
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-1.5 size-3.5" />
          Fotoğraf Yükle
        </Button>
        {displayUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Kaldır
          </Button>
        )}
      </div>
    </div>
  );
}
