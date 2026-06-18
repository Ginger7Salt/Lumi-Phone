# Link Preview（HTTPS 公开页抓取 · Cloudflare Workers）

> 用户在微信里发 `https://...` 链接时，由 Worker 代抓公开网页标题/摘要，注入 AI 上下文。  
> **无需自购服务器**；免费 Cloudflare 账号即可。国内访问 `*.workers.dev` 可能需梯子（与 lumi-push / netease worker 相同）。

## 一次性部署

```bash
cd workers/link-preview
npm install
npm run deploy
```

部署成功后终端会输出地址，例如 `https://link-preview.<你的子域>.workers.dev`。

### 部署报错「Failed to retrieve account IDs」？

这是 **Cloudflare 登录过期**，不是代码问题。在本机终端执行：

```bash
npx wrangler login
```

浏览器会弹出 Cloudflare 授权页，登录后回到终端再 `npm run deploy`。

若仍失败，在 [Cloudflare 控制台](https://dash.cloudflare.com/) 右侧复制 **Account ID**，写入 `wrangler.toml`：

```toml
account_id = "你的32位账号ID"
```

（你之前成功部署过 `lumi-push` / `netease-qr-login` 的账号，用同一个 Cloudflare 账号即可。）


本地调试：

```bash
npm run dev
# POST http://127.0.0.1:8787/preview  { "url": "https://example.com" }
```

## 前端环境变量

在项目根目录 `.env` 或 `.env.local`：

```env
VITE_LINK_PREVIEW_API_BASE=https://link-preview.<你的子域>.workers.dev
```

未配置时：发链接不会报错，只是不会注入网页摘要（角色无法「看见」链接内容）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/preview` | `{ "url": "https://..." }` 或 `{ "urls": ["https://a", "https://b"] }`（最多 3 条） |

响应示例：

```json
{
  "ok": true,
  "previews": [
    {
      "url": "https://example.com",
      "ok": true,
      "title": "Example Domain",
      "description": "...",
      "excerpt": "..."
    }
  ]
}
```

## 限制（v1）

- 仅 **https** 公开页；不支持登录墙、小红书/微博等强反爬站点
- **抖音 / 小红书 / 微博 / B站 / 知乎 / 公众号** 等：前端会直接标记「读不到」，并指令角色**不得编造**、请用户粘贴正文
- 不解析 JavaScript 渲染页（纯静态 HTML / 服务端渲染较稳）
- SSRF 防护：禁止内网/localhost/非 443 端口
