import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Provedores (Render, Railway…) informam a porta em PORT (Fase 1 · 1G)
  API_PORT: z.coerce.number().int().default(Number(process.env.PORT) || 3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  AUTH_COOKIE_NAME: z.string().default("petflow_session"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().nonnegative().default(5),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(15 * 60 * 1000),
  // Cadastro aberto (N4 · 1.6): limite dedicado por IP, mais restritivo.
  // Padrão generoso em dev/teste; em produção, configure 3/hora no .env.
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().nonnegative().default(20),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60 * 60 * 1000),
  // Rate limit distribuído (N4 · 1.3): reservado para o store Redis em
  // produção multi-instância. Ausente = store em memória (comportamento atual).
  REDIS_URL: z.string().optional(),
  // Redefinição de senha pelo painel (/redefinir-senha) — desabilitada por
  // padrão; habilitar apenas em ambiente local/controllado (sem verificação
  // por token de e-mail nesta versão)
  PASSWORD_RESET_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  // Cadastro aberto (/cadastro) — cria empresa nova + administrador.
  // Desabilitado por padrão; habilitar apenas onde o registro público for
  // desejado (local/controllado; sem verificação anti-abuso nesta versão)
  REGISTRATION_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  APP_ORIGINS: z.string().default("http://localhost:3000"),
  // WhatsApp (Etapa 6) — segredos somente aqui, nunca no frontend/Git
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/, "Código do país inválido").default("55"),
  // Mercado Pago (Etapa 11) — sandbox por padrão; segredos somente no servidor
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  // Monitoramento (Fase 1 · 1B) — Sentry desligado sem DSN. O DSN não é
  // segredo forte, mas fica só no .env do servidor.
  SENTRY_DSN: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  // E-mail transacional (Fase 1 · 1D) — SMTP via nodemailer. Sem SMTP_HOST,
  // os e-mails vão só para o log (dev/teste).
  SMTP_HOST: z.string().optional().transform((v) => v || undefined),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional().transform((v) => v || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().default("Akylla Gestão <no-reply@akyllagestao.com.br>"),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  // Captcha opcional no cadastro (Fase 1 · 1D) — Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: z.string().optional().transform((v) => v || undefined),
  // Fase 3 — fiscal: chave de cifra dos segredos (32 bytes em hex = 64
  // caracteres) e segredo do webhook da emissora (HMAC). Sem a chave, a
  // API recusa gravar token/certificado (nunca grava em claro).
  FISCAL_ENCRYPTION_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || /^[0-9a-fA-F]{64}$/.test(v), "FISCAL_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)"),
  FISCAL_WEBHOOK_SECRET: z.string().optional().transform((v) => v || undefined),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (value.AUTH_COOKIE_SECURE !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_COOKIE_SECURE"],
      message:
        "Em produção, AUTH_COOKIE_SECURE deve ser true (cookie de sessão seguro via HTTPS)",
    });
  }

  if (value.PASSWORD_RESET_ENABLED === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PASSWORD_RESET_ENABLED"],
      message:
        "Em produção, a redefinição de senha sem token de e-mail é insegura. Mantenha desabilitado ou implemente fluxo com token.",
    });
  }

  // Fase 1 · 1D: o cadastro aberto exige verificação de e-mail, que só
  // funciona com envio real — sem SMTP o link ficaria só no log.
  if (value.REGISTRATION_ENABLED === true && !value.SMTP_HOST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SMTP_HOST"],
      message:
        "Em produção, o cadastro aberto exige SMTP configurado (SMTP_HOST) para enviar a confirmação de e-mail.",
    });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração da API inválida:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.APP_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
