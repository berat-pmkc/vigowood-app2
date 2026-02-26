-- task_comments.author_id FK kaldır
-- Agent'lar (ops_agents) yorum yazabilmesi için users tablosuna FK gereksiz
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'task_comments_author_id_fkey'
      AND table_name = 'task_comments'
  ) THEN
    ALTER TABLE public.task_comments DROP CONSTRAINT task_comments_author_id_fkey;
  END IF;
END
$$;
