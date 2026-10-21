import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PushModule } from "../push/push.module";
import { StorageModule } from "../storage/storage.module";
import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

/** Linked D/s and other relationships between members' profiles. */
@Module({
  imports: [AuthModule, StorageModule, PushModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
})
export class RelationshipsModule {}
