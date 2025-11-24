import { DynamoDBClient, ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = new DynamoDBClient({});

function mulberry32(seed) {
  // 軽量・再現性のある擬似乱数
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const handler = async (event) => {
  // 管理者権限の簡易チェック
  const body = event.body ? JSON.parse(event.body) : {};
  if (!body || body.secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, body: "forbidden" };
  }

  // 抽選パラメータ生成（すべてのクライアントで共有）
  const serverNow = Date.now();
  const startAt = serverNow + 3000;            // 3秒後に一斉開始
  const seed = Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const winIndex = Math.floor(rng() * 12);     // 例: 12分割ルーレット

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
    seed,
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
