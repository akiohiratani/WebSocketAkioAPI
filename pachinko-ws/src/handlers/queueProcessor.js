import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = new DynamoDBClient({});

export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    const message = record.body ? JSON.parse(record.body) : {};
    const action = message.action;
    const payload = message.payload ?? {};

    switch (action) {
      case "connect": {
        const { connectionId, role, connectedAt } = payload;
        await ddb.send(new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            connectionId: { S: connectionId },
            role: { S: role ?? "member" },
            connectedAt: { N: String(connectedAt ?? Date.now()) }
          }
        }));
        break;
      }
      case "disconnect": {
        const { connectionId } = payload;
        if (connectionId) {
          await ddb.send(new DeleteItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: { connectionId: { S: connectionId } }
          }));
        }
        break;
      }
      case "broadcast": {
        const { winIndex } = payload;
        if (!Number.isInteger(Number(winIndex))) {
          console.error("invalid winIndex", winIndex);
          break;
        }

        const { domain, stage } = message.meta ?? {};
        if (!domain || !stage) {
          console.error("missing domain/stage for broadcast");
          break;
        }

        const resolvedWinIndex = Number(winIndex);
        const serverNow = Date.now();
        const startAt = serverNow + 3000;

        let items = [];
        let ExclusiveStartKey;
        do {
          const out = await ddb.send(new ScanCommand({
            TableName: process.env.TABLE_NAME,
            ExclusiveStartKey
          }));
          items = items.concat(out.Items ?? []);
          ExclusiveStartKey = out.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        const mgmt = new ApiGatewayManagementApiClient({
          endpoint: `https://${domain}/${stage}`
        });

        const payloadData = JSON.stringify({
          type: "roundStart",
          winIndex: resolvedWinIndex,
          startAt,
          serverNow
        });

        for (const it of items) {
          const cid = it.connectionId.S;
          try {
            await mgmt.send(
              new PostToConnectionCommand({ ConnectionId: cid, Data: Buffer.from(payloadData) })
            );
          } catch (e) {
            if (e.statusCode === 410) {
              await ddb.send(new DeleteItemCommand({
                TableName: process.env.TABLE_NAME,
                Key: { connectionId: { S: cid } }
              }));
            } else {
              console.error("post error", cid, e);
            }
          }
        }
        break;
      }
      case "default":
        // No-op placeholder for future default route processing
        break;
      default:
        console.error("unknown action", action);
    }
  }
};
