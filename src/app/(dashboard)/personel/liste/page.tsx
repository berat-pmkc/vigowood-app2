import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PersonelListeClient } from "./components/personel-liste-client";

export const metadata: Metadata = { title: "Personel Listesi" };

export default async function PersonelListePage() {
  const supabase = await createClient();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. Üretim rolündeki aktif kullanıcılar
  const employeesQuery = supabase
    .from("users")
    .select("user_id, full_name, station, role")
    .eq("role", "Üretim")
    .eq("is_active", true)
    .order("full_name");

  // 2. Bugünkü yoklama kayıtları
  const attendanceQuery = supabase
    .from("attendance")
    .select("att_id, employee, department, start_time, end_time")
    .eq("tarih", todayStr);

  const [employeesResult, attendanceResult] = await Promise.all([
    employeesQuery,
    attendanceQuery,
  ]);

  if (employeesResult.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {employeesResult.error.message}
        </p>
      </div>
    );
  }

  const employees = (employeesResult.data ?? []) as {
    user_id: string;
    full_name: string;
    station: string | null;
    role: string;
  }[];

  const todayAttendance = (attendanceResult.data ?? []) as {
    att_id: string;
    employee: string;
    department: string | null;
    start_time: string | null;
    end_time: string | null;
  }[];

  return (
    <div className="px-4 sm:px-6">
      <PersonelListeClient
        employees={employees}
        todayAttendance={todayAttendance}
        todayStr={todayStr}
      />
    </div>
  );
}
