import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createDigitalProductSchema,
  listDigitalProductsQuerySchema,
  updateDigitalProductSchema,
  updateRecordStatusSchema,
  type CreateDigitalProductInput,
  type ListDigitalProductsQuery,
  type UpdateDigitalProductInput,
  type UpdateRecordStatusInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DigitalProductsService } from "./digital-products.service";

const listQueryPipe = new ZodValidationPipe(listDigitalProductsQuerySchema);

@Controller("digital-products")
export class DigitalProductsController {
  constructor(@Inject(DigitalProductsService) private readonly productsService: DigitalProductsService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListDigitalProductsQuery) {
    return this.productsService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.productsService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createDigitalProductSchema)) body: CreateDigitalProductInput,
  ) {
    return this.productsService.create(auth, body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDigitalProductSchema)) body: UpdateDigitalProductInput,
  ) {
    return this.productsService.update(auth, id, body);
  }

  @Patch(":id/status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.productsService.updateStatus(auth, id, body);
  }
}
