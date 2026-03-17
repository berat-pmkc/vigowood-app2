"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import {
  USER_ROLES,
  USER_STATIONS,
  USER_STATION_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  ALWAYS_VISIBLE_MODULES,
  ROLE_DEFAULT_MODULES,
  type ModuleKey,
  type UserRole,
} from "@/lib/constants";
import {
  userCreateSchema,
  type UserCreateData,
} from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { createUser, updateUser, getNextUserId, uploadUserAvatar, deleteUserAvatar } from "../actions";
import { toast } from "sonner";
import type { UserWithLastSignIn } from "../page";

interface UserEditSheetProps {
  user: UserWithLastSignIn | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function UserEditSheet({
  user,
  mode,
  open,
  onOpenChange,
  onSaved,
}: UserEditSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(true);
  const [canBeOpsAssignee, setCanBeOpsAssignee] = useState(false);
  const [password, setPassword] = useState("");
  const [useCustomModules, setUseCustomModules] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const isCreate = mode === "create";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserCreateData>({
    resolver: zodResolver(userCreateSchema),
  });

  useEffect(() => {
    if (!open) return;

    if (isCreate) {
      // Auto-generate next user ID
      startTransition(async () => {
        const nextId = await getNextUserId();
        reset({
          user_id: nextId,
          full_name: "",
          email: null,
          role: "Üretim" as UserCreateData["role"],
          station: "Kesim" as UserCreateData["station"],
        });
        setPassword("");
        setUseCustomModules(false);
        setAllowedModules([]);
      });
    } else if (user) {
      reset({
        user_id: user.user_id,
        full_name: user.full_name || "",
        email: user.email || null,
        role: user.role as UserCreateData["role"],
        station: user.station as UserCreateData["station"],
      });
      setIsActive(user.is_active);
      setCanBeOpsAssignee(user.can_be_ops_assignee ?? false);
      setPassword(user.password_plain || "");
      if (user.allowed_modules) {
        setUseCustomModules(true);
        setAllowedModules(user.allowed_modules);
      } else {
        setUseCustomModules(false);
        setAllowedModules([]);
      }
    }
  }, [user, isCreate, reset, open]);

  const onSubmit = (data: UserCreateData) => {
    startTransition(async () => {
      if (isCreate) {
        const result = await createUser({
          user_id: data.user_id,
          full_name: data.full_name,
          email: data.email,
          role: data.role,
          station: data.station,
          password_plain: password || null,
          allowed_modules: useCustomModules ? allowedModules : null,
        });
        if (result.success) {
          toast.success("Kullanıcı oluşturuldu");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      } else {
        if (!user) return;
        const result = await updateUser(user.user_id, {
          full_name: data.full_name,
          email: data.email,
          role: data.role,
          station: data.station,
          is_active: isActive,
          password_plain: password || null,
          can_be_ops_assignee: canBeOpsAssignee,
          allowed_modules: useCustomModules ? allowedModules : null,
        });
        if (result.success) {
          toast.success("Kullanıcı güncellendi");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const roleValue = watch("role");
  const stationValue = watch("station");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isCreate ? "Yeni Kullanıcı" : "Kullanıcı Düzenle"}</SheetTitle>
          <SheetDescription>
            {isCreate ? "Yeni kullanıcı oluşturun" : user?.user_id}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* Avatar upload — only in edit mode */}
          {!isCreate && user && (
            <div className="flex justify-center">
              <AvatarUpload
                avatarUrl={user.avatar_url}
                fullName={user.full_name}
                userId={user.user_id}
                onUpload={uploadUserAvatar}
                onDelete={deleteUserAvatar}
              />
            </div>
          )}

          <div className="space-y-4">
            {/* User ID — only editable in create mode */}
            {isCreate ? (
              <div className="space-y-2">
                <Label htmlFor="user_id">Kullanıcı ID</Label>
                <Input
                  id="user_id"
                  {...register("user_id")}
                  placeholder="ör: VW057"
                />
                {errors.user_id && (
                  <p className="text-sm text-destructive">
                    {errors.user_id.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Kullanıcı ID</Label>
                <p className="font-mono text-sm font-medium">{user?.user_id}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full_name">Ad Soyad</Label>
              <Input
                id="full_name"
                {...register("full_name")}
                placeholder="Ad soyad..."
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta (opsiyonel)</Label>
              <Input
                id="email"
                type="email"
                {...register("email", {
                  setValueAs: (v: string) => (v === "" ? null : v),
                })}
                placeholder="ornek@vigowood.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ör: Hasan2026."
              />
              <p className="text-xs text-muted-foreground">
                E-posta olan kullanıcılar için giriş şifresi de güncellenir
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={roleValue}
                onValueChange={(v) => {
                  setValue("role", v as UserCreateData["role"], {
                    shouldValidate: true,
                  });
                  // Rol değişince custom modules açıksa varsayılanları güncelle
                  if (useCustomModules) {
                    setAllowedModules([...(ROLE_DEFAULT_MODULES[v as UserRole] || [])]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">
                  {errors.role.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="station">İstasyon</Label>
              <Select
                value={stationValue}
                onValueChange={(v) =>
                  setValue("station", v as UserCreateData["station"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="İstasyon seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {USER_STATIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {USER_STATION_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.station && (
                <p className="text-sm text-destructive">
                  {errors.station.message}
                </p>
              )}
            </div>

            {/* is_active & ops — only in edit mode */}
            {!isCreate && user && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      setIsActive(checked === true);
                    }}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Aktif kullanıcı
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="can_be_ops_assignee"
                    checked={canBeOpsAssignee}
                    onCheckedChange={(checked) => {
                      setCanBeOpsAssignee(checked === true);
                    }}
                  />
                  <Label htmlFor="can_be_ops_assignee" className="cursor-pointer">
                    OPS Center&apos;da görev atanabilir
                  </Label>
                </div>
              </div>
            )}

            {/* Modül erişim yönetimi */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Modül Erişimi</Label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !useCustomModules;
                    setUseCustomModules(next);
                    if (next) {
                      const role = (roleValue || "Üretim") as UserRole;
                      setAllowedModules([...(ROLE_DEFAULT_MODULES[role] || [])]);
                    } else {
                      setAllowedModules([]);
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {useCustomModules ? "Varsayılana dön" : "Özelleştir"}
                </button>
              </div>

              {(() => {
                // Görüntülenecek modüller: custom açıksa allowedModules, değilse rol varsayılanları
                const role = (roleValue || "Üretim") as UserRole;
                const activeModules = useCustomModules
                  ? allowedModules
                  : ROLE_DEFAULT_MODULES[role] || [];

                return (
                  <div className="flex flex-wrap gap-1.5">
                    {MODULE_KEYS.map((moduleKey) => {
                      const isAlwaysVisible = ALWAYS_VISIBLE_MODULES.includes(moduleKey);
                      const isActive = isAlwaysVisible || activeModules.includes(moduleKey);

                      return (
                        <button
                          key={moduleKey}
                          type="button"
                          disabled={!useCustomModules || isAlwaysVisible}
                          onClick={() => {
                            if (!useCustomModules || isAlwaysVisible) return;
                            if (isActive) {
                              setAllowedModules((prev) => prev.filter((m) => m !== moduleKey));
                            } else {
                              setAllowedModules((prev) => [...prev, moduleKey]);
                            }
                          }}
                          className={`
                            inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-all
                            ${!useCustomModules
                              ? isActive
                                ? "bg-muted text-muted-foreground"
                                : "bg-muted/40 text-muted-foreground/50"
                              : isAlwaysVisible
                                ? "bg-vw-primary/20 text-vw-dark cursor-default"
                                : isActive
                                  ? "bg-vw-primary text-white hover:bg-vw-deep cursor-pointer"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
                            }
                            ${!useCustomModules ? "cursor-default opacity-70" : ""}
                          `}
                        >
                          {MODULE_LABELS[moduleKey]}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {!useCustomModules && (
                <p className="text-[11px] text-muted-foreground">
                  Rol varsayılanları kullanılıyor
                </p>
              )}
            </div>
          </div>

          {/* Read-only info — only in edit mode */}
          {!isCreate && user && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Sistem Bilgileri (salt okunur)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Auth ID</span>
                    <p className="font-mono text-xs truncate">
                      {user.auth_id || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kayıt Tarihi</span>
                    <p>{formatDate(user.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Son Güncelleme</span>
                    <p>{formatDate(user.updated_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Son Giriş</span>
                    <p>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Kaydediliyor..."
                : isCreate
                  ? "Oluştur"
                  : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
