# Lumi Push（云端 Web Push 后端示例 · 可部署 Cloudflare Workers）

> 供 Lumi Phone **进程被杀后的离线推送兜底**。无需自购服务器；国内用户订阅/收消息常需梯子（Web Push 走 FCM 等通道）。  
> 切后台时优先靠 **页面保活 + 本地通知**；仅当划掉/被杀且仍有进行中的微信任务时，才登记延迟 Push。

前端配置 `VITE_WEB_PUSH_API_BASE` 指向本 Worker 即可。

## 一次性部署

```bash
cd workers/lumi-push
npm install

# 1. 生成 VAPID（公钥写入 wrangler.toml [vars]，私钥仅放 secret）
npx web-push generate-vapid-keys

# 2. 创建 D1 并替换 wrangler.toml 里的 database_id
npx wrangler d1 create lumi-push
npx wrangler d1 execute lumi-push --remote --file=./schema.sql

# 3. 私钥（与 wrangler.toml 中公钥成对）
npx wrangler secret put VAPID_PRIVATE_KEY

# 4. 部署
npm run deploy
```

本地调试：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 填入 VAPID_PRIVATE_KEY
npm run db:migrate
npm run dev
```

## 前端环境变量

```env
VITE_WEB_PUSH_API_BASE=https://lumi-push.<你的子域>.workers.dev
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/vapid-public-key` | 返回 VAPID 公钥 |
| POST | `/subscribe` | `{ clientId, subscription, enabled? }` |
| POST | `/unsubscribe` | `{ clientId }` |
| POST | `/test/start` | `{ jobId, clientId, delayMs?, title?, body? }` 登记延迟兜底 Push |
| POST | `/test/cancel` | `{ jobId }` 本地成功后取消兜底 |
| POST | `/test` | （兼容）立即发送 Push |
