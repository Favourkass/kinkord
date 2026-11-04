import { FriendshipsController } from "./friendships.controller";
import { FriendshipsService } from "./friendships.service";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PostsModule } from "../posts/posts.module";
import { PushModule } from "../push/push.module";
import { StorageModule } from "../storage/storage.module";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { PublicProfilesController } from "./public-profiles.controller";
import { TeamPageAdminController } from "./team-page-admin.controller";
import { TeamPageService } from "./team-page.service";
import { TeamController } from "./team.controller";

/** Members directory, public profiles, the follow graph and Meet the Team. */
@Module({
  imports: [AuthModule, StorageModule, PostsModule, PushModule],
  controllers: [
    FriendshipsController,
    MembersController,
    FollowsController,
    PublicProfilesController,
    TeamController,
    TeamPageAdminController,
  ],
  providers: [MembersService, FollowsService, FriendshipsService, TeamPageService],
})
export class MembersModule {}
