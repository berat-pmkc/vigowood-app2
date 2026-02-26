-- Fix: user_id UUID → TEXT (users.user_id is TEXT like VW006)
ALTER TABLE public.agent_chats ALTER COLUMN user_id TYPE TEXT;
