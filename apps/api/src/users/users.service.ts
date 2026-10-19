import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.module";
import { TenantLimitsService } from "../tenant-limits/tenant-limits.service";
import type { CreateUserInput, UpdateUserStatusInput } from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const BCRYPT_ROUNDS = 12;

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantLimitsService) private readonly limits: TenantLimitsService,
  ) {}

  async list(auth: AuthContext) {
    return this.prisma.user.findMany({
      where: { companyId: auth.companyId },
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(auth: AuthContext, input: CreateUserInput) {
    await this.limits.assertCanCreate(auth.companyId, "user");

    // E-mail é único em TODO o sistema (auditoria bloco 2). A RLS esconde as
    // outras empresas desta conexão, então a checagem global usa a função
    // `user_email_in_use` (SECURITY DEFINER, só devolve sim/não) e o índice
    // único `User_email_key` garante contra corrida (P2002 → 409).
    const [{ in_use: inUse }] = await this.prisma.$queryRaw<Array<{ in_use: boolean }>>`
      SELECT user_email_in_use(${input.email}) AS in_use`;
    if (inUse) {
      throw new ConflictException("Este e-mail já está em uso no Akylla Gestão");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          companyId: auth.companyId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        },
        select: userSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Este e-mail já está em uso no Akylla Gestão");
      }
      throw error;
    }
  }

  async updateStatus(auth: AuthContext, userId: string, input: UpdateUserStatusInput) {
    if (userId === auth.userId && input.status === "INACTIVE") {
      throw new ForbiddenException("Você não pode inativar sua própria conta");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: auth.companyId },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: input.status },
      select: userSelect,
    });

    if (input.status === "INACTIVE") {
      await this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  /**
   * Fase 8 (auditoria): o administrador gera uma senha provisória para alguém
   * da equipe que esqueceu a senha (funciona sem e-mail configurado). Derruba
   * as sessões do usuário. A própria senha se troca em Minha conta.
   */
  async resetPassword(auth: AuthContext, userId: string): Promise<{ temporaryPassword: string }> {
    if (userId === auth.userId) {
      throw new ForbiddenException("Para a sua própria senha, use Minha conta");
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    const temporaryPassword = `Akylla-${randomBytes(9).toString("base64url")}`;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS) },
      }),
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { temporaryPassword };
  }
}
