/**
 * Veritabanı şeması (Postgres schema). Ortak Supabase projesinde uygulama
 * `vigowood` şemasında çalışır; ayarlanmazsa eski davranış (`public`).
 * Tip tanımları "public" anahtarına bağlı kalır, bu yüzden client'larda
 * `DB_SCHEMA as "public"` cast'i kullanılır.
 */
export const DB_SCHEMA: string = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public";

/** Storage bucket adları: public şemada eski adlar, aksi halde şema önekli. */
export const BUCKET_TASK_ATTACHMENTS: string =
  DB_SCHEMA === "public" ? "task-attachments" : `${DB_SCHEMA}-task-attachments`;
export const BUCKET_USER_AVATARS: string =
  DB_SCHEMA === "public" ? "user-avatars" : `${DB_SCHEMA}-user-avatars`;

/** Auth user_metadata anahtarları (ortak auth: VigoWood öneki). */
export const META_OPERATOR_ID = "vw_selected_operator_id";
export const META_OPERATOR_NAME = "vw_selected_operator_name";

type MetaLike = Record<string, unknown> | null | undefined;

/** Seçili operatör ID'si (yeni anahtar, yoksa eski anahtar). */
export function readOperatorId(meta: MetaLike): string | undefined {
  return (meta?.[META_OPERATOR_ID] ?? meta?.selected_operator_id) as string | undefined;
}
export function readOperatorName(meta: MetaLike): string | undefined {
  return (meta?.[META_OPERATOR_NAME] ?? meta?.selected_operator_name) as string | undefined;
}
