const amqp = require("amqplib");

async function start() {
  const url = "amqps://xzleluqf:0TvB8GU8OGxgGMzB2zq4EQWJgDHVROyu@jaragua.lmq.cloudamqp.com/xzleluqf";

  const conn = await amqp.connect(url);
  const channel = await conn.createChannel();

  await channel.assertQueue("checkout_notifications", { durable: true });

  console.log("[Notifications] Waiting for messages...");

  channel.consume("checkout_notifications", (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());

      console.log(
        `[Notifications] Enviando comprovante da lista ${content.listId} para o email ${content.email}`
      );

      channel.ack(msg);
    }
  });
}

start().catch(console.error);
