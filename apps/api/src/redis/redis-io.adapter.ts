import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger(RedisIoAdapter.name);
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) { super(app); }

  async connectToRedis() {
    const url = process.env.REDIS_URL!;
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (e) => this.log.error('redis pub error', e));
    subClient.on('error', (e) => this.log.error('redis sub error', e));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.log.log('Socket.IO Redis adapter connected.');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, { ...options, cors: { origin: true, credentials: true } });
    server.adapter(this.adapterConstructor);
    return server;
  }
}