import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const role = event.queryStringParameters?.role ?? "member"; // "admin" or "member"
  const roomIdValue = event.queryStringParameters?.roomId;
  const roomId = typeof roomIdValue === "string" && roomIdValue.trim() ? roomIdValue.trim() : undefined;

  const payload = {
    connectionId,
    role,
    connectedAt: Date.now()
  };

  if (roomId) {
    payload.roomId = roomId;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: "connect",
      payload
    })
  }));

  return { statusCode: 202, body: "accepted" };
};
