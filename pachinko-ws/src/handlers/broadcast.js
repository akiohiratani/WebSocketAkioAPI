import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler = async (event) => {
  // 管理者権限の簡易チェック
  const body = event.body ? JSON.parse(event.body) : {};
  if (!body || body.secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, body: "forbidden" };
  }

  const winIndex = Number(body.winIndex);
  if (!Number.isInteger(winIndex)) {
    return { statusCode: 400, body: "winIndex must be an integer" };
  }

  const roomId = typeof body.roomId === "string" && body.roomId.trim() ? body.roomId.trim() : null;
  if (!roomId) {
    return { statusCode: 400, body: "roomId is required" };
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: "broadcast",
      payload: { winIndex, roomId },
      meta: {
        domain: event.requestContext.domainName,
        stage: event.requestContext.stage
      }
    })
  }));

  return { statusCode: 202, body: "accepted" };
};
