import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { applyOnboardingSchema, type ApplyOnboardingInput } from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OnboardingService } from "./onboarding.service";

const applyPipe = new ZodValidationPipe(applyOnboardingSchema);

@Controller("onboarding")
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly onboarding: OnboardingService) {}

  @Get("presets")
  presets() {
    return this.onboarding.listPresets();
  }

  @Get("status")
  status(@Auth() auth: AuthContext) {
    return this.onboarding.status(auth);
  }

  @Post("apply")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  apply(@Auth() auth: AuthContext, @Body(applyPipe) body: ApplyOnboardingInput) {
    return this.onboarding.apply(auth, body);
  }
}
