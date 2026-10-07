-- 155: Ardışık SKU kuralı kaldırıldı — aynı personelde art arda aynı ürün serbest.
-- (Aynı personelin plana iki kez eklenmemesi kuralı istemcide kalır.)
-- talimat_ardisik_dogrula() RPC'lerden (kaydet/sil/sirala/ata/yeniden aktif) çağrılmaya devam eder,
-- ancak artık hiçbir şey doğrulamaz; böylece fonksiyon gövdeleri aynen kalır.
DROP TRIGGER IF EXISTS trg_talimat_ardisik ON public.talimat_satirlar;

CREATE OR REPLACE FUNCTION public.talimat_ardisik_dogrula(p_plan UUID, p_personel TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN; -- kural kaldırıldı (155)
END;
$$;
