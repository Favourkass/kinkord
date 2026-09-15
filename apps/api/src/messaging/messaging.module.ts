import { Global, Module } from "@nestjs/common";
import { RobaseSmsAdapter } from "./robase.adapter";
import { SmsService } from "./sms.service";

@Global()
@Module({
  providers: [RobaseSmsAdapter, SmsService],
  exports: [SmsService],
})
export class MessagingModule {}
