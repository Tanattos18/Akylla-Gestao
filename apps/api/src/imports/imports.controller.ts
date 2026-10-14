import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  importTemplateQuerySchema,
  importUploadFormSchema,
  listImportsQuerySchema,
  type ImportTemplateQuery,
  type ImportUploadForm,
  type ListImportsQuery,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { IMPORT_MAX_FILE_BYTES, ImportsService } from "./imports.service";

const templatePipe = new ZodValidationPipe(importTemplateQuerySchema);
const uploadFormPipe = new ZodValidationPipe(importUploadFormSchema);
const listPipe = new ZodValidationPipe(listImportsQuerySchema);

@Controller("imports")
export class ImportsController {
  constructor(
    @Inject(ImportsService) private readonly imports: ImportsService,
  ) {}

  @Get("template")
  @UseGuards(AdminGuard)
  template(
    @Query(templatePipe) query: ImportTemplateQuery,
    @Res({ passthrough: true }) res: Response,
  ): string {
    const { csv, filename } = this.imports.template(query.type);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    return csv;
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: IMPORT_MAX_FILE_BYTES } }),
  )
  upload(
    @Auth() auth: AuthContext,
    @Body(uploadFormPipe) body: ImportUploadForm,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.upload(auth, body.type, body.dryRun, file);
  }

  @Get()
  @UseGuards(AdminGuard)
  list(@Auth() auth: AuthContext, @Query(listPipe) query: ListImportsQuery) {
    return this.imports.list(auth, query);
  }
}
