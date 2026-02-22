"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";
type Station = "Kesim" | "Temizlik" | "Montaj" | "Paketleme" | "Kutu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, UserCheck, Loader2 } from "lucide-react";

type Operator = {
  user_id: string;
  full_name: string;
  station: string;
};

export default function SelectOperatorPage() {
  const router = useRouter();
  const supabase = createClient();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [stationName, setStationName] = useState("");

  useEffect(() => {
    async function load() {
      // Get current auth user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        router.push("/login");
        return;
      }

      // Get station account info
      const { data: stationUser } = await supabase
        .from("users")
        .select("full_name, station")
        .eq("email", user.email)
        .single();

      if (stationUser) {
        setStationName(stationUser.full_name);
      }

      // Map station email → production station name
      const stationMap: Record<string, Station[]> = {
        "kesim@vigowood.com": ["Kesim"],
        "temizlik@vigowood.com": ["Temizlik"],
        "montaj@vigowood.com": ["Montaj"],
        "montaj2@vigowood.com": ["Montaj"],
        "montaj3@vigowood.com": ["Montaj"],
        "paketleme@vigowood.com": ["Paketleme"],
        "kutu@vigowood.com": ["Kutu"],
      };

      const stations = stationMap[user.email];
      if (!stations) {
        router.push("/");
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("user_id, full_name, station")
        .eq("role", "Üretim")
        .eq("is_active", true)
        .in("station", stations)
        .order("full_name");

      setOperators(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function selectOperator(operator: Operator) {
    setSelecting(operator.user_id);

    // Store selected operator in user metadata
    await supabase.auth.updateUser({
      data: {
        selected_operator_id: operator.user_id,
        selected_operator_name: operator.full_name,
      },
    });

    router.push("/");
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vw-light">
        <Loader2 className="size-8 animate-spin text-vw-side" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vw-light p-4">
      <Card className="w-full max-w-lg border-vw-side/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-vw-dark">
            <span className="text-2xl font-bold text-vw-light">VW</span>
          </div>
          <CardTitle className="text-xl text-vw-dark">
            {stationName || APP_NAME}
          </CardTitle>
          <CardDescription>Operatör seçiniz</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {operators.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu istasyona atanmış aktif operatör bulunamadı.
            </p>
          ) : (
            <div className="grid gap-2">
              {operators.map((op) => (
                <Button
                  key={op.user_id}
                  variant="outline"
                  className="h-auto justify-start gap-3 px-4 py-3 text-left"
                  disabled={selecting !== null}
                  onClick={() => selectOperator(op)}
                >
                  {selecting === op.user_id ? (
                    <Loader2 className="size-5 animate-spin text-vw-side" />
                  ) : (
                    <UserCheck className="size-5 text-vw-deep" />
                  )}
                  <div>
                    <div className="font-medium text-vw-dark">
                      {op.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {op.user_id}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}

          <div className="mt-2 border-t pt-4">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              Çıkış Yap
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
