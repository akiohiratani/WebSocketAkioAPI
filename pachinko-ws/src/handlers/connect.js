import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const role = event.queryStringParameters?.role ?? "member"; // "admin" or "member"

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: "connect",
      payload: {
        connectionId,
        role,
        connectedAt: Date.now()
      }
    })
  }));

  return { statusCode: 202, body: "accepted" };
};
