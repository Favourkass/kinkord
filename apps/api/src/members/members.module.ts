import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PostsModule } from "../posts/posts.module";
import { StorageModule } from "../storage/storage.module";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { PublicProfilesController } from "./public-profiles.controller";

/** Members directory, public profiles and the follow graph. */
@Module({
  imports: [AuthModule, StorageModule, PostsModule],
  controllers: [MembersController, FollowsController, PublicProfilesController],
  providers: [MembersService, FollowsService],
})
export class MembersModule {}
