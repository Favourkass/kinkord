import { Global, Module } from "@nestjs/common";
import { SmsService } from "./sms.service";
import { TermiiSmsAdapter } from "./termii.adapter";

@Global()
@Module({
  providers: [TermiiSmsAdapter, SmsService],
  exports: [SmsService],
})
export class MessagingModule {}
