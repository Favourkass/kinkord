import { Global, Module } from "@nestjs/common";
import { PresenceService } from "./presence.service";

/** Global so the auth guard (any module) can record heartbeats. */
@Global()
@Module({
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
