import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ProductsModule } from "./products/products.module";
import { StockModule } from "./stock/stock.module";
import { SalesModule } from "./sales/sales.module";
import { CashModule } from "./cash/cash.module";
import { FinancialModule } from "./financial/financial.module";
import { ClientsModule } from "./clients/clients.module";
import { PetsModule } from "./pets/pets.module";
import { ServicesModule } from "./services/services.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { BillingModule } from "./billing/billing.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { ReportsModule } from "./reports/reports.module";
import { CompanyModulesModule } from "./company-modules/company-modules.module";
import { CompanyModule } from "./company/company.module";
import { ImportsModule } from "./imports/imports.module";
import { LgpdModule } from "./lgpd/lgpd.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { CreditModule } from "./credit/credit.module";
import { AuthGuard } from "./common/guards/auth.guard";
import { ModuleGuard } from "./common/guards/module.guard";
import { TenantContextInterceptor } from "./common/tenant/tenant-context.interceptor";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SuppliersModule,
    ProductsModule,
    StockModule,
    SalesModule,
    CommissionsModule,
    CreditModule,
    CashModule,
    FinancialModule,
    ClientsModule,
    PetsModule,
    ServicesModule,
    AppointmentsModule,
    SubscriptionsModule,
    BillingModule,
    WhatsAppModule,
    ReportsModule,
    CompanyModulesModule,
    CompanyModule,
    ImportsModule,
    LgpdModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
