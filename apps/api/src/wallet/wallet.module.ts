import { PostsModule } from "../posts/posts.module";
import { WalletGiftsService } from "./wallet-gifts.service";
import { Module } from "@nestjs/common";
import { WalletController, AdminWalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
@Module({
  imports: [PostsModule],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService, WalletGiftsService],
})
export class WalletModule {}
