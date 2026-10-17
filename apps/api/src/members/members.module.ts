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

/** Members directory, public profiles and the follow graph. */
@Module({
  imports: [AuthModule, StorageModule, PostsModule, PushModule],
  controllers: [
    FriendshipsController,
    MembersController,
    FollowsController,
    PublicProfilesController,
  ],
  providers: [MembersService, FollowsService, FriendshipsService],
})
export class MembersModule {}
