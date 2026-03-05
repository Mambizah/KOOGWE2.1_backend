import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({
  path: '/admin/ws',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class AdminGateway {}
