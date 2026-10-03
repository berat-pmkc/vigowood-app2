// Smoke test for the kalite RPCs on a migrated schema. Everything runs inside one transaction
// that is always rolled back (the DO block raises at the end), so no data is left behind.
// Usage: node scripts/migrate/test-kalite.mjs --schema vigowood_prova [--sku LS031]
import { parseArgs, guardSchema, context, log, ql, qi } from './lib.mjs';

const args = parseArgs();
const schema = guardSchema(args.schema);
const sku = args.sku || 'LS031';
const ctx = context();
const S = qi(schema);

const [admin] = await ctx.tgt(
  `select auth_id::text from ${S}.users where user_id = 'VW006' and auth_id is not null`, { readOnly: true });
if (!admin) throw new Error('VW006 has no auth_id; run auth-merge first');

const claims = JSON.stringify({ sub: admin.auth_id, role: 'authenticated' });
const q = `
begin;
set local search_path = ${S}, extensions;
select set_config('request.jwt.claims', ${ql(claims)}, true);
set local role authenticated;
do $t$
declare
  r jsonb; parts jsonb; n int; b numeric; ym_before numeric; ym_after numeric; first_part text; out text := '';
begin
  -- 1) uygunsuz ürün girişi (stoktan düşmeden)
  r := ${S}.kalite_uygunsuz_giris('URUN', ${ql(sku)}, 2, 'paketleme', false, null, null, 'TEST', 'Test', null, null, 'smoke');
  out := out || 'uygunsuz_giris=' || r::text || E'\\n';
  select uygunsuz_bakiye into b from ${S}.kalite_bakiye where item_tipi='URUN' and item_id=${ql(sku)};
  out := out || 'bakiye_after_giris=' || coalesce(b::text,'null') || E'\\n';

  -- 2) BOM patlatma
  select count(*), min(part_id) into n, first_part from ${S}.urun_yari_mamul_listesi(${ql(sku)}) where part_type='YARIMAMUL';
  out := out || 'bom_yarimamul_parca=' || n || ' first=' || coalesce(first_part,'-') || E'\\n';
  select coalesce(yari_mamul_stok,0) into ym_before from ${S}.all_parts where part_id = first_part;

  -- 3) söküm: ilk YM parçası tamamen sağlam, diğerleri girilmez (uygunsuz YM'ye gitmeli)
  select jsonb_agg(jsonb_build_object('part_id', part_id, 'saglam', case when part_id=first_part then qty_per else 0 end, 'fire', 0))
    into parts from ${S}.urun_yari_mamul_listesi(${ql(sku)});
  r := ${S}.kalite_sokum(${ql(sku)}, 1, parts, 'TEST', 'Test', 'smoke');
  out := out || 'sokum=' || r::text || E'\\n';
  select coalesce(yari_mamul_stok,0) into ym_after from ${S}.all_parts where part_id = first_part;
  out := out || 'ym_stok ' || first_part || ': ' || ym_before || ' -> ' || ym_after || E'\\n';
  select count(*) into n from ${S}.kalite_bakiye where item_tipi='YARI_MAMUL' and uygunsuz_bakiye > 0;
  out := out || 'uygunsuz_ym_kalem=' || n || E'\\n';

  -- 4) kalan 1 adet uygun -> stoğa
  r := ${S}.kalite_kontrol_uygun('URUN', ${ql(sku)}, 1, 'YURTICI', 'TEST', 'Test', 'smoke');
  out := out || 'kontrol_uygun=' || r::text || E'\\n';
  select uygunsuz_bakiye into b from ${S}.kalite_bakiye where item_tipi='URUN' and item_id=${ql(sku)};
  out := out || 'bakiye_final=' || coalesce(b::text,'null') || E'\\n';

  -- 5) bakiye kontrolü: fazla söküm reddedilmeli
  begin
    r := ${S}.kalite_sokum(${ql(sku)}, 5, '[]'::jsonb, 'TEST', 'Test', 'smoke');
    out := out || 'fazla_sokum=KABUL EDILDI (HATA)' || E'\\n';
  exception when others then
    out := out || 'fazla_sokum=reddedildi (' || sqlerrm || ')' || E'\\n';
  end;

  raise exception 'TEST_SONUCU%', E'\\n' || out;
end $t$;
rollback;`;

try {
  await ctx.tgt(q, { label: 'kalite smoke test' });
  log('Unexpected: test block did not raise.');
} catch (e) {
  const m = String(e.message);
  const i = m.indexOf('TEST_SONUCU');
  log(i >= 0 ? m.slice(i + 11).replace(/\\n/g, '\n') : m);
}
