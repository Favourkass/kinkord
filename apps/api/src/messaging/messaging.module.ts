import { Global, Module } from "@nestjs/common";
import { ConsoleSmsAdapter } from "./console.adapter";
import { RobaseSmsAdapter } from "./robase.adapter";
import { SmsService } from "./sms.service";

@Global()
@Module({
  providers: [RobaseSmsAdapter, ConsoleSmsAdapter, SmsService],
  exports: [SmsService],
})
export class MessagingModule {}
