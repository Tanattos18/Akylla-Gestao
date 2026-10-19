-- Auditoria (bloco 2): e-mail de usuário único em TODO o sistema (login é
-- por e-mail; e-mail repetido em outra empresa permitia confusão e até se
-- passar pelo dono da plataforma). Antes de criar o índice, interrompe com
-- mensagem clara se já houver duplicados (nada é apagado automaticamente).
SET LOCAL app.rls_bypass = 'on';

DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(e, ', ') INTO dup FROM (
    SELECT lower(email) AS e FROM "User" GROUP BY lower(email) HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'E-mails de usuário duplicados entre empresas: %. Ajuste antes de atualizar.', dup;
  END IF;
END $$;

UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Contas criadas pela linha de comando (dono e demonstração; empresas
-- isentas) passam a contar como e-mail verificado — o painel da plataforma
-- exige e-mail verificado.
UPDATE "User" u SET "emailVerifiedAt" = u."createdAt"
FROM "Company" c
WHERE u."companyId" = c."id" AND c."billingExempt" = true AND u."emailVerifiedAt" IS NULL;

-- Checagem global de e-mail para rotas autenticadas (a RLS esconde as outras
-- empresas). Só responde sim/não; liga o bypass apenas durante a consulta e
-- devolve o valor anterior antes de sair (inclusive em erro).
CREATE OR REPLACE FUNCTION user_email_in_use(p_email text) RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  previous text := coalesce(current_setting('app.rls_bypass', true), '');
  found boolean;
BEGIN
  PERFORM set_config('app.rls_bypass', 'on', true);
  SELECT EXISTS (SELECT 1 FROM "User" WHERE "email" = lower(trim(p_email))) INTO found;
  PERFORM set_config('app.rls_bypass', previous, true);
  RETURN found;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.rls_bypass', previous, true);
  RAISE;
END $$;
