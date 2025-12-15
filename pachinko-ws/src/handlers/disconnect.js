import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: "disconnect",
      payload: { connectionId }
    })
  }));

  return { statusCode: 202, body: "accepted" };
};
