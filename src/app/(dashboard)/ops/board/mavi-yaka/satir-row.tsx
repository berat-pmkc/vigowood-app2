"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical, History, Link2, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MiktarHizliInput } from "@/components/shared/miktar-hizli-input";
import { UrunStokCombobox } from "@/components/shared/urun-stok-combobox";
import { TALIMAT_ISTASYON_LABEL, TALIMAT_ISTASYONLAR } from "@/lib/talimat/constants";
import { ilerlemeYuzdesi } from "@/lib/talimat/helpers";
import type { SatirKaydetGirdi, TalimatSatir, UrunStokSecenek } from "@/lib/talimat/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { PlakaSecici } from "./plaka-secici";

export interface SatirIslemleri {
  kaydet: (satirId: string, alanlar: Partial<SatirKaydetGirdi>) => void;
  pasifEt: (s: TalimatSatir) => void;
  pasifKaldir: (s: TalimatSatir) => void;
  sil: (s: TalimatSatir) => void;
}

interface Props {
  s: TalimatSatir;
  editable: boolean;
  /** Seçilemeyen SKU'lar (komşu satırlarda kullanılan) */
  engelli: Record<string, string>;
  depoStoklari: UrunStokSecenek["depo_stoklari"] | undefined;
  islem: SatirIslemleri;
  sirali: boolean;
  /** Derin bağlantıyla gelinen satır: sarı vurgu (3 sn) */
  parlak?: boolean;
}

export function SatirRow({ s, editable, engelli, depoStoklari, islem, sirali, parlak }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.satir_id,
    disabled: !editable || !sirali,
  });

  const pasif = s.etkin_pasif;
  const tamam = !pasif && s.etkin_durum === "tamamlandi";
  const yuzde = ilerlemeYuzdesi(s);
  const fark = s.fark;

  return (
    <tr
      ref={setNodeRef}
      id={`satir-${s.satir_id}`}
      data-satir-id={s.satir_id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-b align-top text-sm",
        pasif && "bg-[#eceff1]/70 text-[#78909c]",
        tamam && "opacity-50",
        s.kirmizi && !pasif && "text-[#c0424f]",
        isDragging && "relative z-10 bg-vw-light shadow-lg",
        parlak && "animate-pulse bg-[#fff59d] opacity-100",
      )}
    >
      {/* Sıra + tutamaç */}
      <td className="w-14 px-1 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={!editable || !sirali}
            aria-label="Sırayı değiştir"
            title={sirali ? "Sürükleyip sırayı değiştir" : "Sıralama için filtreleri temizleyin"}
            className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded text-vw-side hover:bg-muted active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">{s.sira}</span>
        </div>
      </td>

      {/* İstasyon */}
      <td className="w-28 px-1 py-2">
        <select
          value={s.istasyon ?? ""}
          disabled={!editable}
          onChange={(e) => islem.kaydet(s.satir_id, { istasyon: (e.target.value || null) as SatirKaydetGirdi["istasyon"] })}
          className="h-8 w-full rounded-md border border-input bg-transparent px-1 text-xs disabled:opacity-60"
        >
          <option value="">{TALIMAT_ISTASYON_LABEL[s.etkin_istasyon]} (oto)</option>
          {TALIMAT_ISTASYONLAR.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </td>

      {/* Ürün kodu (+ kesimde plaka) */}
      <td className="w-56 min-w-[200px] px-1 py-2">
        <UrunStokCombobox
          compact
          value={s.sku}
          disabled={!editable}
          engelli={engelli}
          onChange={(u) => islem.kaydet(s.satir_id, { sku: u.sku, ...(s.plaka_id ? { plaka_id: null } : {}) })}
          placeholder="Ürün seç..."
        />
        {(s.istasyon === "kesim" || s.plaka_id) && (
          <PlakaSecici
            sku={s.sku}
            plakaId={s.plaka_id}
            plakaAdi={s.plaka_adi}
            disabled={!editable}
            onSelect={(p) => islem.kaydet(s.satir_id, { plaka_id: p })}
          />
        )}
      </td>

      {/* Ürün adı */}
      <td className="min-w-[160px] px-2 py-2.5">
        <span className="line-clamp-2">{s.urun_adi ?? "—"}</span>
      </td>

      {/* Güncel stok */}
      <td className="w-20 px-2 py-2.5 text-right tabular-nums">
        {s.sku ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-vw-side">{formatNumber(s.toplam_stok)}</span>
            </TooltipTrigger>
            <TooltipContent side="left">
              {depoStoklari && depoStoklari.length > 0 ? (
                <ul className="space-y-0.5">
                  {depoStoklari.map((d, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{d.depo_adi ?? "Depo"}</span>
                      <span className="font-medium">{formatNumber(d.miktar)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                "Depo kırılımı yok"
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          "—"
        )}
      </td>

      {/* Üretim miktarı */}
      <td className="w-28 px-2 py-2.5">
        <div className="tabular-nums">{formatNumber(s.uretilen)}</div>
        {yuzde != null && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${yuzde}%`, background: yuzde >= 100 ? "#3caa35" : "#f28a19" }}
            />
          </div>
        )}
        {s.etkin_istasyon === "montaj" && s.paketlemeye_hazir != null && s.paketlemeye_hazir > 0 && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">Paketlemeye hazır: {s.paketlemeye_hazir}</div>
        )}
      </td>

      {/* İstenen miktar */}
      <td className="w-36 px-1 py-2">
        <MiktarHizliInput
          value={s.istenen_miktar}
          disabled={!editable}
          onCommit={(v) => islem.kaydet(s.satir_id, { istenen_miktar: v })}
        />
      </td>

      {/* Fark */}
      <td className="w-16 px-2 py-2.5 text-right tabular-nums">
        {fark == null ? (
          "—"
        ) : (
          <span className={cn("font-medium", !pasif && !s.kirmizi && (fark <= 0 ? "text-[#2f7d66]" : "text-[#b8650c]"))}>
            {formatNumber(fark)}
          </span>
        )}
      </td>

      {/* Not */}
      <td className="min-w-[150px] px-1 py-2">
        <NotInput value={s.not_text ?? ""} disabled={!editable} onCommit={(v) => islem.kaydet(s.satir_id, { not_text: v || null })} />
        {s.talep_id && (
          <Link
            href={`/talepler?talep=${s.talep_id}`}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#3368b1] hover:underline"
          >
            <Link2 className="h-3 w-3" /> Talebi gör
          </Link>
        )}
        {s.talep_id && s.kirmizi && (
          <Link
            href={`/talepler?talep=${s.talep_id}&degisiklik=1`}
            className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#c0424f] hover:underline"
          >
            <History className="h-3 w-3" /> Değişikliği gör
          </Link>
        )}
      </td>

      {/* Durum */}
      <td className="w-32 px-2 py-2.5">
        <div className="flex flex-col items-start gap-1">
          {pasif ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="cursor-help border-0 bg-[#cfd8dc] text-[#546e7a]">Pasif</Badge>
              </TooltipTrigger>
              <TooltipContent>
                {s.pasif_neden || "Neden belirtilmedi"}
                {s.pasif_baslangic || s.pasif_until
                  ? ` · ${formatDate(s.pasif_baslangic)} – ${s.pasif_until ? formatDate(s.pasif_until) : "süresiz"}`
                  : ""}
              </TooltipContent>
            </Tooltip>
          ) : s.etkin_durum === "tamamlandi" ? (
            <Badge className="border-0 bg-[#e3ecd2] text-[#3caa35]">Tamamlandı</Badge>
          ) : (
            <Badge className="border-0 bg-[#f0ede1] text-vw-deep">Aktif</Badge>
          )}
          {s.degisti && <span className="text-[11px] font-semibold text-[#c0424f]">Değişti</span>}
          {s.onay_bekliyor && <span className="text-[11px] font-semibold text-[#c0424f]">Onay bekliyor</span>}
        </div>
      </td>

      {/* İşlemler */}
      <td className="w-24 px-1 py-2">
        {editable && (
          <div className="flex items-center gap-0.5">
            {s.durum === "pasif" ? (
              <button
                type="button"
                title="Pasifi kaldır"
                onClick={() => islem.pasifKaldir(s)}
                className="rounded p-1.5 text-[#2f7d66] hover:bg-muted"
              >
                <PlayCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                title="Pasif et"
                onClick={() => islem.pasifEt(s)}
                className="rounded p-1.5 text-vw-deep hover:bg-muted"
              >
                <PauseCircle className="h-4 w-4" />
              </button>
            )}
            <button type="button" title="Sil" onClick={() => islem.sil(s)} className="rounded p-1.5 text-[#c0424f] hover:bg-muted">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NotInput({ value, disabled, onCommit }: { value: string; disabled?: boolean; onCommit: (v: string) => void }) {
  return (
    <Input
      key={value}
      defaultValue={value}
      disabled={disabled}
      placeholder="Not"
      maxLength={1000}
      className="h-8 px-2 text-xs"
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== value.trim()) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
