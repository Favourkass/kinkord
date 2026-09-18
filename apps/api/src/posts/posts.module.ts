import { Module } from "@nestjs/common";
import { PostInteractionsService } from "./post-interactions.service";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostInteractionsService],
})
export class PostsModule {}
