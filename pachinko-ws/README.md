# pachinko-ws

Pachinko WebSocket backend (API Gateway WebSocket + Lambda + DynamoDB) を AWS SAM でデプロイするためのプロジェクトです。ブランチ / 顧客ごとに CloudFormation スタックを分けられるよう、テンプレートをパラメータ化しています。

## テンプレートの主なカスタマイズ項目
`template.yaml` で以下をパラメータ化しています。ブランチ名や顧客名を入れてリソースの衝突を避けてください。

- `StageName` (デフォルト: `Prod`) — WebSocket ステージ名。URL に反映されます。
- `ApiName` (デフォルト: `pachinko-ws`) — WebSocket API の論理名。
- `ConnectionsTableName` (デフォルト: `pachinko_ws_connections`) — コネクション管理用 DynamoDB テーブル名。
- `AdminSecretBasePath` (デフォルト: `/pachinko`) — 管理用シークレットを格納する SSM パラメータのベースパス。実際に参照されるパラメータキーは `${AdminSecretBasePath}/${StageName}/admin/secret` となります。
- `AdminSecretVersion` (デフォルト: `1`) — 上記パラメータのバージョン。

> 例: デフォルト設定（StageName=`Prod`, AdminSecretBasePath=`/pachinko`）でデプロイする場合は、`/pachinko/Prod/admin/secret` に SecureString パラメータを事前作成しておく必要があります。

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
    AdminSecretBasePath=/pachinko \
    AdminSecretVersion=1
```

以降は同じ `--config-env customerA` を付けて実行するだけで、同一スタック（顧客/ブランチ専用）に更新デプロイできます。

> SSM パラメータをまだ作成していない場合
> 
> デプロイ前に、`AdminSecretBasePath` と `StageName` を使ったパス（例: `/pachinko/customerA/admin/secret`）に管理者シークレットを登録しておきます。
> 
> ```bash
> aws ssm put-parameter \
>   --name /pachinko/customerA/admin/secret \
>   --type SecureString \
>   --value "YOUR_SECRET" \
>   --overwrite
> ```

### 3. 2 回目以降のデプロイ
```bash
sam deploy --config-env customerA
```

### 4. 後片付け
顧客・ブランチごとに作成したスタック名を指定して削除します。

```bash
sam delete --stack-name pachinko-ws-customerA
```

## デプロイ後の WSS 動作確認
- 事前に `wscat` を用意（例: `npm install -g wscat`）。
- 管理者シークレットは SSM Parameter Store から取得します。

1. エンドポイント URL の確認
   ```bash
   export STACK=pachinko-ws-customerA
   export STAGE=customerA   # デプロイ時の StageName と合わせる
   export WSS_URL=$(aws cloudformation describe-stacks \
     --stack-name $STACK \
     --query "Stacks[0].Outputs[?OutputKey=='WebSocketWssUrl'].OutputValue" \
     --output text)
   echo $WSS_URL
   ```

2. SSM から管理者シークレットを取得
   ```bash
   export ADMIN_SECRET=$(aws ssm get-parameter \
    --name /pachinko/${STAGE}/admin/secret \
    --with-decryption \
    --query Parameter.Value \
    --output text)
   ```

3. WebSocket 接続を作成
   - メンバーとして接続: `wscat -c "$WSS_URL/?role=member"`
   - 管理者として別ターミナルから接続: `wscat -c "$WSS_URL/?role=admin"`

4. ラウンド開始イベントの送信（管理者側のターミナル）
   WebSocket ルート `roundStart` に対し、送信したい整数（例では 7）を `winIndex` として渡します。全クライアントに同じ値が届きます。
   ```json
   {"action":"roundStart","secret":"$ADMIN_SECRET","winIndex":7}
   ```

5. 受信確認
   メンバー側の `wscat` セッションに `roundStart` メッセージが届き、`winIndex` が送信した整数（例: 7）になっていること、`startAt` や `serverNow` が含まれていることを確認してください。
