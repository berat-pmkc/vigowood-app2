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
steps.push(step('1.3 ardisik ayni sku artik serbest (MKOS41 ardindan MKOS41, sonra sil)', 'planner', `
  s4 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w1,'sku','MKOS41')`)};
  ${assert(`${sat('s4')}=4`, 'ardisik ayni sku eklenemedi')}
  perform ${S}.talimat_satir_sil(s4);
`));
steps.push(step('1.4 LS031 sona (4. sira)', 'planner', `
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
steps.push(step('1.8 satir_sirala ardisik ayni sku artik serbest', 'planner', `
  perform ${S}.talimat_satir_sirala(v_plan, w1, array[s1,s4,s3,s2,s5]);
  perform ${S}.talimat_satir_sirala(v_plan, w1, array[s4,s3,s2,s5,s1]);
`));
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
steps.push(step('1.12 dogrudan yazma ardisik ayni sku artik serbest', 'planner', `
  insert into ${S}.talimat_satirlar (plan_id, personel_id, sira, sku) values (v_plan, w3, 1, 'LS031'), (v_plan, w3, 2, 'LS031');
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  delete from ${S}.talimat_satirlar where plan_id=v_plan and personel_id=w3;
`));
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
  -- ardisik kural kaldirildi: LS031 (s9) ardindan LS031 serbest
  perform ${S}.talimat_satir_sil(s10);
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'personel_id',w5,'sku','LS031')`)};
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
  ${assert(`n=(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and (sku is not null or plaka_id is not null))`, 'plan_ozet satir_sayisi (bos hat satirlari sayilmaz)')}
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

// ---------------- 11) HAT BAZLI MODEL (H1) ----------------
const hsat = (id) => `(select sira from ${S}.talimat_satirlar where satir_id = ${id})`;
const hkaydet = (obj) => kaydet(obj);
const msIns = (id, sku, step, op, hat, o = {}) => {
  const durum = o.durum ?? 'tamamlandi';
  return `insert into ${S}.montaj_sessions (session_id, sku, step_id, step_name, seq_no, durum, operator_id, operator_name, start_time, end_time, qty, is_final_step, hat_id, workers)
    values ('${id}', '${sku}', '${step}', 'Test adim', 1, '${durum}', ${op}, 'Test Personel', ${o.startExpr ?? 'now()'},
            ${durum === 'tamamlandi' ? (o.endExpr ?? "now() + interval '1 minute'") : 'null'}, ${o.qty ?? 0}, ${o.final ?? false}, ${hat}, ${o.workers ?? 'null'});`;
};
const peIns = (id, sku, op, hat, o = {}) => {
  const durum = o.durum ?? 'tamamlandi';
  return `insert into ${S}.pack_events (session_id, tarih, sku, qty, durum, start_time, end_time, operator_id, operator_name, hat_id, personel)
    values ('${id}', now(), '${sku}', ${o.qty ?? 0}, '${durum}', now(),
            ${durum === 'tamamlandi' ? (o.endExpr ?? "now() + interval '1 minute'") : 'null'}, ${op}, 'Test Personel', ${hat}, ${o.personel ?? 'null'});`;
};

steps.push(step('11.1 hatlar: seed + tablet okuyabilir, yazamaz', 'station', `
  h1 := (select hat_id from ${S}.talimat_hatlar where ad='MONTAJ 1 HATTI');
  h2 := (select hat_id from ${S}.talimat_hatlar where ad='MONTAJ 2 HATTI');
  h3 := (select hat_id from ${S}.talimat_hatlar where ad='MONTAJ 3 HATTI');
  h4 := (select hat_id from ${S}.talimat_hatlar where ad='DÖŞEME HATTI');
  h5 := (select hat_id from ${S}.talimat_hatlar where ad='PAKETLEME HATTI');
  ${assert('h1 is not null and h2 is not null and h3 is not null and h4 is not null and h5 is not null', 'varsayilan hatlar yok')}
  ${assert(`(select count(*) from ${S}.talimat_hatlar where hat_id in (h1,h2,h3,h4) and tur='montaj' and aktif)=4 and (select tur from ${S}.talimat_hatlar where hat_id=h5)='paketleme'`, 'hat turleri')}
  ${assert(`(select array_agg(ad order by sira) from ${S}.talimat_hatlar where hat_id in (h1,h2,h3,h4,h5))=array['MONTAJ 1 HATTI','MONTAJ 2 HATTI','MONTAJ 3 HATTI','DÖŞEME HATTI','PAKETLEME HATTI']`, 'hat sirasi')}
`));
steps.push(expectErr('11.1b istasyon hesabi hat tablosuna dogrudan yazamaz', 'station',
  `insert into ${S}.talimat_hatlar (ad, tur, sira) values ('HACK HAT', 'montaj', 99);`, 'new row violates row-level security'));
steps.push(expectErr('11.1c istasyon hesabi hat_ekle yapamaz', 'station', `perform ${S}.hat_ekle('HACK', 'montaj');`, 'Bu işlem için yetkiniz yok'));

steps.push(step('11.2 plan: her aktif hat icin bos satir (idempotent)', 'planner', `
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id in (h1,h2,h3,h4,h5) and sku is null and plaka_id is null and personel_id is null)=5`, 'her hatta 1 bos satir olmali')}
  ${assert(`(select istasyon from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h5)='paketleme' and (select istasyon from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h1)='montaj'`, 'istasyon hat turunden')}
  n := (select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id is not null);
  perform ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun());
  ${assert(`n = (select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id is not null)`, 'plan_getir idempotent degil (hat satiri cogaldi)')}
  ${assert(`(select hat_sayisi from ${S}.talimat_plan_ozet where plan_id=v_plan)=0`, 'bos hat satirlari ozette hat sayilmamali')}
`));

steps.push(step('11.3 hat_ekle / hat_guncelle / hat_pasif', 'planner', `
  hx := ${S}.hat_ekle('  TEST HATTI ', 'montaj');
  ${assert(`(select ad='TEST HATTI' and sira=6 and aktif from ${S}.talimat_hatlar where hat_id=hx)`, 'hat_ekle')}
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=hx and sku is null)=1`, 'yeni hat mevcut planda 1 bos satir almali')}
  perform ${S}.hat_guncelle(hx, 'TEST HATTI 2');
  ${assert(`(select ad from ${S}.talimat_hatlar where hat_id=hx)='TEST HATTI 2'`, 'hat_guncelle ad')}
  perform ${S}.hat_guncelle(hx, null, 'paketleme');
  ${assert(`(select istasyon from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=hx)='paketleme'`, 'tur degisince istasyon guncellenmeli')}
  perform ${S}.hat_guncelle(hx, null, 'montaj');
  perform ${S}.hat_pasif(hx);
  ${assert(`not (select aktif from ${S}.talimat_hatlar where hat_id=hx)`, 'hat_pasif')}
`));
steps.push(expectErr('11.3b pasif hatta satir kaydedilemez', 'planner',
  `perform ${hkaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',hx,'sku','LS031')`)};`, 'Hat bulunamadı veya pasif'));
steps.push(expectErr('11.3c ayni isimde hat', 'planner', `perform ${S}.hat_ekle('montaj 1 hatti', 'montaj');`, 'Bu isimde hat zaten var'));
steps.push(expectErr('11.3d gecersiz tur', 'planner', `perform ${S}.hat_ekle('X HAT', 'kesim');`, 'Geçersiz hat türü'));
steps.push(step('11.3e hat_pasif(false) geri acar', 'planner', `
  perform ${S}.hat_pasif(hx, false);
  ${assert(`(select aktif from ${S}.talimat_hatlar where hat_id=hx)`, 'hat tekrar aktif degil')}
`));

steps.push(step('11.4 hat satiri: doldur / ekle / araya gir / sirala', 'planner', `
  r1 := (select satir_id from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h1 order by sira limit 1);
  perform ${hkaydet(`jsonb_build_object('satir_id',r1,'sku','LS031','istenen_miktar',10,'not_text','hat notu','personel_id',w1)`)};
  ${assert(`(select sku='LS031' and personel_id is null and istasyon='montaj' and sira=1 and istenen_miktar=10 and degisti from ${S}.talimat_satirlar where satir_id=r1)`, 'hat satiri dolmadi / personel yok sayilmadi / degisti yok')}
  r2 := ${hkaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h1,'sku','LS051','istenen_miktar',20)`)};
  ${assert(`${hsat('r2')}=2`, 'ikinci hat satiri sira 2 degil')}
`));
steps.push(expectErr('11.4b dolu sira kaydir olmadan', 'planner',
  `perform ${hkaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h1,'sku','MKOS41','sira',1)`)};`, 'SIRA_DOLU'));
steps.push(step('11.4c kaydir=true araya girer, sirala_hat, eksik liste', 'planner', `
  r3 := ${hkaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h1,'sku','MKOS41','istenen_miktar',30,'sira',1,'kaydir',true)`)};
  ${assert(`${hsat('r3')}=1 and ${hsat('r1')}=2 and ${hsat('r2')}=3`, 'kaydirma hatali')}
  perform ${S}.talimat_satir_sirala_hat(v_plan, h1, array[r1,r2,r3]);
  ${assert(`${hsat('r1')}=1 and ${hsat('r2')}=2 and ${hsat('r3')}=3`, 'sirala_hat hatali')}
  ${assert(`(select count(distinct sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h1)=3`, 'sira tekil degil')}
`));
steps.push(expectErr('11.4d sirala_hat eksik liste', 'planner',
  `perform ${S}.talimat_satir_sirala_hat(v_plan, h1, array[r1,r2]);`, 'Sıralama listesi hattın'));
steps.push(step('11.5 satir_sil: sira sikisir; hattin son satiri silinirse bos satir kalir', 'planner', `
  perform ${S}.talimat_satir_sil(r2);
  ${assert(`${hsat('r1')}=1 and ${hsat('r3')}=2`, 'sil sonrasi sira sikismadi')}
  r4 := (select satir_id from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 order by sira limit 1);
  perform ${hkaydet(`jsonb_build_object('satir_id',r4,'sku','LS031','istenen_miktar',1)`)};
  perform ${S}.talimat_satir_sil(r4);
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)=1 and (select sku is null from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'hattin son satiri silinince bos satir kalmali')}
  ${assert(`(select h4 = any (degisen_hatlar) from ${S}.talimat_planlar where plan_id=v_plan)`, 'silinen satirin hatti degisen_hatlar a yazilmali')}
`));
steps.push(step('11.6 satir baska hatta tasinir (sona), eski hat sikisir', 'planner', `
  perform ${hkaydet(`jsonb_build_object('satir_id',r3,'hat_id',h2)`)};
  ${assert(`(select hat_id=h2 and sira=2 and istasyon='montaj' from ${S}.talimat_satirlar where satir_id=r3)`, 'satir hat2 sonuna tasinmadi')}
  ${assert(`${hsat('r1')}=1 and (select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h1)=1`, 'eski hat sikismadi')}
  perform ${hkaydet(`jsonb_build_object('satir_id',r3,'hat_id',h1)`)};
  ${assert(`${hsat('r3')}=2`, 'geri tasima')}
`));

steps.push(step('11.7 satirlari_hatta_kopyala: bos satir once dolar, sonra sona eklenir', 'planner', `
  ids := ${S}.talimat_satirlari_hatta_kopyala(array[r1, r3], h3);
  ${assert(`cardinality(ids)=2`, 'iki satir donmeli')}
  r5 := ids[1]; r6 := ids[2];
  ${assert(`(select sku='LS031' and istenen_miktar=10 and hat_id=h3 and sira=1 and personel_id is null from ${S}.talimat_satirlar where satir_id=r5)`, 'ilk kopya hedefin bos satirini doldurmali (sira 1)')}
  ${assert(`(select sku='MKOS41' and istenen_miktar=30 and sira=2 from ${S}.talimat_satirlar where satir_id=r6)`, 'ikinci kopya sona eklenmeli (sira 2)')}
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h3)=2`, 'hedef hat satir sayisi')}
  -- kaynak satirlar yerinde
  ${assert(`(select sku from ${S}.talimat_satirlar where satir_id=r1)='LS031' and (select hat_id from ${S}.talimat_satirlar where satir_id=r1)=h1`, 'kaynak degismemeli')}
  -- paketleme hattina: istasyon paketleme
  ids := ${S}.talimat_satirlari_hatta_kopyala(array[r1], h5);
  ${assert(`(select istasyon='paketleme' and sku='LS031' and sira=1 from ${S}.talimat_satirlar where satir_id=ids[1])`, 'paketleme hattina kopya')}
  r7 := ids[1];
`));
steps.push(expectErr('11.7b pasif/yok hedef hat', 'planner',
  `perform ${S}.talimat_satirlari_hatta_kopyala(array[r1], gen_random_uuid());`, 'Hedef hat bulunamadı'));
steps.push(expectErr('11.7c yalniz bos satir kopyalanamaz', 'planner',
  `perform ${S}.talimat_satirlari_hatta_kopyala(array[(select satir_id from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 limit 1)], h3);`, 'Kopyalanacak dolu satır yok'));

steps.push(step('11.8 ilerleme: hat+tur bazli (montaj=son asama, paketleme=paketleme), sayac, acik seans', 'planner', `
  -- r5: MONTAJ 3 / LS031 / istenen 10 ; r7: PAKETLEME / LS031 ; r1: MONTAJ 1 / LS031
  ${su}
  -- 156: sayac talimatin verildigi an baslar; satirlari 10 dk once verilmis gibi goster
  update ${S}.talimat_satirlar set sayac_baslangic = now() - interval '10 minutes' where satir_id in (r1, r5, r7);
  ${msIns('H-M-OK', 'LS031', 'H-STEP-F', 'w1', 'h3', { qty: 4, final: true, startExpr: "now() - interval '3 minutes'", endExpr: "now() - interval '2 minutes'" })}
  ${msIns('H-M-OTHERHAT', 'LS031', 'H-STEP-F', 'w1', 'h1', { qty: 7, final: true, startExpr: "now() - interval '3 minutes'", endExpr: "now() - interval '2 minutes'" })}
  ${msIns('H-M-NOTFINAL', 'LS031', 'H-STEP-1', 'w1', 'h3', { qty: 9, final: false, startExpr: "now() - interval '3 minutes'", endExpr: "now() - interval '2 minutes'" })}
  ${msIns('H-M-OLD', 'LS031', 'H-STEP-F', 'w1', 'h3', { qty: 11, final: true, startExpr: "now() - interval '30 minutes'", endExpr: "now() - interval '20 minutes'" })}
  ${msIns('H-M-NOHAT', 'LS031', 'H-STEP-F', 'w1', 'null', { qty: 13, final: true, startExpr: "now() - interval '3 minutes'", endExpr: "now() - interval '2 minutes'" })}
  ${peIns('H-P-OK', 'LS031', 'w2', 'h5', { qty: 6, endExpr: "now() - interval '2 minutes'" })}
  ${peIns('H-P-NOHAT', 'LS031', 'w2', 'null', { qty: 50, endExpr: "now() - interval '2 minutes'" })}
  ${as('planner')}
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=r5)=4`, 'MONTAJ 3 uretilen 4 olmali (diger hat/son asama olmayan/eski/hatsiz sayilmamali)')}
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=r1)=7`, 'MONTAJ 1 uretilen 7')}
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=r7)=6`, 'PAKETLEME uretilen 6 (montaj sayilmamali)')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=r5)='aktif' and (select fark from ${S}.talimat_satir_ilerleme where satir_id=r5)=6`, 'aktif/fark')}
  ${assert(`(select hat_adi='MONTAJ 3 HATTI' and hat_tur='montaj' and personel_adi is null from ${S}.talimat_satir_ilerleme where satir_id=r5)`, 'hat kolonlari')}
  ${assert(`(select acik_seans_sayisi from ${S}.talimat_satir_ilerleme where satir_id=r5)=0`, 'acik seans 0 olmali')}
  ${su}
  ${msIns('H-M-OPEN', 'LS031', 'H-STEP-2', 'w2', 'h3', { durum: 'montajda' })}
  ${as('planner')}
  ${assert(`(select acik_seans_sayisi=1 and son_seans_at is not null and hafta_seans_var from ${S}.talimat_satir_ilerleme where satir_id=r5)`, 'acik seans sayisi / son seans')}
  ${assert(`(select acik_seans_sayisi from ${S}.talimat_satir_ilerleme where satir_id=r1)=0`, 'baska hattin acik seansi sayilmamali')}
  -- montaj hattinda katki yalniz o hattin seanslari
  ${assert(`(select coalesce(sum(qty),0) from ${S}.talimat_satir_katki where satir_id=r5)=13`, 'katki: hat3 tamamlanan seanslar (4 + 9)')}
  -- tamamlama
  perform ${hkaydet(`jsonb_build_object('satir_id',r5,'istenen_miktar',4)`)};
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=r5)='tamamlandi'`, 'istenen karsilanince tamamlandi olmali')}
  perform ${S}.talimat_satir_yeniden_aktif(r5, 5);
  ${assert(`(select uretilen=0 and etkin_durum='aktif' from ${S}.talimat_satir_ilerleme where satir_id=r5)`, 'sayac sifirlanmali (hat satiri)')}
`));

steps.push(step('11.9 tek acik seans kurali (montaj + paketleme)', null, `
  ${msIns('H-RULE-1', 'LS031', 'H-RULE-STEP', 'w3', 'h3', { durum: 'montajda' })}
`));
steps.push(expectErr('11.9b ayni personel ayni urun/asama ikinci acik seans', null,
  msIns('H-RULE-2', 'LS031', 'H-RULE-STEP', 'w3', 'h3', { durum: 'montajda' }), 'Bu personelin bu ürün/aşamada açık seansı var'));
steps.push(expectErr('11.9c workers uyesi olarak ikinci acik seans', null,
  msIns('H-RULE-3', 'LS031', 'H-RULE-STEP', 'w4', 'h3', { durum: 'montajda', workers: `jsonb_build_array(jsonb_build_object('id', w3, 'name', 'x'))` }),
  'Bu personelin bu ürün/aşamada açık seansı var'));
steps.push(step('11.9d farkli asama / farkli urun / kapaninca serbest', null, `
  ${msIns('H-RULE-4', 'LS031', 'H-RULE-STEP-B', 'w3', 'h3', { durum: 'montajda' })}
  ${msIns('H-RULE-5', 'LS051', 'H-RULE-STEP', 'w3', 'h3', { durum: 'montajda' })}
  update ${S}.montaj_sessions set durum='tamamlandi', end_time = now() + interval '2 minutes' where session_id='H-RULE-1';
  ${msIns('H-RULE-6', 'LS031', 'H-RULE-STEP', 'w3', 'h3', { durum: 'montajda' })}
  ${peIns('H-RULE-P1', 'LS031', 'w3', 'h5', { durum: 'paketlemede' })}
`));
steps.push(expectErr('11.9e paketlemede ayni personel (personel CSV) ikinci acik seans', null,
  peIns('H-RULE-P2', 'LS031', 'w4', 'h5', { durum: 'paketlemede', personel: `w4 || ',' || w3` }),
  'Bu personelin bu ürün/aşamada açık seansı var'));
steps.push(step('11.9f paketleme: farkli urun serbest', null, `
  ${peIns('H-RULE-P3', 'LS051', 'w3', 'h5', { durum: 'paketlemede' })}
`));

steps.push(step('11.10 hat bazli yayin: hedefler, bildirim payload, hat onayi, yayin_ozet', 'planner', `
  j := ${S}.talimat_yayinla(v_plan, true, null, true, 'degisenler');
  ya := (j->>'yayin_id')::uuid;
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'hat_sayisi')::int >= 4`, 'hat_sayisi >= 4 beklenir (h1,h2?,h3,h4,h5)')}
  ${assert(`exists (select 1 from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id=h1 and personel_id is null and r1 = any (satir_ids))`, 'h1 hedefi / satir_ids')}
  ${assert(`exists (select 1 from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id=h4 and cardinality(satir_ids)=0)`, 'silinen satirli hat (h4) satirsiz hedef olmali')}
  ${assert(`not exists (select 1 from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id=hx)`, 'bos hat hedef olmamali')}
  ${assert(`(select onay_bekliyor and not degisti from ${S}.talimat_satirlar where satir_id=r1)`, 'bildirimli yayinda onay_bekliyor')}
  ${su}
  ${assert(`(select count(*) from ${S}.notifications where yayin_id=ya and kind='talimat_degisiklik' and target_user is null and payload ->> 'hat_id' is not null) = (j->>'hat_sayisi')::int`, 'hat basina 1 bildirim')}
  ${assert(`(select title like 'MONTAJ 1 HATTI%' and sesli and payload ->> 'hat_adi' = 'MONTAJ 1 HATTI' from ${S}.notifications where yayin_id=ya and payload ->> 'hat_id' = h1::text)`, 'bildirim baslik/payload')}
  ${as('station')}
  n := ${S}.talimat_onayla(p_yayin => ya, p_hat => h1);
  ${assert('n >= 1', 'hat onayi n')}
  ${assert(`(select onaylayan='${stationId}' and personel_id is null from ${S}.talimat_onaylar where yayin_id=ya and hat_id=h1)`, 'onay kaydi (hat, onaylayan istasyon hesabi)')}
  ${assert(`${S}.talimat_onayla(p_yayin => ya, p_hat => h1) = 0`, 'ikinci onay idempotent olmali')}
  ${su}
  ${assert(`not (select onay_bekliyor from ${S}.talimat_satirlar where satir_id=r1)`, 'onay sonrasi onay_bekliyor kalkmali')}
  ${assert(`(select status from ${S}.notifications where yayin_id=ya and payload ->> 'hat_id' = h1::text)='Okundu' and (select status from ${S}.notifications where yayin_id=ya and payload ->> 'hat_id' = h3::text)='Yeni'`, 'bildirim okundu yalniz o hat icin')}
  ${as('planner')}
  select hedef_sayisi, onay_sayisi, onaylamayan_sayisi into n, m, k from ${S}.talimat_yayin_ozet where yayin_id=ya;
  ${assert('m=1 and k=n-1', 'yayin_ozet sayilari')}
  ${assert(`jsonb_array_length((select onaylamayan_hatlar from ${S}.talimat_yayin_ozet where yayin_id=ya)) = k - (select count(*) from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id is null)`, 'onaylamayan_hatlar')}
  ${assert(`(select hat_sayisi from ${S}.talimat_yayin_ozet where yayin_id=ya) = (j->>'hat_sayisi')::int`, 'ozet hat_sayisi')}
`));
steps.push(expectErr('11.10b hedef olmayan hat onayi', 'station',
  `perform ${S}.talimat_onayla(p_yayin => ya, p_hat => hx);`, 'Bu hat yayının hedefi değil'));
steps.push(step('11.10c tum hedefler onaylayinca yayin tamamlandi', 'station', `
  for rec in select hat_id from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id is not null loop
    perform ${S}.talimat_onayla(p_yayin => ya, p_hat => rec.hat_id);
  end loop;
  for rec in select personel_id from ${S}.talimat_yayin_hedefler where yayin_id=ya and hat_id is null loop
    perform ${S}.talimat_onayla(ya, rec.personel_id);
  end loop;
  ${su}
  ${assert(`(select durum from ${S}.talimat_yayinlar where yayin_id=ya)='tamamlandi'`, 'yayin tamamlandi degil')}
  ${assert(`not exists (select 1 from ${S}.talimat_satirlar where plan_id=v_plan and hat_id is not null and onay_bekliyor)`, 'hat satirlarinda onay_bekliyor kalmamali')}
`));

steps.push(step('11.11 hat hatirlatma + planlayici raporu (zamanlayici)', 'planner', `
  perform ${hkaydet(`jsonb_build_object('satir_id',r1,'not_text','yeni hat notu')`)};
  j := ${S}.talimat_yayinla(v_plan, true, null, false, 'degisenler'); yb := (j->>'yayin_id')::uuid;
  ${assert(`(j->>'hat_sayisi')::int=1`, 'yalniz h1 degisti')}
  ${su}
  update ${S}.talimat_yayinlar set ilk_gonderim_at = now() - interval '30 minutes' where yayin_id = yb;
  update ${S}.talimat_yayin_hedefler set son_bildirim_at = now() - interval '30 minutes' where yayin_id = yb;
  j := ${S}.talimat_zamanlayici();
  out := out || '      ' || j::text || E'\\n';
  ${assert(`(j->>'hatirlatma')::int>=1 and (j->>'rapor')::int>=1`, 'hat hatirlatma/rapor 0')}
  ${assert(`(select count(*) from ${S}.notifications where yayin_id=yb and kind='talimat_degisiklik' and payload ->> 'hat_id' = h1::text and geri_cekildi_at is null)=1`, 'aktif hatirlatma bildirimi 1 olmali')}
  ${assert(`(select count(*) from ${S}.notifications where yayin_id=yb and kind='talimat_degisiklik' and payload ->> 'hat_id' = h1::text and geri_cekildi_at is not null)=1`, 'eski hat bildirimi geri cekilmeli')}
  ${assert(`(select (payload -> 'onaylamayanlar' -> 0 ->> 'hat_id') = h1::text from ${S}.notifications where yayin_id=yb and kind='talimat_rapor' and target_user='${plannerId}')`, 'rapor onaylamayan hat icermeli')}
  j := ${S}.talimat_zamanlayici();
  ${assert(`(j->>'hatirlatma')::int=0 and (j->>'rapor')::int=0`, 'ikinci calismada tekrar gonderdi')}
  ${as('station')}
  n := ${S}.talimat_onayla(p_yayin => yb, p_hat => h1);
  ${su}
  ${assert(`(select durum from ${S}.talimat_yayinlar where yayin_id=yb)='tamamlandi'`, 'yb tamamlandi degil')}
`));

steps.push(step('11.12 talimat_pasif(hat) + kaldir', 'planner', `
  n := ${S}.talimat_pasif('hat', v_plan, array[h2::text], null, null, 'ariza');
  ${assert('n=1', 'pasif hat sayisi')}
  ${assert(`(select bool_and(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and hat_id=h2) and not (select bool_or(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and hat_id=h1)`, 'yalniz h2 pasif')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where plan_id=v_plan and hat_id=h2 order by sira limit 1)='pasif'`, 'etkin_durum pasif')}
  n := ${S}.talimat_pasif_kaldir('hat', v_plan, array[h2::text]);
  ${assert(`n=1 and not (select bool_or(etkin_pasif) from ${S}.talimat_satir_etkin where plan_id=v_plan and hat_id=h2)`, 'hat pasif kaldirilmadi')}
`));
steps.push(expectErr('11.12b pasif hat bulunamadi', 'planner',
  `perform ${S}.talimat_pasif('hat', v_plan, array[gen_random_uuid()::text], null, null, null);`, 'Hat bulunamadı'));

steps.push(step('11.13 talep: birden cok hatta atama + asamalar', 'office', `
  t4 := ${S}.talep_olustur('MKOS41', null, 5, null, 'cok hat');
`));
steps.push(step('11.13b talep_talimata_ata(hat_ids)', 'planner', `
  -- (165) h1 sonunda MKOS41 (r3) varken ayni urun hatta art arda atanamaz: r3 baska hatta alinir
  perform ${hkaydet(`jsonb_build_object('satir_id',r3,'hat_id',hx)`)};
  ids := ${S}.talep_talimata_ata(t4, array[h1, h5]);
  ${assert('cardinality(ids)=2', 'iki satir donmeli')}
  ${assert(`(select count(*) from ${S}.talimat_satirlar where talep_id=t4 and hat_id in (h1,h5) and sku='MKOS41' and istenen_miktar=5 and personel_id is null)=2`, 'iki hat satiri talep ile baglanmali')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t4)='is_emri_verildi'`, 'durum is_emri_verildi')}
  ${assert(`(select jsonb_array_length(asamalar)=2 and bagli_satir_sayisi=2 and atanan_personeller='{}' from ${S}.talep_durum where talep_id=t4)`, 'asamalar / atanan_personeller')}
  ${assert(`(select bool_and(a ->> 'durum' = 'atandi') from ${S}.talep_durum td, jsonb_array_elements(td.asamalar) a where td.talep_id=t4)`, 'tum asamalar atandi')}
  ${assert(`(select asamalar -> 0 ->> 'hat_adi' from ${S}.talep_durum where talep_id=t4)='MONTAJ 1 HATTI' and (select asamalar -> 1 ->> 'tur' from ${S}.talep_durum where talep_id=t4)='paketleme'`, 'asama sirasi/hat adi/tur')}
`));
steps.push(expectErr('11.13c ayni hata ikinci atama', 'planner', `perform ${S}.talep_talimata_ata(t4, array[h1]);`, 'Talep bu hatta zaten atanmış'));
steps.push(expectErr('11.13d hatsiz atama', 'planner', `perform ${S}.talep_talimata_ata(t4, array[]::uuid[]);`, 'Hat seçilmeli'));
steps.push(step('11.13e asama bildirimi: ilk seans (basladi) bir kez', null, `
  ${msIns('H-T-OPEN', 'MKOS41', 'H-T-STEP-1', 'w2', 'h1', { durum: 'montajda' })}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and asama='basladi' and alici_user_id='${plannerId}' and hat_id=h1)=1`, 'basladi bildirimi planlayiciya 1 kez')}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and alici_user_id='${officeId}')=1`, 'talep sahibine de gitmeli')}
  ${assert(`(select ozet like '%MONTAJ 1 HATTI%başladı' from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and alici_user_id='${plannerId}')`, 'ozet metni')}
  ${msIns('H-T-OPEN2', 'MKOS41', 'H-T-STEP-2', 'w5', 'h1', { durum: 'montajda' })}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and asama='basladi' and alici_user_id='${plannerId}')=1`, 'ikinci seans tekrar bildirim uretmemeli')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t4)='hazirlaniyor'`, 'talep hazirlaniyor')}
  ${assert(`(select a ->> 'durum' from ${S}.talep_durum td, jsonb_array_elements(td.asamalar) a where td.talep_id=t4 and a ->> 'tur'='montaj')='basladi'`, 'montaj asamasi basladi')}
`));
steps.push(step('11.13f asama bildirimi: son asama bitince tamamlandi, paketleme -> hazir', null, `
  ${msIns('H-T-FINAL', 'MKOS41', 'H-T-STEP-F', 'w2', 'h1', { qty: 5, final: true })}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and asama='tamamlandi' and alici_user_id='${plannerId}' and hat_id=h1)=1`, 'tamamlandi bildirimi')}
  ${assert(`(select a ->> 'durum' from ${S}.talep_durum td, jsonb_array_elements(td.asamalar) a where td.talep_id=t4 and a ->> 'tur'='montaj')='tamamlandi'`, 'montaj asamasi tamamlandi')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t4)='hazirlaniyor'`, 'paketleme bitmeden talep hazir olmamali')}
  ${peIns('H-T-PACK', 'MKOS41', 'w2', 'h5', { qty: 5 })}
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and asama='tamamlandi' and alici_user_id='${plannerId}' and hat_id=h5)=1`, 'paketleme tamamlandi bildirimi')}
  ${assert(`(select durum from ${S}.talep_durum where talep_id=t4)='hazir'`, 'paketleme bitince talep hazir')}
  ${assert(`(select bool_and(a ->> 'durum' = 'tamamlandi') from ${S}.talep_durum td, jsonb_array_elements(td.asamalar) a where td.talep_id=t4)`, 'tum asamalar tamamlandi')}
  update ${S}.montaj_sessions set durum='tamamlandi', end_time = now() + interval '3 minutes' where session_id in ('H-T-OPEN','H-T-OPEN2');
  ${assert(`(select count(*) from ${S}.talep_bildirimleri where talep_id=t4 and olay='asama' and alici_user_id='${plannerId}')=3`, 'toplam 3 asama bildirimi (basladi, 2x tamamlandi)')}
`));
steps.push(step('11.13g tekrar aktif: asama isaretleri sifirlanir', 'planner', `
  r8 := (select satir_id from ${S}.talimat_satirlar where talep_id=t4 and hat_id=h1);
  ${su}
  -- (test ayni transaction'da: sayac_baslangic = now() oldugundan 'degisme' olusmaz; once sayaci geriye al, sonra isaretleri tekrar yak)
  update ${S}.talimat_satirlar set sayac_baslangic = now() - interval '1 minute' where satir_id = r8;
  update ${S}.talimat_satirlar set asama_basladi_bildirildi = true, asama_tamamlandi_bildirildi = true where satir_id = r8;
  ${as('planner')}
  ${assert(`(select asama_basladi_bildirildi and asama_tamamlandi_bildirildi from ${S}.talimat_satirlar where satir_id=r8)`, 'isaretler dolu olmali')}
  perform ${S}.talimat_satir_yeniden_aktif(r8, 2);
  ${assert(`(select not asama_basladi_bildirildi and not asama_tamamlandi_bildirildi from ${S}.talimat_satirlar where satir_id=r8)`, 'yeniden aktifte isaretler sifirlanmali')}
`));

steps.push(step('11.14 ek_seanslar: hat bilgisi', null, `
  insert into ${S}.montaj_sessions (session_id, sku, step_id, step_name, seq_no, durum, operator_id, operator_name, start_time, end_time, qty, ek_seans, hat_id)
    values ('H-EK-1','LS031','H-EK-STEP','Test adim',1,'tamamlandi',w1,'Test Personel', now() - interval '40 minutes', now() - interval '30 minutes', 2, true, h2);
  ${assert(`(select hat_id=h2 and hat_adi='MONTAJ 2 HATTI' from ${S}.ek_seanslar where session_id='H-EK-1')`, 'ek_seanslar hat_adi')}
`));

steps.push(step('11.15 kopyala_hafta hat satirlarini korur; bos hat satirli hedefe kopyalanir', 'planner', `
  v_plan3 := ${S}.talimat_kopyala_hafta(v_plan, ${S}.talimat_bugun() + 14);
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan3 and hat_id is not null and sku is not null) = (select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id is not null and sku is not null)`, 'dolu hat satiri sayisi')}
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan3 and hat_id=h1 and sku='LS031' and istenen_miktar=10) = 1`, 'h1 satiri korunmali')}
  ${assert(`(select count(distinct hat_id) from ${S}.talimat_satirlar where plan_id=v_plan3 and hat_id in (h1,h2,h3,h4,h5,hx))=6`, 'her aktif hatta satir olmali')}
  v_plan4 := ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun() + 21);
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan4 and sku is null)>=6`, 'yeni plan bos hat satirlariyla gelmeli')}
  v_plan4 := ${S}.talimat_kopyala_hafta(v_plan, ${S}.talimat_bugun() + 21);
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan4 and hat_id is not null and sku is not null) = (select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id is not null and sku is not null)`, 'bos hat satirli hedefe kopya')}
`));

steps.push(step('11.16 talimat_tablet_plan_hat() = yayindaki plan', 'station', `
  ${assert(`${S}.talimat_tablet_plan_hat() = v_plan`, 'tablet plani (hat) yayindaki plan olmali')}
  ${assert(`(select count(*) from ${S}.talimat_hatlar where aktif) >= 6`, 'istasyon hesabi hatlari okuyabilmeli')}
`));

steps.push(step('11.17 pasif satir hattin sonuna, aktif olunca aktiflerin sonuna (163)', 'planner', `
  q1 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h4,'sku','LS031')`)};
  q2 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h4,'sku','LS051')`)};
  q3 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h4,'sku','MKOS41')`)};
  q4 := ${kaydet(`jsonb_build_object('plan_id',v_plan,'hat_id',h4,'sku',other)`)};
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q1) < (select sira from ${S}.talimat_satirlar where satir_id=q2)`, 'baslangic sirasi')}
  n := ${S}.talimat_pasif('satir', v_plan, array[q2::text], null, null, 'sira testi');
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q2) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'pasif satir en alta gitmeli')}
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q3) < (select sira from ${S}.talimat_satirlar where satir_id=q2) and (select sira from ${S}.talimat_satirlar where satir_id=q4) < (select sira from ${S}.talimat_satirlar where satir_id=q2)`, 'aktifler pasifin ustunde')}
  -- kaydet ile ikinci pasif: ilkinin altinda
  perform ${kaydet(`jsonb_build_object('satir_id',q1,'durum','pasif')`)};
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q1) > (select sira from ${S}.talimat_satirlar where satir_id=q2)`, 'ikinci pasif ilkinin altinda')}
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q1) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'ikinci pasif en altta')}
  ${assert(`(select count(distinct sira) = count(*) and min(sira)=1 and max(sira)=count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'sira 1..n tekil')}
  -- en alttaki pasifi aktif et: aktiflerin sonuna, kalan pasifin ustune
  n := ${S}.talimat_pasif_kaldir('satir', v_plan, array[q1::text]);
  ${assert('n=1', 'kaldir sayisi')}
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q1) > (select sira from ${S}.talimat_satirlar where satir_id=q4) and (select sira from ${S}.talimat_satirlar where satir_id=q1) < (select sira from ${S}.talimat_satirlar where satir_id=q2)`, 'aktif olan aktiflerin sonuna, pasifin ustune')}
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q2) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'kalan pasif en altta')}
  -- kaydet ile aktif et
  perform ${kaydet(`jsonb_build_object('satir_id',q2,'durum','aktif')`)};
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q2) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif')`, 'kaydet ile aktif: aktiflerin sonu')}
`));

steps.push(step('11.17b yeniden_aktif_sirali: sona / konuma yerlesir (166)', 'planner', `
  -- varsayilan: aktiflerin sonuna, pasifin ustune
  perform ${S}.talimat_satir_yeniden_aktif(q3, 7);
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q3) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif')`, 'yeniden aktif: aktiflerin sonu')}
  -- konum 1: en uste
  perform ${S}.talimat_satir_yeniden_aktif_sirali(q3, 4, 1);
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q3) = (select min(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif')`, 'konum 1: en ustte')}
  ${assert(`(select istenen_miktar from ${S}.talimat_satirlar where satir_id=q3)=4`, 'istenen yazildi')}
  ${assert(`(select count(distinct sira) = count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'sira tekil')}
`));

steps.push(step('11.18 zamanli pasif/aktif islemleri (164)', 'planner', `
  -- gelecek zamanli pasif: hemen uygulanmaz
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'pasif', now() + interval '1 hour', null, 'zamanli test', null, 'yok', false);
  ${assert(`j->>'durum'='bekliyor' and (select durum from ${S}.talimat_satirlar where satir_id=q4)='aktif'`, 'gelecek islem hemen uygulandi')}
  tid := (j->>'islem_id')::uuid;
  -- zamani gelince zamanlayici (cron baglami: auth yok) uygular
  ${su}
  update ${S}.talimat_zamanli_islemler set calisma_zamani = now() - interval '1 minute' where islem_id = tid;
  j := ${S}.talimat_zamanlayici();
  ${assert(`(j->>'zamanli_islem')::int >= 1`, 'zamanlayici islem calistirmadi')}
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=q4)='pasif' and (select pasif_neden from ${S}.talimat_satirlar where satir_id=q4)='zamanli test'`, 'zamanli pasif uygulanmadi')}
  ${assert(`(select durum from ${S}.talimat_zamanli_islemler where islem_id=tid)='yapildi'`, 'islem yapildi degil')}
  ${assert(`(select sira from ${S}.talimat_satirlar where satir_id=q4) = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'pasif en alta gitmeli')}
  ${as('planner')}
  -- hemen aktif + 1. siraya + bildirimsiz yayin
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'aktif', null, 1, null, null, 'bildirimsiz', false);
  ${assert(`j->>'durum'='yapildi' and (select durum from ${S}.talimat_satirlar where satir_id=q4)='aktif'`, 'hemen aktif olmadi')}
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif' and sira < ${sat('q4')}) = 0`, '1. siraya gitmedi')}
  -- 2. siraya
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'aktif', null, 2, null, null, 'yok', false);
  ${assert(`(select count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif' and sira < ${sat('q4')}) = 1`, '2. siraya gitmedi')}
  ${assert(`(select count(distinct sira) = count(*) and min(sira)=1 and max(sira)=count(*) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4)`, 'sira 1..n tekil degil')}
  -- sona (hedef sira buyuk)
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'aktif', null, 99, null, null, 'yok', false);
  ${assert(`${sat('q4')} = (select max(sira) from ${S}.talimat_satirlar where plan_id=v_plan and hat_id=h4 and durum<>'pasif')`, 'buyuk sira sona gitmedi')}
  -- iptal: zamanlayici calistirmaz
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'pasif', now() + interval '2 hours', null, null, null, 'yok', false);
  tid := (j->>'islem_id')::uuid;
  ${assert(`${S}.talimat_zamanli_islem_iptal(tid)`, 'iptal edilemedi')}
  ${assert(`not ${S}.talimat_zamanli_islem_iptal(tid)`, 'ikinci iptal true dondu')}
  ${su}
  update ${S}.talimat_zamanli_islemler set calisma_zamani = now() - interval '1 minute' where islem_id = tid;
  j := ${S}.talimat_zamanlayici();
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=q4)='aktif' and (select durum from ${S}.talimat_zamanli_islemler where islem_id=tid)='iptal'`, 'iptal edilen calisti')}
  ${as('planner')}
  -- hat kapsami: hemen pasif sonra aktif
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'hat', array[h4::text], 'pasif', null, null, 'hat testi', null, 'yok', false);
  ${assert(`exists (select 1 from ${S}.talimat_pasifler where plan_id=v_plan and kapsam='hat' and hat_id=h4 and iptal_at is null)`, 'hat pasif kaydi yok')}
  j := ${S}.talimat_zamanli_islem_ekle(v_plan, 'hat', array[h4::text], 'aktif', null, null, null, null, 'yok', false);
  ${assert(`not exists (select 1 from ${S}.talimat_pasifler where plan_id=v_plan and kapsam='hat' and hat_id=h4 and iptal_at is null)`, 'hat pasifi kalkmadi')}
`));
steps.push(expectErr('11.19 zamanli islem: planlayici degil', 'station', `perform ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'pasif');`, ''));
steps.push(expectErr('11.20 zamanli islem: dogrudan INSERT yok', 'planner', `insert into ${S}.talimat_zamanli_islemler (plan_id, kapsam, ids, islem) values (v_plan, 'satir', array[q4::text], 'pasif');`, 'permission denied'));
steps.push(expectErr('11.21 zamanli islem: zamanlayici-calistir istemciden cagrilamaz', 'planner', `perform ${S}.talimat_zamanli_islem_calistir(gen_random_uuid());`, 'permission denied'));
steps.push(expectErr('11.22 zamanli islem: gecersiz yayin', 'planner', `perform ${S}.talimat_zamanli_islem_ekle(v_plan, 'satir', array[q4::text], 'pasif', null, null, null, null, 'xyz', false);`, 'Geçersiz yayın'));

// Hat testlerinin ürettiği seansları sonraki (eski personel bazlı) adımları kirletmesin diye 90 gün geriye al / kapat
// ---------------- 11.2x) Hatta art arda aynı ürün yasak (165) ----------------
const aK = (sku, more = '') => hkaydet(`jsonb_build_object('plan_id',v_plan4,'hat_id',h2${sku ? `,'sku','${sku}'` : ''}${more})`);
const simdi = `perform ${S}.talimat_ardisik_simdi();`;
const okRb = (name, body) => expectErr(name, 'planner', `${body}\n  ${simdi}\n  raise exception 'ROLLBACK_OK';`, 'ROLLBACK_OK');
steps.push(expectErr('11.23 ardisik: ayni hatta ayni urun art arda reddedilir', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS031')};
  ${simdi}
`, 'ARDISIK_SKU: LS031 bu hatta arka arkaya verilemez'));
steps.push(okRb('11.23b ardisik: araya baska urun girince ayni urun tekrar verilebilir (A,B,A)', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
`));
steps.push(expectErr('11.23c ardisik: bos satir komsulugu bozmaz (A, bos, A reddedilir)', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK(null)};
  q3 := ${aK('LS031')};
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(expectErr('11.23d ardisik: satir_sil ile yan yana kalan ayni urun (A,B,A -> B silinir)', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('MKOS41')};
  q3 := ${aK('LS031')};
  ${simdi}
  perform ${S}.talimat_satir_sil(q2);
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(expectErr('11.23e ardisik: sirala_hat ile yan yana (A,B,A -> A,A,B)', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  r1 := (select satir_id from ${S}.talimat_satirlar where plan_id=v_plan4 and hat_id=h2 and sku is null limit 1);
  ${simdi}
  perform ${S}.talimat_satir_sirala_hat(v_plan4, h2, array[q1,q3,q2,r1]);
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(okRb('11.23f ardisik: sirala_hat gecerli sira (A,B,C,A) serbest', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  q4 := ${aK('MKOS41')};
  r1 := (select satir_id from ${S}.talimat_satirlar where plan_id=v_plan4 and hat_id=h2 and sku is null limit 1);
  ${simdi}
  perform ${S}.talimat_satir_sirala_hat(v_plan4, h2, array[q1,q2,q4,q3,r1]);
`));
steps.push(expectErr('11.23g ardisik: pasif satir komsulugu bozmaz (A,B pasif,A reddedilir)', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  ${simdi}
  perform ${hkaydet(`jsonb_build_object('satir_id',q2,'durum','pasif')`)};
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(expectErr('11.23h ardisik: tamamlanan satir komsulugu bozmaz (A,B tamamlandi,A reddedilir)', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  ${simdi}
  ${su}
  update ${S}.talimat_satirlar set durum='tamamlandi' where satir_id=q2;
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(okRb('11.23i ardisik: uretimle olusan eski komsuluk, ilgisiz satir duzenlemesini engellemez', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  q4 := ${aK('MKOS41')};
  ${simdi}
  ${su}
  set local session_replication_role = replica;
  update ${S}.talimat_satirlar set durum='tamamlandi' where satir_id=q2;
  set local session_replication_role = origin;
  ${as('planner')}
  perform ${hkaydet(`jsonb_build_object('satir_id',q4,'not_text','ilgisiz not')`)};
`));
steps.push(expectErr('11.24 ardisik: kopyala — komsusu ayni urun olan satir atlanir, digerleri kopyalanir', 'planner', `
  perform ${aK('LS031')};
  -- Kaynak satırlar önceki adımların verisinden bağımsız, boş bir test hattında
  q4 := ${S}.hat_ekle('TEST KAYNAK HATTI', 'montaj');
  r1 := ${hkaydet(`jsonb_build_object('plan_id',v_plan4,'hat_id',q4,'sku','LS031')`)};
  r2 := ${hkaydet(`jsonb_build_object('plan_id',v_plan4,'hat_id',q4,'sku','LS051')`)};
  ids := ${S}.talimat_satirlari_hatta_kopyala(array[r1, r2], h2);
  ${assert('cardinality(ids)=1', 'yalniz LS051 kopyalanmali (LS031 atlanmali)')}
  ${assert(`(select sku from ${S}.talimat_satirlar where satir_id=ids[1])='LS051'`, 'kopyalanan LS051 olmali')}
  ${simdi}
  -- hepsi atlanirsa ARDISIK_SKU
  perform ${S}.talimat_satirlari_hatta_kopyala(array[r1], h2);
`, 'ARDISIK_SKU: Seçilen ürünler'));
steps.push(step('11.25 talep ayni urun icin birden cok kez acilabilir', 'office', `
  t1 := ${S}.talep_olustur('LS031', null, 1, null, 'ardisik-1');
  t2 := ${S}.talep_olustur('LS031', null, 1, null, 'ardisik-2');
  ${assert('t1 <> t2', 'iki talep')}
`));
steps.push(expectErr('11.25b ardisik: talep_talimata_ata ayni urunu art arda atayamaz', 'planner', `
  perform ${aK('LS031')};
  perform ${S}.talep_talimata_ata(t1, array[h2], null, null, false, v_plan4);
  ${simdi}
`, 'ARDISIK_SKU'));
steps.push(okRb('11.25c ardisik: talep_talimata_ata farkli urun komsusuna atanabilir', `
  perform ${aK('LS051')};
  perform ${S}.talep_talimata_ata(t1, array[h2], null, null, false, v_plan4);
`));
steps.push(expectErr('11.26 ardisik: zamanli pasif hemen — ihlal hata verir', 'planner', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  ${simdi}
  perform ${S}.talimat_zamanli_islem_ekle(v_plan4, 'satir', array[q2::text], 'pasif');
`, 'ARDISIK_SKU'));
steps.push(okRb('11.26b ardisik: zamanlayici ihlalde islemi hata yapar, cron cokmez, pasif uygulanmaz', `
  q1 := ${aK('LS031')};
  q2 := ${aK('LS051')};
  q3 := ${aK('LS031')};
  ${simdi}
  j := ${S}.talimat_zamanli_islem_ekle(v_plan4, 'satir', array[q2::text], 'pasif', now() + interval '1 hour');
  tid := (j->>'islem_id')::uuid;
  ${su}
  update ${S}.talimat_zamanli_islemler set calisma_zamani = now() - interval '1 minute' where islem_id = tid;
  j := ${S}.talimat_zamanlayici();
  ${assert(`(select durum='hata' and hata like 'ARDISIK_SKU%' from ${S}.talimat_zamanli_islemler where islem_id=tid)`, 'islem hata olmali')}
  ${assert(`(select durum from ${S}.talimat_satirlar where satir_id=q2)='aktif'`, 'pasif uygulanmamali')}
`));
steps.push(step('11.27 ardisik: oturum sonu — biriken tum degisiklikler denetimden gecer (commit simulasyonu)', null, `
  ${simdi}
`));

steps.push(step('11.99 hat test seanslari temizlik (kapat + zamani geriye al)', null, `
  update ${S}.montaj_sessions set durum='tamamlandi', end_time = coalesce(end_time, start_time) where session_id like 'H-%' and durum='montajda';
  update ${S}.montaj_sessions set start_time = start_time - interval '90 days', end_time = end_time - interval '90 days' where session_id like 'H-%';
  update ${S}.pack_events set durum='tamamlandi', end_time = coalesce(end_time, start_time) where session_id like 'H-%' and durum='paketlemede';
  update ${S}.pack_events set tarih = tarih - interval '90 days', start_time = start_time - interval '90 days', end_time = end_time - interval '90 days' where session_id like 'H-%';
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

// ---------------- 10) sayac sifirla (tekrar aktif et) ----------------
steps.push(step('10.1 satir_yeniden_aktif: sayac sifirlanir, uretilen yeniden sayilir', 'planner', `
  v_plan2 := ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun());
  s9 := ${kaydet(`jsonb_build_object('plan_id',v_plan2,'personel_id',w1,'istasyon','montaj','sku','LS031','istenen_miktar',5)`)};
  ${su}
  -- 156: sayaç talimatın verildiği an başlar; satırı 10 dk önce verilmiş gibi göster
  update ${S}.talimat_satirlar set sayac_baslangic = now() - interval '10 minutes' where satir_id = s9;
  insert into ${S}.montaj_sessions (session_id, sku, step_id, step_name, seq_no, durum, operator_id, operator_name, start_time, end_time, qty, is_final_step)
    values ('TEST-SY-M1','LS031','TEST-STEP','Test adim',1,'tamamlandi',w1,'Test Personel', now() - interval '3 minutes', now() - interval '2 minutes', 5, true);
  ${as('planner')}
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=s9)=5`, 'baslangic uretilen 5 degil')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=s9)='tamamlandi'`, 'tamamlandi degil')}
  perform ${S}.talimat_satir_yeniden_aktif(s9, 3);
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=s9)=0`, 'sayac sonrasi uretilen 0 degil')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=s9)='aktif'`, 'aktif degil')}
  ${assert(`(select istenen_miktar from ${S}.talimat_satirlar where satir_id=s9)=3 and (select sayac_baslangic from ${S}.talimat_satirlar where satir_id=s9) is not null`, 'istenen/sayac yazilmadi')}
  ${su}
  insert into ${S}.montaj_sessions (session_id, sku, step_id, step_name, seq_no, durum, operator_id, operator_name, start_time, end_time, qty, is_final_step)
    values ('TEST-SY-M2','LS031','TEST-STEP','Test adim',1,'tamamlandi',w1,'Test Personel', now() + interval '1 minute', now() + interval '2 minutes', 3, true);
  ${as('planner')}
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=s9)=3`, 'yeni uretim sayilmadi')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=s9)='tamamlandi'`, 'yeniden tamamlanmadi')}
  ${assert(`(select coalesce(sum(qty),0) from ${S}.talimat_satir_katki where satir_id=s9)=3`, 'katki sayactan baslamiyor')}
`));
steps.push(expectErr('10.2 satir_yeniden_aktif: miktar > 0 olmali', 'planner', `perform ${S}.talimat_satir_yeniden_aktif(s9, 0);`, 'Geçerli bir istenen miktar'));
steps.push(expectErr('10.3 satir_yeniden_aktif: planlayici degil', 'station', `perform ${S}.talimat_satir_yeniden_aktif(s9, 4);`, ''));
steps.push(expectErr('10.4 satir_yeniden_aktif: pasif plan', 'planner', `perform ${S}.talimat_satir_yeniden_aktif(s7, 4);`, 'PLAN_PASIF'));
steps.push(step('10.5 talimattan once kapanan uretim sayilmaz (156)', 'planner', `
  v_plan2 := ${S}.talimat_plan_getir_veya_olustur(${S}.talimat_bugun());
  ${su}
  insert into ${S}.pack_events (session_id, tarih, sku, qty, durum, start_time, end_time, operator_id, operator_name)
    values ('TEST-SY-P0', now() - interval '20 minutes', 'MKOS41', 125, 'tamamlandi', now() - interval '20 minutes', now() - interval '8 minutes', w2, 'Test Personel');
  ${as('planner')}
  s10 := ${kaydet(`jsonb_build_object('plan_id',v_plan2,'personel_id',w2,'istasyon','paketleme','sku','MKOS41','istenen_miktar',100)`)};
  ${assert(`(select uretilen from ${S}.talimat_satir_ilerleme where satir_id=s10)=0`, 'talimattan onceki uretim sayildi')}
  ${assert(`(select etkin_durum from ${S}.talimat_satir_ilerleme where satir_id=s10)='aktif'`, 'aktif degil')}
`));

const body = `
declare
  v_plan uuid; v_plan2 uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid; s8 uuid; s9 uuid; s10 uuid;
  y1 uuid; y2 uuid; y3 uuid; y4 uuid; y5 uuid; y6 uuid; t1 uuid; t2 uuid; t3 uuid; tid uuid;
  h1 uuid; h2 uuid; h3 uuid; h4 uuid; h5 uuid; hx uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; r7 uuid; r8 uuid; q1 uuid; q2 uuid; q3 uuid; q4 uuid;
  ids uuid[]; ya uuid; yb uuid; t4 uuid; v_plan3 uuid; v_plan4 uuid; rec record;
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
