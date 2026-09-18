import { Module } from "@nestjs/common";
import { PostInteractionsService } from "./post-interactions.service";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostInteractionsService],
  // MembersModule reads post counts and post media through the same visibility
  // rule rather than writing its own copy of it.
  exports: [PostsService],
})
export class PostsModule {}
