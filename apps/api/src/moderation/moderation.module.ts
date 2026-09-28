import { Global, Module } from "@nestjs/common";
import { PostsModule } from "../posts/posts.module";
import { AdminGuard } from "./admin.guard";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { SignupGuardService } from "./signup-guard.service";

/** Global because sign-up (auth) and verification codes (otp) both consult the guard. */
@Global()
@Module({
  imports: [PostsModule],
  controllers: [ModerationController],
  providers: [SignupGuardService, ModerationService, AdminGuard],
  exports: [SignupGuardService],
})
export class ModerationModule {}
