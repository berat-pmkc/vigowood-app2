"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  Loader2,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  quickToggleAttendance,
  bulkQuickAttendance,
  bulkRemoveAttendance,
  updateAttendanceTime,
} from "../actions";
import { cn } from "@/lib/utils";

interface Employee {
  user_id: string;
  full_name: string;
  station: string | null;
  role: string;
}

interface AttendanceRecord {
  att_id: string;
  employee: string;
  department: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface PersonelListeClientProps {
  employees: Employee[];
  todayAttendance: AttendanceRecord[];
  todayStr: string;
}

// Station → görüntüleme departman adı
const STATION_DISPLAY: Record<string, string> = {
  Kesim: "Kesim",
  Temizlik: "Temizlik",
  Montaj: "Montaj",
  Paketleme: "Paketleme",
  Kutu: "Kutu-Koli",
  "Kesim Hattı": "Kesim",
  "Temilik Hattı": "Temizlik",
  "Montaj Hattı": "Montaj",
  "Paketleme Hattı": "Paketleme",
  "Kutu Hattı": "Kutu-Koli",
};

// Departman renkleri
const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; cardBg: string }> = {
  Kesim: { bg: "bg-blue-500", border: "border-blue-300", text: "text-blue-700", cardBg: "bg-blue-50" },
  Temizlik: { bg: "bg-emerald-500", border: "border-emerald-300", text: "text-emerald-700", cardBg: "bg-emerald-50" },
  Montaj: { bg: "bg-purple-500", border: "border-purple-300", text: "text-purple-700", cardBg: "bg-purple-50" },
  Paketleme: { bg: "bg-amber-500", border: "border-amber-300", text: "text-amber-700", cardBg: "bg-amber-50" },
  "Kutu-Koli": { bg: "bg-orange-500", border: "border-orange-300", text: "text-orange-700", cardBg: "bg-orange-50" },
  Diğer: { bg: "bg-gray-500", border: "border-gray-300", text: "text-gray-700", cardBg: "bg-gray-50" },
};

export function PersonelListeClient({
  employees,
  todayAttendance,
  todayStr,
}: PersonelListeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [loadingDept, setLoadingDept] = useState<string | null>(null);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("08:00");
  const [editEnd, setEditEnd] = useState("18:00");
  const [savingTime, setSavingTime] = useState(false);

  // Yoklama setini oluştur (isim bazlı)
  const attendanceSet = useMemo(
    () => new Set(todayAttendance.map((a) => a.employee)),
    [todayAttendance]
  );

  // Departman bazlı gruplama
  const grouped = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    for (const emp of employees) {
      const dept = emp.station ? (STATION_DISPLAY[emp.station] || "Diğer") : "Diğer";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(emp);
    }
    // Sıralama: Kesim → Temizlik → Montaj → Paketleme → Kutu-Koli → Diğer
    const order = ["Kesim", "Temizlik", "Montaj", "Paketleme", "Kutu-Koli", "Diğer"];
    const sorted: [string, Employee[]][] = [];
    for (const dept of order) {
      if (groups[dept] && groups[dept].length > 0) {
        sorted.push([dept, groups[dept]]);
      }
    }
    return sorted;
  }, [employees]);

  // İstatistikler
  const totalEmployees = employees.length;
  const presentCount = employees.filter((e) => attendanceSet.has(e.full_name)).length;
  const absentCount = totalEmployees - presentCount;

  // Tek kişi toggle
  const handleToggle = (emp: Employee) => {
    setLoadingUserId(emp.user_id);
    startTransition(async () => {
      const result = await quickToggleAttendance(emp.full_name, emp.station, todayStr);
      setLoadingUserId(null);
      if (result.success) {
        if (result.action === "created") {
          toast.success(`${emp.full_name} — yoklama alındı (08:00-18:00)`);
        } else {
          toast.info(`${emp.full_name} — yoklama kaldırıldı`);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Saat düzenleme popover aç
  const openTimeEdit = (attendance: AttendanceRecord) => {
    setTimeEditId(attendance.att_id);
    setEditStart(attendance.start_time?.slice(0, 5) || "08:00");
    setEditEnd(attendance.end_time?.slice(0, 5) || "18:00");
  };

  // Saat kaydet
  const handleSaveTime = (attId: string) => {
    setSavingTime(true);
    startTransition(async () => {
      const result = await updateAttendanceTime(attId, editStart, editEnd);
      setSavingTime(false);
      if (result.success) {
        toast.success(`Saat güncellendi: ${editStart}-${editEnd}`);
        setTimeEditId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Departman toplu yoklama
  const handleBulkDept = (dept: string, deptEmployees: Employee[]) => {
    setLoadingDept(dept);
    startTransition(async () => {
      const result = await bulkQuickAttendance(
        deptEmployees.map((e) => ({ full_name: e.full_name, station: e.station })),
        todayStr
      );
      setLoadingDept(null);
      if (result.success) {
        if (result.created > 0) {
          toast.success(`${dept}: ${result.created} kişi yoklama alındı${result.skipped > 0 ? `, ${result.skipped} zaten kayıtlı` : ""}`);
        } else {
          toast.info(`${dept}: Tüm çalışanların yoklaması zaten alınmış`);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Departman toplu kaldırma
  const handleBulkRemove = (dept: string, deptEmployees: Employee[]) => {
    setLoadingDept(dept);
    startTransition(async () => {
      const result = await bulkRemoveAttendance(
        deptEmployees.map((e) => e.full_name),
        todayStr
      );
      setLoadingDept(null);
      if (result.success) {
        if (result.removed > 0) {
          toast.info(`${dept}: ${result.removed} yoklama kaldırıldı`);
        } else {
          toast.info(`${dept}: Kaldırılacak yoklama yok`);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Tümünü işaretle
  const handleMarkAll = () => {
    setLoadingDept("all");
    startTransition(async () => {
      const result = await bulkQuickAttendance(
        employees.map((e) => ({ full_name: e.full_name, station: e.station })),
        todayStr
      );
      setLoadingDept(null);
      if (result.success) {
        if (result.created > 0) {
          toast.success(`${result.created} kişi yoklama alındı${result.skipped > 0 ? `, ${result.skipped} zaten kayıtlı` : ""}`);
        } else {
          toast.info("Tüm çalışanların yoklaması zaten alınmış");
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const todayFormatted = new Date(todayStr).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personel Listesi</h1>
          <p className="text-sm text-muted-foreground">
            {todayFormatted} — Hızlı yoklama
          </p>
        </div>
        <Button
          onClick={handleMarkAll}
          disabled={isPending}
          size="sm"
          className="w-full sm:w-auto"
        >
          {loadingDept === "all" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          Tümünü İşaretle
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toplam</p>
              <p className="text-xl font-bold">{totalEmployees}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gelen</p>
              <p className="text-xl font-bold text-emerald-600">{presentCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gelmeyen</p>
              <p className="text-xl font-bold text-red-600">{absentCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Groups */}
      {grouped.map(([dept, deptEmployees]) => {
        const colors = DEPT_COLORS[dept] || DEPT_COLORS["Diğer"];
        const deptPresent = deptEmployees.filter((e) => attendanceSet.has(e.full_name)).length;
        const allPresent = deptPresent === deptEmployees.length;

        return (
          <Card key={dept}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", colors.bg)} />
                  <CardTitle className="text-base">{dept}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {deptPresent}/{deptEmployees.length}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {!allPresent && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleBulkDept(dept, deptEmployees)}
                      className="h-7 text-xs"
                    >
                      {loadingDept === dept ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      Tümü
                    </Button>
                  )}
                  {deptPresent > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleBulkRemove(dept, deptEmployees)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Temizle
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {deptEmployees.map((emp) => {
                  const isPresent = attendanceSet.has(emp.full_name);
                  const isLoading = loadingUserId === emp.user_id;
                  const attendance = todayAttendance.find((a) => a.employee === emp.full_name);

                  return (
                    <div
                      key={emp.user_id}
                      className={cn(
                        "relative flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all",
                        isPresent
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border bg-card"
                      )}
                    >
                      {/* Tıklanabilir ana alan (toggle) */}
                      <button
                        onClick={() => handleToggle(emp)}
                        disabled={isPending}
                        className="flex flex-col items-center gap-1 hover:opacity-80 active:scale-[0.97] disabled:opacity-60"
                      >
                        {/* Status indicator */}
                        {isLoading ? (
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        ) : isPresent ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <UserX className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}

                        {/* Name */}
                        <span className={cn(
                          "text-center text-xs font-medium leading-tight",
                          isPresent ? "text-emerald-800" : "text-foreground"
                        )}>
                          {emp.full_name}
                        </span>
                      </button>

                      {/* Saat — tıklanabilir popover */}
                      {isPresent && attendance && (
                        <Popover
                          open={timeEditId === attendance.att_id}
                          onOpenChange={(open) => {
                            if (open) {
                              openTimeEdit(attendance);
                            } else {
                              setTimeEditId(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-emerald-600 transition-colors hover:bg-emerald-200/60 hover:text-emerald-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {attendance.start_time?.slice(0, 5)}-{attendance.end_time?.slice(0, 5)}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-56 p-3"
                            align="center"
                            side="top"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {emp.full_name}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px]">Giriş</Label>
                                  <Input
                                    type="time"
                                    value={editStart}
                                    onChange={(e) => setEditStart(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Çıkış</Label>
                                  <Input
                                    type="time"
                                    value={editEnd}
                                    onChange={(e) => setEditEnd(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 w-full text-xs"
                                disabled={savingTime}
                                onClick={() => handleSaveTime(attendance.att_id)}
                              >
                                {savingTime ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="mr-1 h-3 w-3" />
                                )}
                                Kaydet
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {employees.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="mb-2 h-8 w-8" />
            <p>Üretim rolünde aktif çalışan bulunamadı</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
