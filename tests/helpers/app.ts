import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type request from "supertest";
import { AppModule } from "../../apps/api/src/app.module";
import { configureHttp } from "../../apps/api/src/common/bootstrap/configure-http";
import { PrismaService } from "../../apps/api/src/prisma/prisma.module";

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  configureHttp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  // Fase 3: documento fiscal referencia venda/OS/usuário
  await prisma.fiscalDocument.deleteMany();
  await prisma.fiscalConfig.deleteMany();
  // Fase 2 · 2.3: comissão/itens/anexos referenciam a OS; OS referencia cliente
  await prisma.commission.deleteMany();
  await prisma.serviceOrderAttachment.deleteMany();
  await prisma.serviceOrderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  // Fase 2 · 2.2: parcela referencia venda/conta; conta referencia cliente
  await prisma.creditInstallment.deleteMany();
  await prisma.creditAccount.deleteMany();
  // Fase 2 · 2.1: comissão referencia venda/profissional (Restrict)
  await prisma.commission.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.whatsAppWebhookEvent.deleteMany();
  await prisma.whatsAppMessageAttempt.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.whatsAppConsent.deleteMany();
  // config referencia template via reminderTemplateId (FK) — apagar antes
  await prisma.whatsAppConfig.deleteMany();
  await prisma.whatsAppTemplate.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  // appointment referencia client/service e users (FK Restrict); Pet é tabela legada
  await prisma.appointment.deleteMany();
  // subscription referencia client/plan/users; cashMovement referencia subscription (SetNull)
  await prisma.subscription.deleteMany();
  // Transformação 2026-10-23: entrega referencia cliente/produto digital (Restrict)
  await prisma.credentialAccessLog.deleteMany();
  await prisma.deliveryCredential.deleteMany();
  await prisma.siteCheck.deleteMany();
  await prisma.clientDelivery.deleteMany();
  await prisma.digitalProduct.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.session.deleteMany();
  // financialEntry referencia users/company (Restrict) e client/supplier/category/cashMovement (SetNull)
  await prisma.financialEntry.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.legalConsent.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  // Fase 8: pagamentos da plataforma referenciam a empresa
  await prisma.platformPayment.deleteMany();
  await prisma.companyModule.deleteMany();
  // venda referencia profissional (Restrict) — vendas já foram apagadas acima
  await prisma.professional.deleteMany();
  await prisma.company.deleteMany();
}

export function sessionCookieFrom(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const session = list.find((cookie) => cookie.startsWith("petflow_session="));
  if (!session) {
    throw new Error("Cookie de sessÃ£o nÃ£o retornada na resposta");
  }
  return session.split(";")[0];
}

export function clearCookieHeader(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const session = list.find((cookie) => cookie.startsWith("petflow_session="));
  if (!session) {
    throw new Error("Limpeza de cookie nÃ£o retornada na resposta");
  }
  return session.split(";")[0];
}
