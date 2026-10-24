import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createDeliverySchema,
  listDeliveriesQuerySchema,
  updateDeliverySchema,
  type CreateDeliveryInput,
  type ListDeliveriesQuery,
  type UpdateDeliveryInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DeliveriesService } from "./deliveries.service";

const listQueryPipe = new ZodValidationPipe(listDeliveriesQuerySchema);

@Controller("deliveries")
export class DeliveriesController {
  constructor(@Inject(DeliveriesService) private readonly deliveriesService: DeliveriesService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListDeliveriesQuery) {
    return this.deliveriesService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.deliveriesService.get(auth, id);
  }

  @Get(":id/checks")
  checks(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.deliveriesService.siteChecks(auth, id);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createDeliverySchema)) body: CreateDeliveryInput,
  ) {
    return this.deliveriesService.create(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDeliverySchema)) body: UpdateDeliveryInput,
  ) {
    return this.deliveriesService.update(auth, id, body);
  }
}

/** Aba Histórico da ficha do cliente. */
@Controller("clients")
export class ClientHistoryController {
  constructor(@Inject(DeliveriesService) private readonly deliveriesService: DeliveriesService) {}

  @Get(":id/history")
  history(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.deliveriesService.clientHistory(auth, id);
  }
}
