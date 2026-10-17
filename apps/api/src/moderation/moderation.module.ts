import { AdminPostsService } from "./admin-posts.service";
import { AdminPostsController } from "./admin-posts.controller";
import { Global, Module } from "@nestjs/common";
import { PostsModule } from "../posts/posts.module";
import { SafetyModule } from "../safety/safety.module";
import { VerificationModule } from "../verification/verification.module";
import { AdminGuard } from "./admin.guard";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { SignupGuardService } from "./signup-guard.service";

/** Global because sign-up (auth) and verification codes (otp) both consult the guard. */
@Global()
@Module({
  imports: [PostsModule, SafetyModule, VerificationModule],
  controllers: [ModerationController, AdminPostsController],
  providers: [SignupGuardService, ModerationService, AdminGuard, AdminPostsService],
  exports: [SignupGuardService],
})
export class ModerationModule {}
