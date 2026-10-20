import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminGuard } from "../moderation/admin.guard";
import { PostsModule } from "../posts/posts.module";
import { PushModule } from "../push/push.module";
import { StorageModule } from "../storage/storage.module";
import { AdminGroupsController, GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";

/** Groups: forums around a place or an interest, and their discussions. */
@Module({
  imports: [AuthModule, StorageModule, PostsModule, PushModule],
  controllers: [GroupsController, AdminGroupsController],
  providers: [GroupsService, AdminGuard],
})
export class GroupsModule {}
