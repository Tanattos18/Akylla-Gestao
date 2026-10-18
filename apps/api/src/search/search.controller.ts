import { Controller, Get, Inject, Query } from "@nestjs/common";
import { globalSearchQuerySchema, type GlobalSearchQuery } from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SearchService } from "./search.service";

const queryPipe = new ZodValidationPipe(globalSearchQuerySchema);

@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  search(@Auth() auth: AuthContext, @Query(queryPipe) query: GlobalSearchQuery) {
    return this.searchService.search(auth, query.q);
  }
}
