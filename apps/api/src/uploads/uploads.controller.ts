import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { UploadsService } from './uploads.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class PresignDto {
  @IsString() filename!: string;
  @IsString() mime!: string;
  @IsInt() @Min(1) @Max(50 * 1024 * 1024) size!: number;
}

@UseGuards(AuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private svc: UploadsService) {}

  @Post('presign')
  presign(@CurrentUser() userId: string, @Body() dto: PresignDto) {
    return this.svc.presignPut(userId, dto);
  }
}