import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [ConversationsModule, UploadsModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}