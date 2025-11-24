const amqp = require("amqplib");

async function start() {
  const url = "amqps://xzleluqf:0TvB8GU8OGxgGMzB2zq4EQWJgDHVROyu@jaragua.lmq.cloudamqp.com/xzleluqf";

  const conn = await amqp.connect(url);
  const channel = await conn.createChannel();

  await channel.assertQueue("checkout_analytics", { durable: true });

  console.log("[Analytics] Waiting for messages...");

  channel.consume("checkout_analytics", (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());

      console.log(
        `[Analytics] Calculando analytics da lista ${content.listId} (total de itens, estatísticas...)`
      );

      channel.ack(msg);
    }
  });
}

start().catch(console.error);
