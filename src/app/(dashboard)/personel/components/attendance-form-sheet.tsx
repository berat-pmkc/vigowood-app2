"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YOKLAMA_DURUMLARI, YOKLAMA_DURUM_LABELS } from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  attendanceCreateSchema,
  type AttendanceCreateData,
} from "@/lib/validations";
import {
  ATTENDANCE_DEPARTMENTS,
  ATTENDANCE_DEPARTMENT_LABELS,
} from "@/lib/constants";
import {
  getEmployeeList,
  createAttendance,
  updateAttendance,
} from "../actions";
import type { Database } from "@/lib/supabase/types";

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: AttendanceRow | null;
}

// Map station to department for auto-fill
const STATION_TO_DEPT: Record<string, string> = {
  Kesim: "Kesim",
  Temizlik: "Temizlik",
  Montaj: "Montaj",
  Paketleme: "Paketleme",
  Kutu: "Paketleme Hatti",
};

export function AttendanceFormSheet({
  open,
  onOpenChange,
  editingRecord,
}: AttendanceFormSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [employees, setEmployees] = useState<
    { user_id: string; full_name: string; station: string | null }[]
  >([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const isEdit = !!editingRecord;
  const todayStr = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AttendanceCreateData>({
    resolver: zodResolver(attendanceCreateSchema),
    defaultValues: {
      employee: "",
      tarih: todayStr,
      department: "Kesim",
      durum: "geldi",
      start_time: "08:00",
      end_time: "17:30",
      not_text: null,
    },
  });

  const selectedEmployee = watch("employee");
  const selectedDepartment = watch("department");
  const selectedDurum = watch("durum");
  const saatGerekli = selectedDurum === "geldi";

  // Load employees when sheet opens
  useEffect(() => {
    if (open && employees.length === 0) {
      setEmployeesLoading(true);
      getEmployeeList()
        .then((data) => setEmployees(data))
        .catch(() => toast.error("Çalışan listesi yüklenemedi"))
        .finally(() => setEmployeesLoading(false));
    }
  }, [open, employees.length]);

  // Reset form when sheet opens / record changes
  useEffect(() => {
    if (open) {
      if (editingRecord) {
        reset({
          employee: editingRecord.employee,
          tarih: editingRecord.tarih,
          department: (editingRecord.department || "Kesim") as AttendanceCreateData["department"],
          durum: (editingRecord.durum || "geldi") as AttendanceCreateData["durum"],
          start_time: editingRecord.start_time?.slice(0, 5) || "08:00",
          end_time: editingRecord.end_time?.slice(0, 5) || "17:30",
          not_text: editingRecord.not_text || null,
        });
      } else {
        reset({
          employee: "",
          tarih: todayStr,
          department: "Kesim",
          durum: "geldi",
          start_time: "08:00",
          end_time: "17:30",
          not_text: null,
        });
      }
    }
  }, [open, editingRecord, reset, todayStr]);

  const onSubmit = (data: AttendanceCreateData) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateAttendance(editingRecord!.att_id, data)
        : await createAttendance(data);

      if (result.success) {
        toast.success(isEdit ? "Kayıt güncellendi" : "Yoklama kaydı oluşturuldu");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleEmployeeSelect = (employeeName: string) => {
    setValue("employee", employeeName, { shouldValidate: true });
    setComboboxOpen(false);

    // Auto-fill department from station
    const emp = employees.find((e) => e.full_name === employeeName);
    if (emp?.station) {
      const dept = STATION_TO_DEPT[emp.station];
      if (dept) {
        setValue("department", dept as AttendanceCreateData["department"], {
          shouldValidate: true,
        });
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Yoklama Kaydını Düzenle" : "Yeni Yoklama Kaydı"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Employee (Combobox) */}
          <div className="space-y-2">
            <Label>Çalışan *</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedEmployee || "Çalışan seçiniz..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Çalışan ara..." />
                  <CommandList>
                    <CommandEmpty>
                      {employeesLoading ? "Yükleniyor..." : "Çalışan bulunamadı."}
                    </CommandEmpty>
                    <CommandGroup>
                      {employees.map((emp) => (
                        <CommandItem
                          key={emp.user_id}
                          value={emp.full_name}
                          onSelect={handleEmployeeSelect}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployee === emp.full_name
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span>{emp.full_name}</span>
                          {emp.station && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {emp.station}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.employee && (
              <p className="text-sm text-destructive">{errors.employee.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="tarih">Tarih *</Label>
            <Input id="tarih" type="date" {...register("tarih")} />
            {errors.tarih && (
              <p className="text-sm text-destructive">{errors.tarih.message}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Departman *</Label>
            <Select
              value={selectedDepartment}
              onValueChange={(v) =>
                setValue("department", v as AttendanceCreateData["department"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Departman seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {ATTENDANCE_DEPARTMENT_LABELS[dept]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department && (
              <p className="text-sm text-destructive">{errors.department.message}</p>
            )}
          </div>

          {/* Durum — gelmeyen personelin mazeretli olup olmadığını kayda geçirir */}
          <div className="space-y-2">
            <Label>Durum *</Label>
            <Select
              value={selectedDurum}
              onValueChange={(v) =>
                setValue("durum", v as AttendanceCreateData["durum"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {YOKLAMA_DURUMLARI.map((d) => (
                  <SelectItem key={d} value={d}>
                    {YOKLAMA_DURUM_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!saatGerekli && (
              <p className="text-xs text-muted-foreground">
                {selectedDurum === "devamsiz"
                  ? "Mazeretsiz gelmedi olarak kaydedilir, devamsızlık raporuna yansır."
                  : "Personel işyerinde olmadığı için giriş/çıkış saati kaydedilmez."}
              </p>
            )}
          </div>

          {/* Saatler yalnızca gelinen günlerde girilir */}
          {saatGerekli && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Giriş Saati *</Label>
              <Input id="start_time" type="time" {...register("start_time")} />
              {errors.start_time && (
                <p className="text-sm text-destructive">
                  {errors.start_time.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Çıkış Saati *</Label>
              <Input id="end_time" type="time" {...register("end_time")} />
              {errors.end_time && (
                <p className="text-sm text-destructive">
                  {errors.end_time.message}
                </p>
              )}
            </div>
          </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="not_text">Not</Label>
            <Textarea
              id="not_text"
              placeholder="Opsiyonel not..."
              rows={3}
              {...register("not_text", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
            />
            {errors.not_text && (
              <p className="text-sm text-destructive">{errors.not_text.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
