import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.module";

/** Tempo máximo da checagem do banco antes de responder 503. */
const READY_DB_TIMEOUT_MS = 2000;

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Liveness: o processo responde (não toca no banco). */
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "petflow-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * Readiness (Fase 1 · 1B): processo + banco. É a URL monitorada pelo
   * UptimeRobot (docs/operations/RUNBOOK.md). Banco fora → 503, sem
   * detalhes internos na resposta.
   */
  @Get("ready")
  async getReady() {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), READY_DB_TIMEOUT_MS);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException({ status: "unavailable", database: "down" });
    } finally {
      clearTimeout(timer);
    }
    return {
      status: "ok",
      service: "petflow-api",
      database: "ok",
      databaseLatencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
  }
}
