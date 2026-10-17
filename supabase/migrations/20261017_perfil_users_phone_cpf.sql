-- Perfil: telefone + CPF (+ display_name opcional)
-- Projeto: zlzgkivktvnyvehjwcjw only

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS display_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_cpf_format'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_cpf_format
      CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_len'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_phone_len
      CHECK (phone IS NULL OR char_length(phone) BETWEEN 8 AND 20);
  END IF;
END $$;
