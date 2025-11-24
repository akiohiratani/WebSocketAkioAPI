# pachinko-ws

Pachinko WebSocket backend (API Gateway WebSocket + Lambda + DynamoDB) を AWS SAM でデプロイするためのプロジェクトです。ブランチ / 顧客ごとに CloudFormation スタックを分けられるよう、テンプレートをパラメータ化しています。

## テンプレートの主なカスタマイズ項目
`template.yaml` で以下をパラメータ化しています。ブランチ名や顧客名を入れてリソースの衝突を避けてください。

- `StageName` (デフォルト: `Prod`) — WebSocket ステージ名。URL に反映されます。
- `ApiName` (デフォルト: `pachinko-ws`) — WebSocket API の論理名。
- `ConnectionsTableName` (デフォルト: `pachinko_ws_connections`) — コネクション管理用 DynamoDB テーブル名。
- `AdminSecretParameter` (デフォルト: `/pachinko/admin/secret`) — 管理用シークレットを格納した SSM パラメータのパス。
- `AdminSecretVersion` (デフォルト: `1`) — 上記パラメータのバージョン。

## ビルド / デプロイ手順
### 前提
- AWS SAM CLI
- Node.js 20 (npm 同梱)
- Docker

### 1. ビルド
```bash
sam build
```

### 2. 初回デプロイ（顧客・ブランチごと）
`--guided` でスタック名やパラメータを入力し、`--config-env` に顧客名やブランチ名を設定すると `samconfig.toml` にプロファイルとして保存できます。

```bash
sam deploy \
  --guided \
  --config-env customerA \
  --stack-name pachinko-ws-customerA \
  --parameter-overrides \
    StageName=customerA \
    ApiName=pachinko-ws-customerA \
    ConnectionsTableName=pachinko_ws_connections_customerA \
    AdminSecretParameter=/pachinko/customerA/admin/secret \
    AdminSecretVersion=1
```

以降は同じ `--config-env customerA` を付けて実行するだけで、同一スタック（顧客/ブランチ専用）に更新デプロイできます。

### 3. 2 回目以降のデプロイ
```bash
sam deploy --config-env customerA
```

### 4. 後片付け
顧客・ブランチごとに作成したスタック名を指定して削除します。

```bash
sam delete --stack-name pachinko-ws-customerA
```
