import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class CreateDmDto { @IsString() userId!: string; }
class MarkReadDto { @IsString() messageId!: string; }

@UseGuards(AuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get()
  list(@CurrentUser() userId: string) { return this.svc.listForUser(userId); }

  @Post('dm')
  createDm(@CurrentUser() userId: string, @Body() dto: CreateDmDto) {
    return this.svc.ensureDm(userId, dto.userId);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) { return this.svc.listMessages(id, userId, before); }

  @Post(':id/read')
  read(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return this.svc.markRead(id, userId, dto.messageId);
  }
}