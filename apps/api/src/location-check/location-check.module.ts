import { Global, Module } from "@nestjs/common";
import { LocationAdminController } from "./location-admin.controller";
import { LocationCheckController } from "./location-check.controller";
import { LocationCheckService } from "./location-check.service";
import { LocationSettingsService } from "./location-settings.service";
import { NetworkIntelService } from "./network-intel.service";

/** Global so the auth guard (any module), sign-up and profile edits can ask about a member's check. */
@Global()
@Module({
  controllers: [LocationCheckController, LocationAdminController],
  providers: [NetworkIntelService, LocationSettingsService, LocationCheckService],
  exports: [NetworkIntelService, LocationSettingsService, LocationCheckService],
})
export class LocationCheckModule {}
