# Lumi Discord 入门验证机器人

在 Discord 频道内完成验证：**按钮答题、仅本人可见（Ephemeral）、10 题全对自动给身份组**。

不依赖 RoleLogic，可部署到 **Render 免费 Worker** 长期运行。

---

## 功能

- `#验证区` 发布验证面板（`/setup-verify`）
- 用户点「开始验证」→ 确认已读公告 → **10 道选择题**（按钮作答）
- 全程 **仅答题者本人可见**
- **全部答对** → 自动添加 `Lumi`（或你配置的身份组）
- 答错 → 进入冷却（默认 10 分钟，可配置）
- 题目在 `questions.json` 中修改，无需改代码

---

## 一、Discord 开发者后台

1. 打开 [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. 左侧 **Bot** → **Add Bot** → 复制 **Token**（即 `DISCORD_TOKEN`）
3. 开启 **SERVER MEMBERS INTENT**
4. 左侧 **OAuth2 → General**：复制 **Client ID**（即 `DISCORD_CLIENT_ID`）
5. **OAuth2 → URL Generator**：
   - Scopes：`bot`、`applications.commands`
   - Permissions：`Manage Roles`、`Send Messages`、`Embed Links`、`Read Message History`
   - 用生成的链接把机器人拉进你的服务器

### 服务器内设置

1. 创建身份组 **Lumi**（或沿用现有验证组）
2. **把机器人身份组拖到 Lumi 上面**
3. `#项目链接`：`@everyone` 关闭查看，**Lumi** 开启查看
4. 复制 **服务器 ID**、**Lumi 身份组 ID**（开发者模式右键复制）

---

## 二、本地试运行（可选）

```bash
cd discord-verify-bot
cp .env.example .env
# 编辑 .env 填入 Token、Client ID、GUILD_ID、VERIFIED_ROLE_ID

npm install
npm start
```

在 `#验证区` 输入斜杠命令：

```
/setup-verify
```

用小号点「开始验证」测一遍。

---

## 三、Render 免费云托管（推荐）

Render 免费 **Background Worker** 可 24 小时跑 Discord 机器人（无公网 URL 也行）。

### 3.1 推送代码到 GitHub

把 `discord-verify-bot` 文件夹放进你的 Git 仓库并 push。  
也可以单独建一个仓库只放这个目录。

### 3.2 创建 Render 服务

1. 登录 [render.com](https://render.com)（可用 GitHub 注册）
2. **New +** → **Background Worker**
3. 连接你的 GitHub 仓库
4. 配置：

| 项 | 值 |
|----|-----|
| Name | `lumi-discord-verify` |
| Root Directory | `discord-verify-bot`（若仓库根目录就是本 bot 则留空） |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | **Free** |

5. **Environment** 添加变量：

| Key | Value |
|-----|-------|
| `DISCORD_TOKEN` | 机器人 Token |
| `DISCORD_CLIENT_ID` | Application ID |
| `GUILD_ID` | 服务器 ID |
| `VERIFIED_ROLE_ID` | Lumi 身份组 ID |
| `COOLDOWN_MINUTES` | `10`（可选） |

6. 点击 **Create Background Worker**，等待 Deploy 成功
7. 日志里应出现：`验证机器人已上线：xxx`

若仓库根目录包含 `render.yaml`，也可用 **Blueprint** 一键部署。

### 3.3 Render 免费版说明

- 免费 Worker 在长时间无活动后可能被休眠，但 Discord 机器人保持 WebSocket 连接通常会一直在线
- 若实例重启，冷却计时器会清空（不影响已验证用户）
- 完全 $0，无答题人数上限

---

## 四、上线后操作

1. 确认 Render 日志显示机器人已上线
2. 在 Discord `#验证区` 执行 **`/setup-verify`**（需管理员权限）
3. 置顶机器人发出的验证面板消息
4. 可删除旧的 RoleLogic 验证链接（若不再使用）

### 验证区置顶文案示例

```text
【入门验证】
① 请先阅读 #公告
② 点击下方「开始验证」按钮
③ 10 题全对即可获得 Lumi 身份组，查看 #项目链接

本 DC 不答疑，Bug 反馈见 #公告。
```

---

## 五、修改题目

编辑 `questions.json` 后：

- 本地：重启 `npm start`
- Render：**Manual Deploy** 或 push 到 GitHub 自动部署

---

## 六、环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DISCORD_TOKEN` | ✅ | Bot Token |
| `DISCORD_CLIENT_ID` | ✅ | Application ID |
| `GUILD_ID` | ✅ | 服务器 ID |
| `VERIFIED_ROLE_ID` | ✅* | 验证通过后给的身份组 ID |
| `VERIFIED_ROLE_NAME` | ✅* | 无 ID 时用名称匹配，默认 `Lumi` |
| `COOLDOWN_MINUTES` | | 答错冷却，默认 10 |
| `ANNOUNCE_CHANNEL_ID` | | 预留，暂未使用 |

\* `VERIFIED_ROLE_ID` 与 `VERIFIED_ROLE_NAME` 至少配置一种；**推荐用 ID**。

---

## 七、常见问题

### 全对但没有身份组

- 机器人身份组是否在 **Lumi 上面**
- `VERIFIED_ROLE_ID` 是否填对
- Render 日志是否有 `Missing Permissions`

### `/setup-verify` 不显示

- 等 1～2 分钟或重启 Render 服务（启动时会自动注册命令）
- 确认 `GUILD_ID` 是服务器 ID 不是频道 ID

### 按钮点了没反应

- 确认 Render 服务为 **Running**
- 只有发面板之后的新点击有效；换部署后旧消息按钮仍可用（custom_id 固定）

### 与 RoleLogic 共存

可以共存，但建议只保留一种验证方式，避免用户困惑。

---

## 文件结构

```
discord-verify-bot/
  package.json
  questions.json      # 题目与文案
  render.yaml           # Render 一键部署（可选）
  .env.example
  src/
    index.js            # 入口
    config.js
    register-commands.js
    verifyHandler.js    # 答题逻辑
```

---

## 许可

与 Lumi 项目配套使用，MIT。
