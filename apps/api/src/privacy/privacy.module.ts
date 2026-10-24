import { Module } from "@nestjs/common";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { PrivacyRepository } from "./privacy.repository";
@Module({ controllers: [PrivacyController], providers: [PrivacyService, PrivacyRepository] })
export class PrivacyModule {}
