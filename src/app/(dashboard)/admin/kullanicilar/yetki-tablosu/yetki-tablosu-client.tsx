"use client";

import { useMemo, useState } from "react";
import { Check, Download, Lock, Minus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getFilteredNavGroups } from "@/lib/navigation";
import {
  USER_ROLES, MODULE_LABELS, MODULE_KEYS, ROLE_DEFAULT_MODULES, isStationEmail, isStationRole,
  type UserRole, type ModuleKey,
} from "@/lib/constants";
import { exportToExcel } from "@/lib/excel-utils";

export type YetkiItem = { href: string; title: string; stationBlocked: boolean };
export type YetkiGroup = { label: string; items: YetkiItem[] };
export type YetkiUser = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  station: string | null;
  allowed_modules: string[] | null;
};

/** Kenar çubuğuyla aynı kaynak: rol + allowed_modules */
function visibleHrefs(role: string, allowed: string[] | null): Set<string> {
  const set = new Set<string>();
  for (const g of getFilteredNavGroups(role as UserRole, allowed)) {
    for (const i of g.items) set.add(i.href);
  }
  return set;
}

function modulesSummary(u: YetkiUser): string {
  if (!u.allowed_modules) return "Rol varsayılanı";
  const all = MODULE_KEYS.filter((m) => m !== "ana_sayfa");
  const on = all.filter((m) => u.allowed_modules!.includes(m));
  if (on.length === all.length) return "Tümü";
  if (on.length === 0) return "Hiçbiri";
  return on.map((m) => MODULE_LABELS[m as ModuleKey]).join(", ");
}

type Row = {
  key: string;
  name: string;
  role: string;
  sub: string;
  station: boolean;
  modules: string;
  locked: boolean;
  count: number;
  cells: Set<string>;
  partial: Map<string, number>;
};

export function YetkiTablosuClient({ groups, users }: { groups: YetkiGroup[]; users: YetkiUser[] }) {
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [showStations, setShowStations] = useState(true);
  const [roleSummary, setRoleSummary] = useState(false);

  const shownGroups = useMemo(
    () => groups.filter((g) => groupFilter === "__all__" || g.label === groupFilter),
    [groups, groupFilter],
  );
  const columns = useMemo(
    () => shownGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))),
    [shownGroups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return users.filter((u) => {
      if (roleFilter !== "__all__" && u.role !== roleFilter) return false;
      if (!showStations && isStationEmail(u.email ?? undefined)) return false;
      if (q && !`${u.full_name} ${u.user_id} ${u.email ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
  }, [users, roleFilter, search, showStations]);

  const rows: Row[] = useMemo(() => {
    if (!roleSummary) {
      return filtered.map((u) => ({
        key: u.user_id,
        name: u.full_name,
        role: u.role,
        sub: u.email ?? u.user_id,
        station: isStationEmail(u.email ?? undefined),
        modules: modulesSummary(u),
        locked: isStationRole(u.role),
        count: 1,
        cells: visibleHrefs(u.role, u.allowed_modules),
        partial: new Map<string, number>(),
      }));
    }
    const out: Row[] = [];
    for (const role of USER_ROLES) {
      const us = filtered.filter((u) => u.role === role);
      if (us.length === 0) continue;
      const counts = new Map<string, number>();
      for (const u of us) {
        for (const h of visibleHrefs(u.role, u.allowed_modules)) counts.set(h, (counts.get(h) ?? 0) + 1);
      }
      const cells = new Set<string>();
      const partial = new Map<string, number>();
      for (const [h, c] of counts) {
        if (c === us.length) cells.add(h);
        else partial.set(h, c);
      }
      const defaults = (ROLE_DEFAULT_MODULES[role] ?? []).filter((m) => m !== "ana_sayfa").map((m) => MODULE_LABELS[m]);
      out.push({
        key: role, name: role, role, sub: `${us.length} kullanıcı`, station: false,
        modules: `Varsayılan: ${defaults.join(", ")}`, locked: isStationRole(role), count: us.length, cells, partial,
      });
    }
    return out;
  }, [filtered, roleSummary]);

  function handleExport() {
    const cols = [
      { key: "name", header: roleSummary ? "Rol" : "Kullanıcı", width: 28 },
      { key: "role", header: "Rol (detay)", width: 26 },
      { key: "sub", header: roleSummary ? "Adet" : "E-posta", width: 30 },
      { key: "modules", header: "Modüller", width: 40 },
      ...columns.map((c, i) => ({ key: `c${i}`, header: `${c.group} / ${c.title}`, width: 16 })),
    ];
    const data = rows.map((r) => {
      const o: Record<string, unknown> = { name: r.name, role: r.role, sub: r.sub, modules: r.modules };
      columns.forEach((c, i) => {
        o[`c${i}`] = r.cells.has(c.href)
          ? "Görür"
          : r.partial.has(c.href)
            ? `Kısmi (${r.partial.get(c.href)}/${r.count})`
            : "Göremez";
      });
      return o;
    });
    exportToExcel(data, cols, "yetki-tablosu");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kullanıcı ara..." className="pl-8" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Tüm Roller" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Roller</SelectItem>
            {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tüm Bölümler" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Bölümler</SelectItem>
            {groups.map((g) => <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
          İstasyon hesapları
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={roleSummary} onChange={(e) => setRoleSummary(e.target.checked)} />
          Rol özeti
        </label>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport}>
          <Download className="mr-1 h-4 w-4" />
          Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-600" /> Görür</span>
        <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5" /> Göremez</span>
        <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-amber-600" /> Üretim/Hat için kilitli (sayfa + işlem engelli)</span>
        <span>n/m: bazı kullanıcılar görür (rol özeti)</span>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-md border bg-white">
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30 min-w-[260px] border-b border-r bg-vw-light px-3 py-2 text-left">
                {roleSummary ? "Rol" : "Kullanıcı"}
              </th>
              {shownGroups.map((g) => (
                <th key={g.label} colSpan={g.items.length}
                  className="sticky top-0 z-20 border-b border-r bg-vw-primary/60 px-2 py-1.5 text-center font-semibold">
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c) => (
                <th key={c.group + c.href}
                  className="sticky top-[33px] z-20 whitespace-nowrap border-b border-r bg-vw-light px-2 py-1.5 text-xs font-medium">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-muted/30">
                <td className="sticky left-0 z-10 border-b border-r bg-white px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{r.name}</span>
                    {r.station && <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">İstasyon</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {roleSummary ? r.sub : `${r.role} · ${r.sub}`}
                  </div>
                  <div className="max-w-[240px] truncate text-[11px] text-muted-foreground" title={r.modules}>
                    Modül: {r.modules}
                  </div>
                </td>
                {columns.map((c) => {
                  const sees = r.cells.has(c.href);
                  const part = r.partial.get(c.href);
                  return (
                    <td key={c.group + c.href} className="border-b border-r px-2 py-1.5 text-center">
                      {sees ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : part ? (
                        <span className="text-xs font-medium text-amber-700">{part}/{r.count}</span>
                      ) : r.locked && c.stationBlocked ? (
                        <Lock className="mx-auto h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">Kullanıcı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {roleSummary ? `${rows.length} rol` : `${rows.length} kullanıcı`} · {columns.length} sayfa
      </p>
    </div>
  );
}
