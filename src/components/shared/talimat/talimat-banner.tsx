"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/supabase/schema";
import { tabletBildirimleriGetir } from "@/lib/talimat/actions";
import { tabletKontekstGetir } from "@/lib/talimat/tablet-actions";
import type { TalimatBildirim } from "@/lib/talimat/types";
import { bipDizisi, sesHazirla } from "./ses";

const SES_ANAHTAR = "talimat_ses_calinan";

function calinanlariOku(): Set<string> {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(SES_ANAHTAR) ?? "[]"));
  } catch {
    return new Set();
  }
}
function calinanlariYaz(s: Set<string>): void {
  try {
    sessionStorage.setItem(SES_ANAHTAR, JSON.stringify([...s].slice(-100)));
  } catch {
    /* sessionStorage kapalı olabilir */
  }
}

/**
 * Ortak istasyon hesaplarında (tablet) iş talimatı değişiklik banner'ı.
 * Seçili operatör veya istasyon personeli için kind='talimat_degisiklik' bildirimini Realtime ile dinler;
 * geri çekilenleri (geri_cekildi_at dolu) göstermez. Hatırlatma (cron, 10 dk) yeni satır yazar:
 * yeni notif_id = banner/ses yeniden tetiklenir.
 */
export function TalimatBanner() {
  const [aktif, setAktif] = useState(false);
  const [liste, setListe] = useState<TalimatBildirim[]>([]);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const bekleyenSes = useRef(false);

  const sesDene = useCallback(() => {
    if (!bekleyenSes.current) return;
    if (bipDizisi()) bekleyenSes.current = false;
  }, []);

  const yukle = useCallback(async () => {
    const r = await tabletBildirimleriGetir(undefined, { istasyonKapsami: true });
    if (!r.success) return;
    const yeni = r.data.filter((n) => !n.geri_cekildi_at);
    setListe(yeni);
    const calinan = calinanlariOku();
    const calinacak = yeni.filter((n) => n.sesli && !calinan.has(n.notif_id));
    if (calinacak.length > 0) {
      for (const n of calinacak) calinan.add(n.notif_id);
      calinanlariYaz(calinan);
      bekleyenSes.current = true;
      sesDene();
    }
  }, [sesDene]);

  // Bağlam: yalnız ortak istasyon hesaplarında aktif
  useEffect(() => {
    sesHazirla();
    let iptal = false;
    tabletKontekstGetir().then((r) => {
      if (iptal || !r.success) return;
      if (r.data.istasyonHesabi) {
        setOperatorId(r.data.operatorId);
        setAktif(true);
      }
    });
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    if (!aktif) return;
    void yukle();

    const supabase = createClient();
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const tetikle = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => void yukle(), 300);
    };
    const filter = "kind=eq.talimat_degisiklik";
    const kanal = supabase
      .channel("talimat-banner")
      .on("postgres_changes", { event: "INSERT", schema: DB_SCHEMA, table: "notifications", filter }, tetikle)
      .on("postgres_changes", { event: "UPDATE", schema: DB_SCHEMA, table: "notifications", filter }, tetikle)
      .subscribe();

    // Yedek: Realtime kopsa da en geç 1 dk içinde yakala
    const yoklama = setInterval(() => void yukle(), 60_000);
    // Ses kilidi ilk dokunuşta açılınca bekleyen sesi çal
    const dokunus = () => setTimeout(sesDene, 80);
    window.addEventListener("pointerdown", dokunus);

    return () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      clearInterval(yoklama);
      window.removeEventListener("pointerdown", dokunus);
      supabase.removeChannel(kanal);
    };
  }, [aktif, yukle, sesDene]);

  if (!aktif || liste.length === 0) return null;

  // Seçili operatöre ait olan öncelikli
  const hedef = liste.find((n) => n.target_user === operatorId) ?? liste[0];
  const personelId = hedef.payload?.personel_id ?? hedef.target_user ?? "";
  const baskasi = operatorId && personelId && personelId !== operatorId ? hedef.payload?.personel_adi : null;

  return (
    <Link
      href={`/uretim/talimatlarim${personelId ? `?personel=${encodeURIComponent(personelId)}` : ""}`}
      className="flex min-h-16 w-full items-center gap-4 bg-[#f28a19] px-5 py-3 text-white shadow-md animate-pulse hover:animate-none active:bg-[#d97a10]"
      role="alert"
    >
      <BellRing className="size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight sm:text-xl">
          {baskasi ? `${baskasi} için iş talimatlarında değişiklik var` : "İş talimatlarınızda değişiklik var"}
        </p>
        {liste.length > 1 && <p className="text-sm opacity-90">{liste.length} bekleyen bildirim</p>}
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-4 py-3 text-base font-bold text-[#c26a0c]">
        Değişiklikleri gör
        <ChevronRight className="size-5" />
      </span>
    </Link>
  );
}
