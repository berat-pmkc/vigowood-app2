"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Clock, GripVertical, History, Link2, PauseCircle, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MiktarHizliInput } from "@/components/shared/miktar-hizli-input";
import { UrunStokCombobox } from "@/components/shared/urun-stok-combobox";
import { TALIMAT_ISTASYON_LABEL } from "@/lib/talimat/constants";
import { ilerlemeYuzdesi } from "@/lib/talimat/helpers";
import type { SatirKaydetGirdi, TalimatSatir, UrunStokSecenek, ZamanliIslem } from "@/lib/talimat/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { PlakaSecici } from "./plaka-secici";
import { zamanliOzet } from "./zamanli-liste";

export interface SatirIslemleri {
  kaydet: (satirId: string, alanlar: Partial<SatirKaydetGirdi>) => void;
  pasifEt: (s: TalimatSatir) => void;
  pasifKaldir: (s: TalimatSatir) => void;
  /** Tamamlanan satırı tekrar aktif et (diyalog açar) */
  yenidenAktif: (s: TalimatSatir) => void;
  sil: (s: TalimatSatir) => void;
}

interface Props {
  s: TalimatSatir;
  editable: boolean;
  /** Seçilemeyen SKU'lar (komşu satırlarda kullanılan) */
  /** Görünen sıra (yalnız aktif bloktaki satırlarda; diğerlerinde null) */
  siraNo: number | null;
  depoStoklari: UrunStokSecenek["depo_stoklari"] | undefined;
  islem: SatirIslemleri;
  sirali: boolean;
  /** Derin bağlantıyla gelinen satır: sarı vurgu (3 sn) */
  parlak?: boolean;
  /** Satır seçili mi (çoklu seçim; başka hatta kopyalama) */
  secili?: boolean;
  onSecToggle?: () => void;
  /** Hat rengi (tabletle aynı): sol kalın şerit + çok açık zemin */
  hatRenk?: string;
  hatRenkAcik?: string;
  /** Bu satırı etkileyecek bekleyen zamanlı işlemler (satır / hat / liste kapsamlı) */
  zamanli?: ZamanliIslem[];
  /** Hatta art arda verilemeyen (komşu satırlardaki) SKU'lar: sku -> neden */
  engelliSkular?: Record<string, string>;
}

export function SatirRow({ s, editable, siraNo, depoStoklari, islem, sirali, parlak, secili, onSecToggle, hatRenk, hatRenkAcik, zamanli, engelliSkular }: Props) {
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Zemin tonu yalnız normal satırda (pasif/seçili/parlak/sürükleme durumları kendi rengini korur)
        ...(hatRenkAcik && !pasif && !secili && !parlak && !isDragging ? { backgroundColor: hatRenkAcik } : {}),
      }}
      className={cn(
        "border-b align-top text-sm",
        pasif && "bg-[#eceff1]/70 text-[#78909c]",
        secili && "bg-[#cdbd9d]/25",
        tamam && "bg-[#e3ecd2]/40 text-vw-dark/80",
        s.kirmizi && !pasif && "text-[#c0424f]",
        isDragging && "relative z-10 bg-vw-light shadow-lg",
        parlak && "animate-pulse bg-[#fff59d] opacity-100",
      )}
    >
      {/* Sıra + tutamaç */}
      <td className="w-24 px-1 py-2" style={hatRenk ? { boxShadow: `inset 5px 0 0 ${hatRenk}` } : undefined}>
        <div className="flex items-center gap-0.5">
          {editable && onSecToggle && (
            <Checkbox
              checked={!!secili}
              onCheckedChange={onSecToggle}
              aria-label="Satırı seç"
              className="mr-1 h-5 w-5 bg-white"
            />
          )}
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={!editable || !sirali}
            aria-label="Sırayı değiştir"
            title={sirali ? "Sürükle: sırayı değiştir / başka hattın başlığına bırak: kopyala" : "Yalnız aktif satırlar sıralanır"}
            className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded text-vw-side hover:bg-muted active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">{siraNo ?? "–"}</span>
        </div>
      </td>

      {/* İstasyon */}
      <td className="w-24 px-2 py-2.5">
        <span className="text-xs text-muted-foreground">{TALIMAT_ISTASYON_LABEL[s.etkin_istasyon]}</span>
      </td>

      {/* Ürün kodu (+ kesimde plaka) */}
      <td className="w-56 min-w-[200px] px-1 py-2">
        <UrunStokCombobox
          compact
          value={s.sku}
          disabled={!editable}
          onChange={(u) => islem.kaydet(s.satir_id, { sku: u.sku, ...(s.plaka_id ? { plaka_id: null } : {}) })}
          placeholder="Ürün seç..."
          disabledSkus={engelliSkular}
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
        {tamam ? (
          <div className="px-1 text-sm tabular-nums">
            <span className="font-semibold">{formatNumber(s.uretilen)}</span> / {formatNumber(s.istenen_miktar)}
            {s.istenen_miktar != null && s.uretilen > s.istenen_miktar && (
              <span className="ml-1 text-xs font-semibold text-[#b8650c]">(+{formatNumber(s.uretilen - s.istenen_miktar)} fazla)</span>
            )}
          </div>
        ) : (
          <MiktarHizliInput
            value={s.istenen_miktar}
            disabled={!editable}
            onCommit={(v) => islem.kaydet(s.satir_id, { istenen_miktar: v })}
          />
        )}
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
            <Badge className="border-0 bg-[#3caa35] text-white">Tamamlandı</Badge>
          ) : (
            <Badge className="border-0 bg-[#f0ede1] text-vw-deep">Aktif</Badge>
          )}
          {zamanli && zamanli.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1 rounded bg-[#e8eaf6] px-1.5 py-0.5 text-[11px] font-medium text-[#283593]">
                  <Clock className="h-3 w-3" /> {zamanli.length > 1 ? `${zamanli.length} zamanlı` : zamanliOzet(zamanli[0])}
                </span>
              </TooltipTrigger>
              <TooltipContent>{zamanli.map((z) => zamanliOzet(z)).join(" | ")}</TooltipContent>
            </Tooltip>
          )}
          {s.degisti && <span className="text-[11px] font-semibold text-[#c0424f]">Değişti</span>}
          {s.onay_bekliyor && <span className="text-[11px] font-semibold text-[#c0424f]">Onay bekliyor</span>}
        </div>
      </td>

      {/* İşlemler */}
      <td className={cn("px-1 py-2", tamam ? "w-36" : "w-24")}>
        {editable && tamam && (
          <button
            type="button"
            onClick={() => islem.yenidenAktif(s)}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md bg-[#3caa35] px-2.5 text-xs font-semibold text-white hover:bg-[#2f8a2a]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Tekrar aktif et
          </button>
        )}
        {editable && !tamam && (
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
