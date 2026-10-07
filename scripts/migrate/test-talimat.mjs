// Smoke test for the is talimati + talep RPCs on a migrated schema. Everything runs inside one
// transaction that is always rolled back (the DO block raises at the end).
// Usage: node scripts/migrate/test-talimat.mjs --schema vigowood_prova [--planner VW006] [--office VW010]
import { parseArgs, guardSchema, context, log, ql, qi } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const ctx = context();
const S = qi(schema);

const plannerId = args.planner || 'VW006';
const officeId = args.office || 'VW010';
const office2Id = args.office2 || 'VW005';
const stationId = args.station || 'VW014'; // montaj@vigowood.com

async function claimsOf(uid) {
  const [u] = await ctx.tgt(
    `select auth_id::text, email from ${S}.users where user_id = ${ql(uid)} and auth_id is not null`, { readOnly: true });
  if (!u) throw new Error(`${uid} has no auth_id`);
  return JSON.stringify({ sub: u.auth_id, role: 'authenticated', email: u.email });
}
const CL = {
  planner: await claimsOf(plannerId),
  office: await claimsOf(officeId),
  office2: await claimsOf(office2Id),
  station: await claimsOf(stationId),
};
const as = (who) =>
  `execute 'reset role'; perform set_config('request.jwt.claims', ${ql(CL[who])}, true); execute 'set local role authenticated';`;
const su = `execute 'reset role';`;

const step = (name, who, body) => `
  begin
    ${who ? as(who) : su}
    ${body}
    out := out || 'OK ${name.split(' ')[0]} ';
  exception when others then
    out := out || E'\nFAIL  ${name}: ' || regexp_replace(sqlerrm, '[^ -~]', '?', 'g') || E'\\n';
  end;`;
const expectErr = (name, who, body, like) => `
  begin
    ${who ? as(who) : su}
    ${body}
    raise exception 'NO_ERROR_RAISED';
  exception when others then
    if sqlerrm like ${ql(like + '%')} then
      out := out || 'OK ${name.split(' ')[0]} ';
    else
      out := out || E'\nFAIL  ${name}: beklenen ${like}, gelen: ' || regexp_replace(sqlerrm, '[^ -~]', '?', 'g') || E'\\n';
    end if;
  end;`;
const assert = (cond, msg) => `if not (${cond}) then raise exception 'ASSERT: ${msg}'; end if;`;
const sat = (id) => `(select sira from ${S}.talimat_satirlar where satir_id = ${id})`;
const kaydet = (obj) => `${S}.talimat_satir_kaydet(${obj})`;
const note = (txt) => `out := out || '      ${txt}' || E'\\n';`;

const steps = [];

// ---------------- 1) plan + satirlar ----------------
steps.push(step('1.1 plan getir/olustur', 'planner', `
  v_plan := ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun());
  select count(*) into n from ${S}.talimat_satirlar where plan_id = v_plan;
  out := out || '      plan=' || v_plan || ' mevcut_satir=' || n || ' durum=' || (select durum from ${S}.talimat_planlar where plan_id=v_plan) || E'\\n';
  ${assert(`v_plan = ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun())`, 'idempotent degil')}
`));
steps.push(step('1.2 uc satir ekle (LS031,LS051,MKOS41)', 'planner', `
  s1 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','LS031','istenen_miktar',10,'not_text','n1')`)};
  s2 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','LS051','istenen_miktar',20)`)};
  s3 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','MKOS41','istenen_miktar',30)`)};
  ${assert(`${sat('s1')}=1 and ${sat('s2')}=2 and ${sat('s3')}=3`, 'sira 1,2,3 degil')}
`));
steps.push(expectErr('1.3 ardisik ayni sku (MKOS41 ardindan MKOS41)', 'planner',
  `perform ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','MKOS41')`)};`, 'ARDISIK_SKU'));
steps.push(step('1.4 ardisik olmayan tekrar (LS031 sona) serbest', 'planner', `
  s4 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','LS031')`)};
  ${assert(`${sat('s4')}=4`, 's4 sira 4 degil')}
`));
steps.push(expectErr('1.5 dolu sirada kaydir olmadan', 'planner',
  `perform ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku',other,'sira',2)`)};`, 'SIRA_DOLU'));
steps.push(step('1.6 dolu sirada kaydir=true araya girer', 'planner', `
  s5 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku',other,'sira',2,'kaydir',true)`)};
  ${assert(`${sat('s5')}=2 and ${sat('s1')}=1 and ${sat('s2')}=3 and ${sat('s3')}=4 and ${sat('s4')}=5`, 'kaydirma hatali')}
  select count(distinct sira), count(*) into n, m from ${S}.talimat_satirlar where plan_id=v_plan and personel_id=w1;
  ${assert('n=m and m=5', 'sira tekil degil')}
`));
steps.push(step('1.7 satir_sirala ters sirala', 'planner', `
  perform ${S}.talimat_satir_sirala(v_plan, w1, array[s4,s3,s2,s5,s1]);
  ${assert(`${sat('s4')}=1 and ${sat('s3')}=2 and ${sat('s2')}=3 and ${sat('s5')}=4 and ${sat('s1')}=5`, 'siralama hatali')}
`));
steps.push(expectErr('1.8 satir_sirala ardisik ihlali', 'planner',
  `perform ${S}.talimat_satir_sirala(v_plan, w1, array[s1,s4,s3,s2,s5]);`, 'ARDISIK_SKU'));
steps.push(expectErr('1.8b satir_sirala eksik liste', 'planner',
  `perform ${S}.talimat_satir_sirala(v_plan, w1, array[s1,s4]);`, 'Sıralama listesi'));
steps.push(step('1.9 satir_sil + sira sikistirma', 'planner', `
  perform ${S}.talimat_satir_sil(s5);
  select count(distinct sira), count(*), max(sira) into n, m, k from ${S}.talimat_satirlar where plan_id=v_plan and personel_id=w1;
  ${assert('n=4 and m=4 and k=4', 'sira sikismadi')}
`));
steps.push(step('1.10 ayni sku baska personele (LS031 -> w2)', 'planner', `
  s6 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w2,'sku','LS031','istenen_miktar',5)`)};
  s7 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w2,'sku','LS051','istenen_miktar',5)`)};
`));
steps.push(step('1.11 plaka satiri: sku otomatik + etkin_istasyon=kesim', 'planner', `
  select plaka_id into plk from ${S}.plakalar where sku is not null and cardinality(sku)=1 limit 1;
  if plk is null then out := out || '      (tek sku li plaka yok, atlandi)' || E'\\n';
  else
    s8 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w4,'plaka_id',plk,'istenen_miktar',3)`)};
    select sku, etkin_istasyon into tmp, tmp2 from ${S}.talimat_satir_etkin where satir_id=s8;
    ${assert(`tmp is not null and tmp2='kesim'`, 'sku/istasyon turetilemedi')}
    out := out || '      plaka=' || plk || ' sku=' || tmp || E'\\n';
  end if;
`));
steps.push(step('1.12 dogrudan yazma ardisik tetikleyici (deferred)', 'planner', `
  insert into ${S}.talimat_satirlar (plan_id, personel_id, sira, sku) values (v_plan, w3, 1, 'LS031'), (v_plan, w3, 2, 'LS031');
  execute 'set constraints all immediate';
`));
// 1.12 must fail: invert result
steps[steps.length - 1] = expectErr('1.12 dogrudan yazma ardisik tetikleyici (deferred)', 'planner', `
  insert into ${S}.talimat_satirlar (plan_id, personel_id, sira, sku) values (v_plan, w3, 1, 'LS031'), (v_plan, w3, 2, 'LS031');
  execute 'set constraints all immediate';`, 'ARDISIK_SKU');
steps.push(expectErr('1.13 gecersiz personel (Yonetici)', 'planner',
  `perform ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id','VW001','sku','LS031')`)};`, 'Geçersiz personel'));

steps.push(step('1.14 bos satir (ürünsüz personel): ekle, doldur, tablette yok, ozette sayilmaz', 'planner', `
  select satir_sayisi, personel_sayisi into m, k from ${S}.talimat_plan_ozet where plan_id=v_plan;
  s9 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5)`)};
  ${assert(`(select sku is null and plaka_id is null and sira=1 from ${S}.talimat_satirlar where satir_id=s9)`, 'bos satir olusmadi')}
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5)`)};
  ${assert(`${sat('s10')}=2`, 'ikinci bos satir sira 2 degil')}
  -- tablet sorgusu (getTabletListe) sku/plaka ister
  ${assert(`not exists (select 1 from ${S}.talimat_satir_ilerleme where plan_id=v_plan and personel_id=w5 and (sku is not null or plaka_id is not null))`, 'bos satir tablet filtresinden gecti')}
  ${assert(`(select satir_sayisi=m and personel_sayisi=k from ${S}.talimat_plan_ozet where plan_id=v_plan)`, 'bos satir ozette sayildi')}
  ${assert(`(select uretilen=0 and urun_adi is null from ${S}.talimat_satir_ilerleme where satir_id=s9)`, 'bos satir ilerleme')}
  perform ${kaydet(`jsonb_build_object('satir_id',s9,'sku','LS031','istenen_miktar',4)`)};
  ${assert(`(select sku='LS031' from ${S}.talimat_satirlar where satir_id=s9)`, 'sku doldurulamadi')}
  ${assert(`(select satir_sayisi=m+1 and personel_sayisi=k+1 from ${S}.talimat_plan_ozet where plan_id=v_plan)`, 'dolu satir ozete girmedi')}
  -- ardisik kural bos satiri yok sayar: LS031, bos, LS031 hatali olmali
  perform ${kaydet(`jsonb_build_object('satir_id',s10,'sku','LS051')`)};
  perform ${kaydet(`jsonb_build_object('satir_id',s10,'sku',null)`)};
  begin
    perform ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5,'sku','LS031')`)};
    raise exception 'NO_ERROR_RAISED';
  exception when others then
    if sqlerrm not like 'ARDISIK_SKU%' then raise; end if;
  end;
  perform ${S}.talimat_satir_sil(s10);
  perform ${S}.talimat_satir_sil(s9);
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan and personel_id=w5)`, 'w5 satirlari silinmedi')}
`));

// ---------------- 2) goruntuler ----------------
steps.push(step('2.1 ilerleme/ozet/etkin/katki goruntuleri', 'planner', `
  select count(*) into n from ${S}.talimat_satir_ilerleme where plan_id=v_plan;
  select count(*) into m from ${S}.talimat_satirlar where plan_id=v_plan;
  ${assert('n=m and n>0', 'ilerleme satir sayisi uyusmuyor')}
  select satir_sayisi, personel_sayisi into n, k from ${S}.talimat_plan_ozet where plan_id=v_plan;
  ${assert('n=m', 'plan_ozet satir_sayisi')}
  select count(*) into k from ${S}.talimat_satir_etkin where plan_id=v_plan;
  select count(*) into k from ${S}.talimat_satir_katki where satir_id=s1;
  select count(*) into k from ${S}.talep_durum;
  out := out || '      ilerleme=' || (select count(*) from ${S}.talimat_satir_ilerleme where plan_id=v_plan) || ' satir; ilk: ' ||
    (select urun_adi || '/' || etkin_durum || '/uretilen=' || uretilen from ${S}.talimat_satir_ilerleme where satir_id=s1) || E'\\n';
`));

// ---------------- 3) yayin / bildirim / onay ----------------
steps.push(step('3.1 ilk yayin bildirimli (herkes)', 'planner', `
  j := ${S}.talimat_yayinla(v_plan, true, null, true, 'degisenler');
  y1 := (j->>'yayin_id')::uuid;
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'ilk_yayin')::boolean and (j->>'durum')='gonderildi'`, 'ilk yayin gonderildi degil')}
  ${su}
  select count(*) into n from ${S}.notifications where yayin_id=y1 and kind='talimat_degisiklik';
  select count(distinct personel_id) into m from ${S}.talimat_yayin_hedefler where yayin_id=y1;
  ${assert('n=m and n>=2', 'bildirim sayisi hedeflerle uyusmuyor')}
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan and (degisti or onay_bekliyor))`, 'ilk yayinda bayrak kalmis')}
  out := out || '      bildirim=' || n || E'\\n';
`));
steps.push(expectErr('3.2 degisiklik yokken yayin', 'planner',
  `perform ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler');`, 'Yayınlanacak değişiklik yok'));
steps.push(step('3.3 istasyon hesabi onayla + yayin_ozet', 'station', `
  n := ${S}.talimat_onayla(y1, w1);
  ${su}
  select hedef_sayisi, onay_sayisi, onaylamayan_sayisi into n, m, k from ${S}.talimat_yayin_ozet where yayin_id=y1;
  ${assert('m=1 and k=n-1', 'yayin_ozet sayilari')}
  ${assert(`(select status from ${S}.notifications where yayin_id=y1 and target_user=w1 and kind='talimat_degisiklik') = 'Okundu'`, 'bildirim okundu degil')}
  ${assert(`exists (select 1 from ${S}.notification_reads r join ${S}.notifications nn on nn.notif_id=r.notif_id where nn.yayin_id=y1 and r.user_id=w1)`, 'notification_reads yok')}
  out := out || '      hedef=' || n || ' onay=' || m || ' onaylamayan=' || k || E'\\n';
`));
steps.push(expectErr('3.3b hedef olmayan personel onayi', 'station',
  `perform ${S}.talimat_onayla(y1, 'VW060');`, 'Bu personel yayının hedefi değil'));
steps.push(step('3.4 degisiklik + bildirimli yayin (degisenler)', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s1,'not_text','yeni not','istenen_miktar',12)`)};
  ${assert(`(select degisti from ${S}.talimat_satirlar where satir_id=s1)`, 'degisti isaretlenmedi')}
  j := ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler');
  y2 := (j->>'yayin_id')::uuid;
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'personel_sayisi')::int=1 and (j->>'satir_sayisi')::int=1`, 'sadece w1/1 satir beklenirdi')}
  ${assert(`(select onay_bekliyor and not degisti from ${S}.talimat_satirlar where satir_id=s1)`, 'onay_bekliyor/degisti hatali')}
  ${assert(`(select kirmizi from ${S}.talimat_satir_ilerleme where satir_id=s1)`, 'kirmizi false')}
`));
steps.push(step('3.5 onayla -> onay_bekliyor kalkar, yayin tamamlandi', 'station', `
  n := ${S}.talimat_onayla(y2, w1);
  ${su}
  ${assert(`not (select onay_bekliyor from ${S}.talimat_satirlar where satir_id=s1)`, 'onay_bekliyor kalkmadi')}
  ${assert(`(select durum from ${S}.talimat_yayinlar where yayin_id=y2)='tamamlandi'`, 'yayin tamamlandi degil')}
`));
steps.push(step('3.6 bildirim_durdur (geri cekmeden)', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s3,'istenen_miktar',31)`)};
  j := ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler'); y3 := (j->>'yayin_id')::uuid;
  perform ${S}.talimat_bildirim_durdur(y3, false);
  ${assert(`(select durum from ${S}.talimat_yayinlar where yayin_id=y3)='durduruldu'`, 'durduruldu degil')}
  out := out || '      durdur sonrasi onay_bekliyor(s3)=' || (select onay_bekliyor from ${S}.talimat_satirlar where satir_id=s3) || E'\\n';
`));
steps.push(step('3.7 bildirim_durdur geri_cek=true', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s2,'istenen_miktar',21)`)};
  j := ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler'); y4 := (j->>'yayin_id')::uuid;
  ${assert(`(select onay_bekliyor from ${S}.talimat_satirlar where satir_id=s2)`, 'onay_bekliyor yok')}
  perform ${S}.talimat_bildirim_durdur(y4, true);
  ${su}
  ${assert(`(select durum from ${S}.talimat_yayinlar where yayin_id=y4)='geri_cekildi'`, 'geri_cekildi degil')}
  ${assert(`not (select onay_bekliyor from ${S}.talimat_satirlar where satir_id=s2)`, 'onay_bekliyor kalkmadi')}
  ${assert(`not exists (select 1 from ${S}.notifications where yayin_id=y4 and geri_cekildi_at is null)`, 'bildirim geri cekilmedi')}
`));
steps.push(expectErr('3.8 sona ermis yayini durdur', 'planner',
  `perform ${S}.talimat_bildirim_durdur(y4, false);`, 'Bu yayının bildirimi zaten sona ermiş'));
steps.push(step('3.9 bildirimsiz yayin', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s4,'not_text','bildirimsiz not')`)};
  j := ${S}.talimat_yayinla(v_plan, false, null, false, 'degisenler');
  ${assert(`(j->>'durum')='bildirimsiz' and not (j->>'bildirim_gonder')::boolean`, 'bildirimsiz degil')}
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan and (degisti or onay_bekliyor) and satir_id=s4)`, 's4 bayrak')}
`));
steps.push(step('3.10 talimat_tablet_plan(w1) = plan', 'station', `
  ${assert(`${S}.talimat_tablet_plan(w1) = v_plan`, 'tablet plan farkli')}
`));

steps.push(step('3.11 yayinda bos satir: yayin/bildirim/snapshot disinda', 'planner', `
  select count(*) into n from ${S}.notifications where kind='talimat_degisiklik';
  s9 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5)`)};
  ${assert(`not (select degisti from ${S}.talimat_satirlar where satir_id=s9)`, 'bos satir degisti isaretlendi')}
  begin
    perform ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler');
    raise exception 'NO_ERROR_RAISED';
  exception when others then
    if sqlerrm not like 'Yayınlanacak değişiklik yok%' then raise; end if;
  end;
  -- doldurunca degisen olur, yayina girer
  perform ${kaydet(`jsonb_build_object('satir_id',s9,'sku','LS031')`)};
  j := ${S}.talimat_yayinla(v_plan, false, null, false, 'degisenler');
  ${assert(`(j->>'personel_sayisi')::int=1 and (j->>'satir_sayisi')::int=1`, 'doldurulan satir yayina girmedi')}
  -- bos satir silmek yayin degisikligi degil
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5)`)};
  perform ${S}.talimat_satir_sil(s10);
  ${assert(`not (select w5 = any (degisen_personeller) from ${S}.talimat_planlar where plan_id=v_plan)`, 'bos satir silme degisen isaretledi')}
  perform ${S}.talimat_satir_sil(s9);
  j := ${S}.talimat_yayinla(v_plan, false, null, false, 'degisenler');
  ${su}
  ${assert(`(select count(*) from ${S}.notifications where kind='talimat_degisiklik') = n`, 'bildirim yazildi')}
`));

// ---------------- 4) guncellik + pasif ----------------
steps.push(step('4.1 guncel_isaretle(plan,3)', 'planner', `
  d := ${S}.talimat_guncel_isaretle(v_plan, 3);
  ${assert(`d = ${S}.talimat_bugun() + 2`, 'bitis tarihi yanlis')}
  ${assert(`(select guncel_mi and guncel_bitis=d from ${S}.talimat_plan_ozet where plan_id=v_plan)`, 'plan_ozet guncel')}
`));
steps.push(expectErr('4.1b guncel_isaretle(plan,0)', 'planner', `perform ${S}.talimat_guncel_isaretle(v_plan, 0);`, 'Gün sayısı'));
steps.push(step('4.2 pasif satir + kaldir', 'planner', `
  n := ${S}.talimat_pasif('satir', v_plan, array[s1::text], null, null, 'test neden');
  ${assert('n=1', 'pasif satir sayisi')}
  ${assert(`(select etkin_pasif from ${S}.talimat_satir_etkin where satir_id=s1)`, 'etkin_pasif false')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=s1)='pasif'`, 'etkin_durum')}
  n := ${S}.talimat_pasif_kaldir('satir', v_plan, array[s1::text]);
  ${assert(`n=1 and not (select etkin_pasif from ${S}.talimat_satir_etkin where satir_id=s1)`, 'kaldir calismadi')}
`));
steps.push(step('4.3 pasif personel + kaldir', 'planner', `
  n := ${S}.talimat_pasif('personel', v_plan, array[w1], null, null, 'izin');
  ${assert(`(select bool_and(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and personel_id=w1)`, 'personel pasif degil')}
  ${assert(`not (select bool_or(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and personel_id=w2)`, 'baska personel pasif')}
  n := ${S}.talimat_pasif_kaldir('personel', v_plan, array[w1]);
  ${assert(`n=1 and not (select bool_or(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and personel_id=w1)`, 'personel kaldir')}
`));
steps.push(step('4.4 pasif liste (bitisli) + kaldir', 'planner', `
  n := ${S}.talimat_pasif('liste', v_plan, null, null, ${S}.talimat_bugun()+1, 'tatil');
  ${assert(`(select bool_and(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan)`, 'liste pasif degil')}
  n := ${S}.talimat_pasif_kaldir('liste', v_plan, null);
  ${assert(`n=1 and not (select bool_or(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan)`, 'liste kaldir')}
`));
steps.push(expectErr('4.5 pasif gecersiz kapsam', 'planner', `perform ${S}.talimat_pasif('xx', v_plan, null, null, null, null);`, 'Geçersiz kapsam'));
steps.push(expectErr('4.5b pasif bitis<baslangic', 'planner', `perform ${S}.talimat_pasif('liste', v_plan, null, ${S}.talimat_bugun(), ${S}.talimat_bugun()-1, null);`, 'Bitiş tarihi'));

// ---------------- 5) talepler ----------------
steps.push(step('5.1 talep_olustur (miktar+depo / miktarsiz+depo yok)', 'office', `
  t1 := ${S}.talep_olustur('LS031', 'YURTICI', 50, ${S}.talimat_bugun()+7, '  acil ');
  t2 := ${S}.talep_olustur('LS051', null, null, null, null);
  ${assert(`(select aciklama from ${S}.talepler where talep_id=t1)='acil'`, 'aciklama trim')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='acik' and (select durum from ${S}.talep_durum where talep_id=t2)='acik'`, 'durum acik degil')}
  ${assert(`(select serbest_mi from ${S}.talep_durum where talep_id=t1)`, 'serbest_mi')}
`));
steps.push(expectErr('5.1b talep_olustur gecersiz depo', 'office', `perform ${S}.talep_olustur('LS031','YOKDEPO',1,null,null);`, 'Geçersiz hedef depo'));
steps.push(expectErr('5.1c talep_olustur hat hesabi (ofis degil)', 'station', `perform ${S}.talep_olustur('LS031',null,1,null,null);`, 'Talep açma yetkiniz yok'));
steps.push(step('5.2 talep_guncelle 10 dk icinde (revizyonsuz)', 'office', `
  j := ${S}.talep_guncelle(t1, '{"istenen_miktar": 60}'::jsonb, false);
  ${assert(`(j->>'serbest')::boolean and (j->>'degisti')::boolean`, 'serbest degil')}
  ${assert(`not exists (select 1 from ${S}.talep_revizyonlar where talep_id=t1)`, 'revizyon yazilmis')}
  ${assert(`(select istenen_miktar from ${S}.talepler where talep_id=t1)=60`, 'miktar degismedi')}
`));
steps.push(step('5.3 talep_talimata_ata (w3, listenin sonu) not/miktar kopyasi', 'planner', `
  delete from ${S}.talimat_satirlar where plan_id=v_plan and personel_id=w3; -- 1.12 kalintilari
  s9 := ${S}.talep_talimata_ata(t1, w3);
  select talep_id, aciklama_ok, miktar, sira into tid, flag, tmpn, k from (
    select talep_id, (not_text='acil') as aciklama_ok, istenen_miktar as miktar, sira from ${S}.talimat_satirlar where satir_id=s9) q;
  ${assert(`tid=t1 and flag and tmpn=60 and k=1`, 'ata satiri hatali')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='is_emri_verildi'`, 'durum is_emri_verildi degil')}
  ${assert(`(select bagli_satir_sayisi from ${S}.talep_durum where talep_id=t1)=1`, 'bagli satir')}
`));
steps.push(expectErr('5.3b talep_talimata_ata sira dolu', 'planner', `perform ${S}.talep_talimata_ata(t2, w3, 1);`, 'SIRA_DOLU'));
steps.push(step('5.4 talimat bildirimsiz yayin (bayrak temizle) + talep yasland', 'planner', `
  perform ${S}.talimat_yayinla(v_plan, false, null, false, 'degisenler');
  ${su}
  update ${S}.talepler set created_at = now() - interval '20 minutes' where talep_id = t1;
  ${assert(`not (select serbest_mi from ${S}.talep_durum where talep_id=t1)`, 'hala serbest')}
`));
steps.push(step('5.5 talep_guncelle >10 dk: revizyon + satir degisti', 'office', `
  j := ${S}.talep_guncelle(t1, '{"aciklama":"yeni acik"}'::jsonb, false);
  ${assert(`not (j->>'serbest')::boolean and (j->>'etkilenen_satir')::int=1`, 'serbest/etkilenen')}
  ${assert(`(select count(*) from ${S}.talep_revizyonlar where talep_id=t1 and islem='guncelle')=1`, 'revizyon yok')}
  ${su}
  ${assert(`(select degisti and not_text='yeni acik' from ${S}.talimat_satirlar where satir_id=s9)`, 'satir degisti/not guncellenmedi')}
`));
steps.push(expectErr('5.5b baska ofis kullanicisi talebi guncelleyemez', 'office2', `perform ${S}.talep_guncelle(t1, '{"aciklama":"x"}'::jsonb, false);`, 'Bu talebi düzenleme yetkiniz yok'));
steps.push(step('5.6 planlayici talep_guncelle + bildirim=true -> yayin', 'planner', `
  j := ${S}.talep_guncelle(t1, '{"istenen_miktar": 70}'::jsonb, true);
  out := out || '      ' || j::text || E'\\n';
  ${assert(`jsonb_array_length(j->'yayin_idler')=1`, 'yayin yok')}
  ${assert(`(select istenen_miktar from ${S}.talimat_satirlar where satir_id=s9)=70`, 'satir miktar guncellenmedi')}
  ${assert(`(select count(*) from ${S}.talep_revizyonlar where talep_id=t1)=2`, 'revizyon sayisi')}
`));
steps.push(step('5.7 talep satir pasif -> talep_durum pasif; kaldir', 'planner', `
  n := ${S}.talimat_pasif('satir', v_plan, array[s9::text], null, null, 'bekle');
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='pasif'`, 'talep pasif degil')}
  n := ${S}.talimat_pasif_kaldir('satir', v_plan, array[s9::text]);
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='is_emri_verildi'`, 'durum geri gelmedi')}
`));
steps.push(step('5.8 satir devri: personel degisince aktif', 'planner', `
  n := ${S}.talimat_pasif('satir', v_plan, array[s9::text], null, null, 'bekle');
  perform ${kaydet(`jsonb_build_object('satir_id',s9,'personel_id',w5)`)};
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=s9)='aktif' and (select personel_id from ${S}.talimat_satirlar where satir_id=s9)=w5`, 'devir pasif kaldi')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='is_emri_verildi'`, 'talep durum')}
`));
steps.push(step('5.9 talep_stokta_mevcut (t2) + yeniden_ac', 'planner', `
  perform ${S}.talep_stokta_mevcut(t2, 'depoda var');
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t2)='stokta_mevcut'`, 'stokta_mevcut degil')}
  perform ${S}.talep_yeniden_ac(t2);
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t2)='acik'`, 'yeniden acilmadi')}
  ${assert(`(select count(*) from ${S}.talep_revizyonlar where talep_id=t2)=2`, 'revizyon sayisi')}
`));
steps.push(step('5.10 talep_kapat tamamlandi + yeniden_ac', 'office', `
  perform ${S}.talep_kapat(t1, 'tamamlandi', 'bitti');
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='tamamlandi'`, 'durum tamamlandi degil')}
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=s9)='tamamlandi'`, 'satir tamamlandi degil')}
  perform ${S}.talep_yeniden_ac(t1);
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=s9)='aktif'`, 'satir aktiflesmedi')}
`));
steps.push(step('5.11 talep_kapat tamamlanmadi + neden + yeniden_ac', 'office', `
  perform ${S}.talep_kapat(t1, 'tamamlanmadi', 'malzeme yok');
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t1)='tamamlanmadi' and (select kapanis_neden from ${S}.talepler where talep_id=t1)='malzeme yok'`, 'durum/neden')}
  ${assert(`(select durum='pasif' and pasif_neden like 'Talep:%' from ${S}.talimat_satirlar where satir_id=s9)`, 'satir pasiflenmedi')}
  perform ${S}.talep_yeniden_ac(t1);
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=s9)='aktif'`, 'satir aktiflesmedi')}
`));
steps.push(expectErr('5.11b talep_kapat gecersiz durum', 'office', `perform ${S}.talep_kapat(t1,'xx',null);`, 'Geçersiz kapanış durumu'));
steps.push(expectErr('5.12 talimata bagli talep silinemez', 'planner', `perform ${S}.talep_sil(t1);`, 'İş talimatına bağlı talep silinemez'));
steps.push(step('5.13 talep_geri_cek (serbest) + talep_sil', 'office', `
  t3 := ${S}.talep_olustur('LS031', null, 5, null, null);
  perform ${S}.talep_geri_cek(t3, 'yanlis');
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t3)='geri_cekildi'`, 'geri_cekildi degil')}
  ${assert(`not exists (select 1 from ${S}.talep_revizyonlar where talep_id=t3)`, 'serbest geri cekmede revizyon var')}
  perform ${S}.talep_sil(t3);
  ${assert(`not exists (select 1 from ${S}.talepler where talep_id=t3)`, 'silinmedi')}
`));
steps.push(step('5.14 talep_geri_cek 10dk sonra: revizyon + bagli satir pasif', 'office', `
  perform ${S}.talep_geri_cek(t1, 'iptal');
  ${assert(`(select count(*) from ${S}.talep_revizyonlar where talep_id=t1 and islem='geri_cek')=1`, 'revizyon yok')}
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=s9)='pasif'`, 'satir pasif degil')}
`));
steps.push(expectErr('5.15 10dk sonra acan talep_sil edemez', 'office',
  `delete from ${S}.talep_revizyonlar where false; perform ${S}.talep_sil(t2);`, 'Talep yalnızca açıldıktan'));
// t2 is fresh (<10 min) so 5.15 above would succeed; age it first (replace step)
steps[steps.length - 1] = step('5.15 acan 10dk sonra talep_sil edemez', 'office', `
  ${su}
  update ${S}.talepler set created_at = now() - interval '20 minutes' where talep_id = t2;
  ${as('office')}
  begin
    perform ${S}.talep_sil(t2);
    raise exception 'NO_ERROR_RAISED';
  exception when others then
    if sqlerrm not like 'Talep yalnızca açıldıktan%' then raise exception 'beklenmeyen hata: %', sqlerrm; end if;
  end;
`);

// ---------------- 5b) talep kaldir + istasyon otomatik ----------------
steps.push(step('5.16 talep_kaldir: kapali talep kaldirilir, yeniden_ac temizler, toplu', 'office', `
  ${assert(`(select kapanis from ${S}.talepler where talep_id=t1) is not null and (select kaldirildi_at from ${S}.talep_durum where talep_id=t1) is null`, 'baslangic')}
  perform ${S}.talep_kaldir(t1);
  ${assert(`(select kaldirildi_at from ${S}.talep_durum where talep_id=t1) is not null and (select kaldiran from ${S}.talepler where talep_id=t1)='${officeId}'`, 'kaldirildi_at yok')}
  perform ${S}.talep_yeniden_ac(t1);
  ${assert(`(select kaldirildi_at from ${S}.talep_durum where talep_id=t1) is null`, 'yeniden_ac kaldirildi_at temizlemedi')}
  ${assert(`${S}.talep_kaldir_toplu(array[t1,t2]) = 0`, 'toplu: acik talepler kaldirilmamali')}
  perform ${S}.talep_geri_cek(t1, 'tekrar');
  ${assert(`${S}.talep_kaldir_toplu(array[t1,t2]) = 1`, 'toplu: yalniz kapali olan 1 kaldirilmali')}
`));
steps.push(expectErr('5.16b acik talep kaldirilamaz', 'office', `perform ${S}.talep_kaldir(t2);`, 'Yalnızca kapalı talepler'));
steps.push(expectErr('5.16c yetkisiz (hat hesabi) talep_kaldir', 'station', `perform ${S}.talep_kaldir(t1);`, 'Bu talebi kaldırma yetkiniz yok'));
steps.push(step('5.17 istasyon users.station den otomatik (trigger)', 'planner', `
  ${assert(`${S}.talimat_istasyon_esle('Paketleme Hattı')='paketleme' and ${S}.talimat_istasyon_esle('Montaj')='montaj' and ${S}.talimat_istasyon_esle('Kesim')='kesim' and ${S}.talimat_istasyon_esle('Kutu') is null and ${S}.talimat_istasyon_esle(null) is null`, 'esleme')}
  select user_id into tmp from ${S}.users where station::text in ('Paketleme','Paketleme Hattı') and role::text in ('Üretim','Hat') and is_active
    and user_id not in (w1,w2,w3,w4,w5) limit 1;
  select user_id into tmp2 from ${S}.users where station::text in ('Montaj','Montaj Hattı') and role::text in ('Üretim','Hat') and is_active
    and user_id not in (w1,w2,w3,w4,w5) limit 1;
  if tmp is null or tmp2 is null then raise exception 'test personeli bulunamadi'; end if;
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',tmp,'sku','LS031')`)};
  ${assert(`(select istasyon from ${S}.talimat_satirlar where satir_id=s10)='paketleme'`, 'paketleme istasyonu atanmadi')}
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',tmp2)`)};
  ${assert(`(select istasyon from ${S}.talimat_satirlar where satir_id=s10)='montaj'`, 'montaj istasyonu atanmadi (bos satir)')}
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',tmp,'sku','LS051','istasyon','kesim')`)};
  ${assert(`(select istasyon from ${S}.talimat_satirlar where satir_id=s10)='kesim'`, 'acik istasyon ezildi')}
`));

// ---------------- 5c) talep bildirimleri (zil) ----------------
steps.push(step('5.18 talep bildirimi: yeni talep planlayiciya, actor haric', 'office', `
  tid := ${S}.talep_olustur('LS051', null, 7, null, null);
  ${su}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and olay='yeni' and alici_user_id=${ql(officeId)})=0`, 'actor kendine bildirim aldi')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and olay='yeni' and alici_user_id=${ql(plannerId)})=1`, 'planlayici yeni bildirimi almadi')}
  ${as('planner')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid)>=1`, 'planlayici kendi bildirimini goremiyor')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and alici_user_id<>${ql(plannerId)})=0`, 'RLS: baskasinin bildirimi gorunuyor')}
`));
steps.push(step('5.19 talep bildirimi: degisiklik sahibe, goruldu, 30 dk temizlik', 'planner', `
  ${su}
  update ${S}.talepler set created_at = now() - interval '20 minutes' where talep_id = tid;
  ${as('planner')}
  perform ${S}.talep_guncelle(tid, '{"aciklama":"zil testi"}'::jsonb, false);
  ${su}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and olay='degisti' and alici_user_id=${ql(officeId)})=1`, 'sahip degisti bildirimi almadi')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and olay='degisti' and alici_user_id=${ql(plannerId)})=0`, 'actor degisti bildirimi aldi')}
  ${as('office')}
  tmpn := ${S}.talep_bildirim_goruldu(array(select id from ${S}.talep_bildirimleri where talep_id=tid));
  ${assert(`tmpn >= 1`, 'goruldu isaretlenmedi')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and goruldu_at is null)=0`, 'okunmamis kaldi')}
  ${as('planner')}
  tmpn := ${S}.talep_bildirim_goruldu(array(select id from ${S}.talep_bildirimleri where talep_id=tid and alici_user_id=${ql(plannerId)}));
  ${su}
  update ${S}.talep_bildirimleri set goruldu_at = now() - interval '31 minutes' where talep_id=tid and alici_user_id=${ql(officeId)};
  perform ${S}.talep_bildirim_temizle();
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and alici_user_id=${ql(officeId)})=0`, '30 dk sonra silinmedi')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=tid and alici_user_id=${ql(plannerId)} and goruldu_at is not null)>=1`, 'taze goruldu satiri silindi')}
`));

// ---------------- 7) kopyala ----------------
steps.push(step('7.1 talimat_kopyala_hafta (gelecek hafta)', 'planner', `
  v_plan2 := ${S}.talimat_kopyala_hafta(v_plan, ${S}.talimat_bugun() + 7);
  select count(*) into n from ${S}.talimat_satirlar where plan_id=v_plan2;
  select count(*) into m from ${S}.talimat_satirlar where plan_id=v_plan;
  out := out || '      kaynak=' || m || ' hedef=' || n || ' hedef_durum=' || (select durum from ${S}.talimat_planlar where plan_id=v_plan2) || E'\\n';
  ${assert('n=m and n>0', 'kopya sayisi')}
  ${assert(`(select durum from ${S}.talimat_planlar where plan_id=v_plan2)='taslak'`, 'taslak degil')}
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan2 and durum<>'aktif')`, 'aktif degil')}
`));
steps.push(expectErr('7.2 dolu hedefe tekrar kopyala', 'planner', `perform ${S}.talimat_kopyala_hafta(v_plan, ${S}.talimat_bugun() + 7);`, 'Hedef haftanın planı dolu'));
steps.push(step('7.3 gelecek hafta taslak ilk yayin: bildirim zorla kapali', 'planner', `
  j := ${S}.talimat_yayinla(v_plan2, true, null, false, 'degisenler');
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'ilk_yayin')::boolean and not (j->>'bildirim_gonder')::boolean and (j->>'durum')='bildirimsiz'`, 'gelecek hafta bildirim')}
  ${su}
  ${assert(`not exists (select 1 from ${S}.notifications where yayin_id=(j->>'yayin_id')::uuid)`, 'bildirim yazilmis')}
`));

// ---------------- 8) RLS ----------------
steps.push(step('8.1 istasyon hesabi satirlari okuyabilir', 'station', `
  select count(*) into n from ${S}.talimat_satirlar where plan_id=v_plan;
  ${assert('n>0', 'satir okunamadi')}
  select count(*) into m from ${S}.talimat_satir_ilerleme where plan_id=v_plan;
  ${assert('m>0', 'ilerleme okunamadi')}
`));
steps.push(expectErr('8.2 istasyon hesabi dogrudan INSERT yapamaz', 'station',
  `insert into ${S}.talimat_satirlar (plan_id, personel_id, sira, sku) values (v_plan, 'VW016', 99, 'LS031');`, 'new row violates row-level security'));
steps.push(expectErr('8.3 istasyon hesabi satir_kaydet RPC yapamaz', 'station',
  `perform ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id','VW016','sku','LS031')`)};`, 'Bu işlem için yetkiniz yok'));
steps.push(expectErr('8.4 istasyon hesabi zamanlayici cagiramaz', 'station', `perform ${S}.talimat_zamanlayici();`, 'permission denied'));
steps.push(step('8.5 istasyon hesabi satir UPDATE sessizce 0 satir', 'station', `
  update ${S}.talimat_satirlar set not_text='hack' where satir_id=s1;
  get diagnostics n = row_count;
  ${assert('n=0', 'istasyon satiri guncelledi')}
`));

// ---------------- 6) zamanlayici ----------------
steps.push(step('6.1 talimat_zamanlayici() dogrudan', null, `
  j := ${S}.talimat_zamanlayici();
  out := out || '      ' || j::text || E'\\n';
`));
steps.push(step('6.2 hatirlatma + rapor (zaman ilerletilmis yayin)', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s7,'istenen_miktar',9)`)};
  j := ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler'); y5 := (j->>'yayin_id')::uuid;
  ${su}
  update ${S}.talimat_yayinlar set ilk_gonderim_at = now() - interval '30 minutes' where yayin_id = y5;
  update ${S}.talimat_yayin_hedefler set son_bildirim_at = now() - interval '30 minutes' where yayin_id = y5;
  j := ${S}.talimat_zamanlayici();
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'hatirlatma')::int>=1 and (j->>'rapor')::int>=1`, 'hatirlatma/rapor 0')}
  ${assert(`exists (select 1 from ${S}.notifications where yayin_id=y5 and kind='talimat_rapor' and target_user='${plannerId}')`, 'rapor bildirimi yok')}
  ${assert(`(select count(*) from ${S}.notifications where yayin_id=y5 and kind='talimat_degisiklik' and target_user=w2 and geri_cekildi_at is null)=1`, 'aktif hatirlatma bildirimi 1 olmali')}
  ${assert(`(select count(*) from ${S}.notifications where yayin_id=y5 and kind='talimat_degisiklik' and target_user=w2 and geri_cekildi_at is not null)=1`, 'eski bildirim geri cekilmeli')}
  j := ${S}.talimat_zamanlayici();
  ${assert(`(j->>'hatirlatma')::int=0 and (j->>'rapor')::int=0`, 'ikinci calismada tekrar gonderdi')}
`));
steps.push(step('6.3 planli gonderim (beklemede) zamanlayici gonderir', 'planner', `
  perform ${kaydet(`jsonb_build_object('satir_id',s7,'istenen_miktar',10)`)};
  j := ${S}.talimat_yayinla(v_plan, true, now() + interval '1 hour', false, 'degisenler'); y6 := (j->>'yayin_id')::uuid;
  ${assert(`(j->>'durum')='beklemede'`, 'beklemede degil')}
  ${su}
  ${assert(`not exists (select 1 from ${S}.notifications where yayin_id=y6)`, 'erken bildirim')}
  update ${S}.talimat_yayinlar set gonderim_zamani = now() - interval '1 minute' where yayin_id = y6;
  j := ${S}.talimat_zamanlayici();
  ${assert(`(j->>'planli_gonderim')::int>=1 and (select durum from ${S}.talimat_yayinlar where yayin_id=y6)='gonderildi'`, 'planli gonderilmedi')}
  ${assert(`exists (select 1 from ${S}.notifications where yayin_id=y6)`, 'bildirim yok')}
`));
steps.push(step('6.3b otomatik pazartesi yayini (yayinla_ic otomatik=true)', null, `
  j := ${S}.talimat_yayinla_ic(v_plan, true, now(), true, 'herkes', null, true);
  ${assert(`(j->>'durum')='gonderildi' and (j->>'personel_sayisi')::int>=3`, 'otomatik yayin')}
  ${assert(`exists (select 1 from ${S}.notifications where yayin_id=(j->>'yayin_id')::uuid and title like 'Bu haftan%' and kind='talimat_degisiklik')`, 'otomatik baslik yok')}
`));
steps.push(step('6.4 otomatik pasif (hafta gecmis) + PLAN_PASIF + tablet', null, `
  update ${S}.talimat_planlar set hafta_baslangic = hafta_baslangic - 14 where plan_id = v_plan;
  j := ${S}.talimat_zamanlayici();
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'pasif_plan')::int>=1 and (select durum from ${S}.talimat_planlar where plan_id=v_plan)='pasif'`, 'plan pasiflenmedi')}
  ${assert(`not exists (select 1 from ${S}.notifications where kind='talimat_degisiklik' and yayin_id in (select yayin_id from ${S}.talimat_yayinlar where plan_id=v_plan) and geri_cekildi_at is null)`, 'acik bildirim kaldi')}
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan and onay_bekliyor)`, 'onay_bekliyor kaldi')}
  ${assert(`not exists (select 1 from ${S}.talimat_yayinlar where plan_id=v_plan and durum in ('beklemede','gonderildi'))`, 'acik yayin kaldi')}
`));
steps.push(expectErr('6.5 pasif plan duzenlenemez', 'planner', `perform ${kaydet(`jsonb_build_object('satir_id',s7,'istenen_miktar',11)`)};`, 'PLAN_PASIF'));
steps.push(step('6.6 pasif plan tablette gorunmez (seans yok)', 'station', `
  ${assert(`${S}.talimat_tablet_plan(w1) is null or ${S}.talimat_tablet_plan(w1) <> v_plan`, 'pasif plan gorunuyor')}
`));

// ---------------- 9) ek seans ----------------
steps.push(step('9.1 ek_seanslar gorunumu: bayrakli seanslar, bayraksiz haric', 'planner', `
  ${su}
  insert into ${S}.montaj_sessions (session_id, sku, step_id, step_name, seq_no, durum, operator_id, operator_name, start_time, end_time, qty, ek_seans)
    values ('TEST-EK-M1','LS031','TEST-STEP','Test adim',1,'tamamlandi',w1,'Test Personel', now() - interval '90 minutes', now() - interval '30 minutes', 5, true),
           ('TEST-EK-M2','LS031','TEST-STEP','Test adim',1,'montajda',w1,'Test Personel', now() - interval '10 minutes', null, 0, false);
  insert into ${S}.pack_events (session_id, sku, durum, operator_id, operator_name, start_time, ek_seans)
    values ('TEST-EK-P1','LS031','paketlemede',w1,'Test Personel', now() - interval '5 minutes', true);
  ${as('planner')}
  ${assert(`(select count(*) from ${S}.ek_seanslar where session_id like 'TEST-EK-%')=2`, 'ek_seanslar satir sayisi')}
  ${assert(`(select net_sure_dk from ${S}.ek_seanslar where session_id='TEST-EK-M1') between 59 and 61`, 'montaj net sure')}
  ${assert(`(select durum from ${S}.ek_seanslar where session_id='TEST-EK-P1')='acik'`, 'paketleme durum')}
  ${assert(`(select count(*) from ${S}.ek_seanslar where session_id='TEST-EK-M2')=0`, 'bayraksiz seans gorunuyor')}
`));

const body = `
declare
  v_plan uuid; v_plan2 uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid; s8 uuid; s9 uuid; s10 uuid;
  y1 uuid; y2 uuid; y3 uuid; y4 uuid; y5 uuid; y6 uuid; t1 uuid; t2 uuid; t3 uuid; tid uuid;
  n int; m int; k int; tmpn numeric; flag boolean; d date; j jsonb; plk text; tmp text; tmp2 text;
  w1 text := 'VW016'; w2 text := 'VW018'; w3 text := 'VW020'; w4 text := 'VW022'; w5 text := 'VW021';
  other text; out text := '';
begin
  -- Prova schema'sinda elle olusturulmus plan/satirlar testi bozmasin (tum islem rollback edilir)
  delete from ${S}.talimat_planlar;
  select sku into other from ${S}.products where sku not in ('LS031','LS051','MKOS41') order by sku limit 1;
  if other is null then select sku into other from ${S}.products where sku not in ('LS031','LS051','MKOS41') limit 1; end if;
  out := out || 'diger_sku=' || coalesce(other,'-') || ' planner=${plannerId} office=${officeId} station=${stationId}' || E'\\n';
  ${steps.join('\n')}
  raise exception 'TEST_SONUCU%', E'\\n' || out;
end`;

const q = `
begin;
set local search_path = ${S}, extensions;
do $t$ ${body} $t$;
rollback;`;

try {
  await ctx.tgt(q, { label: 'talimat smoke test' });
  log('Unexpected: test block did not raise.');
} catch (e) {
  const m = String(e.message);
  const i = m.indexOf('TEST_SONUCU');
  log(i >= 0 ? m.slice(i + 11).replace(/\\n/g, '\n') : m);
}

const cron = await ctx.tgt(
  `select jobname, schedule, active from cron.job where jobname like 'vigowood_prova-%'`, { readOnly: true });
log('cron.job: ' + JSON.stringify(cron));
