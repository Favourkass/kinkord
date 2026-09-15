import { BadRequestException, Body, Controller, HttpCode, Ip, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { OtpService } from "./otp.service";

const sendSchema = z.object({
  channel: z.enum(["email", "sms"]),
  destination: z.string().trim().min(1),
});
const verifySchema = z.object({
  channel: z.enum(["email", "sms"]),
  otp_id: z.string().trim().min(1),
  code: z.string().trim().min(1),
});

function parse<T>(schema: z.ZodSchema<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException("Invalid OTP request");
  return result.data;
}

@Controller("api/otp")
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post("send")
  send(@Body() body: unknown, @Ip() ip: string) {
    const input = parse(sendSchema, body);
    return this.otp.send(input.channel, input.destination, ip);
  }

  @Post("verify")
  @HttpCode(200)
  async verify(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parse(verifySchema, body);
    const valid = await this.otp.verify(input.channel, input.otp_id, input.code);
    response.statusCode = valid ? 200 : 422;
    return { valid };
  }
}
