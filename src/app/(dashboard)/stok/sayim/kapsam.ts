/**
 * Sayım kapsam seçenekleri.
 *
 * Bu sabit bilerek actions.ts'te DEĞİL. O dosya "use server" ile başlıyor ve
 * Next.js böyle bir dosyadaki HER export'u sunucu fonksiyonu referansına
 * çeviriyor. Sabit oradan dışa aktarıldığında istemciye dizi olarak değil
 * fonksiyon olarak geliyor ve .map çağrısı "g.map is not a function" hatası
 * veriyordu.
 */
export const KAPSAM_SECENEKLERI = [
  { deger: "YARIMAMUL", etiket: "Yarı mamül (kesilmiş parçalar)" },
  { deger: "HAZIR", etiket: "Hazır eleman (menteşe, vida, mıknatıs)" },
  { deger: "KUTU", etiket: "Kutu" },
  { deger: "KARTON", etiket: "Karton" },
  { deger: "MAMUL", etiket: "Mamül (bitmiş ürün)" },
] as const;
