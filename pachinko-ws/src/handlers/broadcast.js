import { DynamoDBClient, ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = new DynamoDBClient({});

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

  // 抽選パラメータ生成（すべてのクライアントで共有）
  const serverNow = Date.now();
  const startAt = serverNow + 3000;            // 3秒後に一斉開始

  // 接続者取得
  let items = [];
  let ExclusiveStartKey = undefined;
  do {
    const out = await ddb.send(new ScanCommand({
      TableName: process.env.TABLE_NAME,
      ExclusiveStartKey
    }));
    items = items.concat(out.Items ?? []);
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // Management API クライアント
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const mgmt = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`
  });

  const payload = JSON.stringify({
    type: "roundStart",
    winIndex,
    startAt,   // epoch ms
    serverNow  // クライアントの時計補正用
  });

  // 配信（Gone なら掃除）
  for (const it of items) {
    const cid = it.connectionId.S;
    try {
      await mgmt.send(new PostToConnectionCommand({ ConnectionId: cid, Data: Buffer.from(payload) }));
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

  return { statusCode: 200, body: "broadcasted" };
};
