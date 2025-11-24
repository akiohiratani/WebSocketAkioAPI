import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const role = event.queryStringParameters?.role ?? "member"; // "admin" or "member"

  await ddb.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      connectionId: { S: connectionId },
      role: { S: role },
      connectedAt: { N: String(Date.now()) }
    }
  }));

  return { statusCode: 200, body: "connected" };
};
