import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler = async (event) => {
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: "default",
      payload: {
        connectionId: event.requestContext.connectionId
      }
    })
  }));

  return { statusCode: 202, body: "accepted" };
};
