import * as amqp from 'amqplib';
import type { Channel } from 'amqplib';

let conn: any = null;
let channel: Channel | null = null;

const RABBIT_URL =
 'amqps://xzleluqf:0TvB8GU8OGxgGMzB2zq4EQWJgDHVROyu@jaragua.lmq.cloudamqp.com/xzleluqf';

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;

  if (!conn) {
    conn = await amqp.connect(RABBIT_URL);

    conn.on('close', () => {
      console.warn('[rabbitmq] connection closed');
      conn = null;
      channel = null;
    });

    conn.on('error', (err: any) => {
      console.error('[rabbitmq] connection error', err);
      conn = null;
      channel = null;
    });
  }

  channel = await conn.createChannel();

  // ❌ REMOVER ESSA PARTE (é ela que está dando conflito):
  // await channel!.assertExchange('shopping_events', 'topic', {
  //   durable: true,
  // });

  // ✅ Só devolve o canal, assumindo que o exchange já existe (criado via UI)
  return channel!;
}