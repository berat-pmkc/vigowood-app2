"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { isStationEmail } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError("");

    // Validate
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LoginFormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setServerError("E-posta veya şifre hatalı");
      setLoading(false);
      return;
    }

    // Station accounts → operator selection (Hat rolü hariç)
    if (isStationEmail(formData.email)) {
      // Hat rolü kontrolü — kişi seçimi gerekmez, direkt dashboard'a
      const { data: stationUser } = await supabase
        .from("users")
        .select("user_id, full_name, role")
        .eq("email", formData.email)
        .single();

      if (stationUser?.role === "Hat") {
        await supabase.auth.updateUser({
          data: {
            selected_operator_id: stationUser.user_id,
            selected_operator_name: stationUser.full_name,
          },
        });
        router.push("/");
      } else {
        router.push("/select-operator");
      }
    } else {
      router.push("/");
    }

    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vw-light p-4">
      <Card className="w-full max-w-md border-vw-side/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            <Image
              src="/logo-yuvarlak.png"
              alt="VigoWood"
              width={72}
              height={72}
              className="rounded-full"
              priority
            />
          </div>
          <CardTitle className="text-xl text-vw-dark">
            <Image
              src="/logo-yatay.svg"
              alt="VigoWood"
              width={160}
              height={37}
              className="mx-auto h-7 w-auto"
            />
          </CardTitle>
          <CardDescription>Devam etmek için giriş yapın</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@vigowood.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                autoComplete="email"
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-vw-error">{errors.email}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="Şifrenizi giriniz"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                autoComplete="current-password"
                disabled={loading}
              />
              {errors.password && (
                <p className="text-sm text-vw-error">{errors.password}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md bg-vw-error/10 px-3 py-2 text-sm text-vw-error">
                {serverError}
              </div>
            )}

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
