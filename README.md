# FitLens — 中文优先的健身与营养记录 App

FitLens 是一款**中文优先**的健身与营养记录应用，帮助普通健身人群（减脂 / 增肌 / 保持健康）记录训练、饮食与身体数据，并通过 **DeepSeek 视觉模型识别食物照片**降低「记录吃了什么」的成本。

> 面向 **蓝色光标 AI Builder 岗位**的作品：一个代码库同时交付 **Web Demo** 与 **移动端 App（Android 优先）**，含**真实账号认证 + 真实 AI 识别**的端到端链路。

---

## 目录

- [核心流程](#核心流程)
- [在线 Demo 与部署状态](#在线-demo-与部署状态)
- [移动端 App](#移动端-app)
- [技术架构](#技术架构)
- [快速开始（本地运行）](#快速开始本地运行)
- [部署](#部署)
- [环境变量配置](#环境变量配置)
- [认证与安全](#认证与安全)
- [AI 能力边界](#ai-能力边界)
- [数据模型与单位口径](#数据模型与单位口径)
- [已知限制](#已知限制)
- [评测 / 指标 / 路线 / 产品方案](#评测--指标--路线--产品方案)

---

## 核心流程

1. **账号密码登录**：邮箱 + 密码 + 图形验证码，注册 / 登录 / 退出登录。
2. **每日总览**：今日摄入、训练消耗、目标、剩余热量 + 今日训练 + 近 7 天消耗 + 体重趋势。
3. **训练打卡**：新增 / 查看 / 编辑 / 删除（类型含力量训练、跑步、骑行、游泳、瑜伽、爬坡、跑楼梯、其他）。
4. **AI 拍照识别 → 确认 → 保存**：上传照片 → 后端转发 DeepSeek 视觉模型 → 返回食物名/食材/份量/不确定性 → **确认或修正** → 保存。
5. **身体数据**：记录体重 / 腰围 / 臀围，查看趋势、最近值与变化。
6. **个人资料**：昵称、头像、健身目标、身高、年龄。

---

## 在线 Demo 与部署状态

| 部分 | 状态 |
|---|---|
| 前端（Web） | ✅ 已部署 GitHub Pages：<https://Gsbdueheie.github.io/fitlens/> |
| 后端（认证 + AI） | ⚠️ **尚未部署**，需部署到可运行 Node 的平台并配置密钥 |

> **重要说明**：账号登录、CAPTCHA 校验、DeepSeek 识别都由**后端**完成。当前后端只在本机 `localhost:4000` 运行，因此**公开链接上的登录/AI 功能在部署后端之前会提示「无法连接服务器」**——这是预期行为，不是 Bug。部署后端并配置 `EXPO_PUBLIC_API_URL` 后即可完整可用（见 [部署](#部署)）。

---

## 移动端 App

同一 Expo 代码库输出移动端：

- **Expo Go 即时预览**（无需账号）：手机装 [Expo Go](https://expo.dev/go)，本机 `npm start` 后扫码。
- **Android APK**：`npx eas-cli@latest build --platform android --profile preview`（需 EAS 账号云构建）。
- 移动端同样通过 `EXPO_PUBLIC_API_URL` 访问后端，需后端为公网 HTTPS 地址。
- **限制**：本环境未实际生成 APK（需 EAS 账号），iOS 未配置，仅保证 Android。

---

## 技术架构

```
src/            # Expo 前端（React Native + Expo Router，Web/移动端共用）
  app/          # 页面路由
  components/   # ui.tsx 设计系统 + charts.tsx 图表 + tab-bar.tsx
  context/app.tsx  # 登录态 + 本地记录 CRUD
  services/api.ts  # 后端 API 客户端
  lib/          # 类型/日期/格式化/营养计算/存储/种子数据
server/         # 后端（Express，本地开发 / Node 主机）
  src/          # config/store/auth/captcha/rateLimit/deepseek/nutrition/app
  data/foods.json  # 内置食物营养表（每 100g 近似值）
server-cf/      # 后端（Cloudflare Workers，同一套 API，供无法注册 Node 主机时使用）
  src/index.js  # 认证(PBKDF2) + CAPTCHA + DeepSeek + 营养（KV 存储）
docs/           # 产品方案 / AI 评估 / 指标 / 路线图 + 截图
```

**职责划分**：

| 层 | 职责 |
|---|---|
| 后端 `server/` | 账号认证（bcrypt）、会话、CAPTCHA、限速、转发图片给 DeepSeek、结构化解析、营养查询与计算 |
| 前端 `src/` | 交互、表单校验、图片预览、结果确认/修正、本地记录展示 |

---

## 快速开始（本地运行）

要求：Node 22.13+ / 24 / 26（后端在前端 Node 23 下已验证可运行）。

```bash
# 1) 启动后端（终端 A）
cd server
npm install
cp .env.example .env        # 填入 DEEPSEEK_API_KEY（可选，不填则识别时提示「未配置」）
npm start                    # http://localhost:4000

# 2) 启动前端（终端 B）
cd ..
npm install
npm run web                  # 浏览器打开 http://localhost:8081/fitlens/
```

> 注：因 GitHub Pages 子路径配置（`app.json` 的 `experiments.baseUrl=/fitlens`），本地 Web 地址带 `/fitlens/` 后缀。

### 常用命令

| 命令 | 说明 |
|---|---|
| `npm run web` | 前端 Web 开发服务器 |
| `npx expo export --platform web` | 导出静态 Web 包到 `dist/` |
| `npx tsc --noEmit` / `npx expo lint` | 类型检查 / 代码检查 |
| `cd server && npm start` | 启动后端 |
| `npx expo-doctor` | 依赖诊断 |

---

## 部署

### 前端（GitHub Pages，已完成）

`main` 分支每次 push 会自动通过 `.github/workflows/deploy.yml` 构建并部署。

### 后端（需你部署）

提供两种后端实现，部署任一种即可：

#### 方案 A：Cloudflare Workers（推荐，仅需邮箱注册，无需手机号/信用卡）

```bash
cd server-cf
npm install
npx wrangler login                    # 浏览器授权你的 Cloudflare 账号
npx wrangler kv namespace create FITLENS_KV   # 记下返回的 id
# 把 id 填进 wrangler.toml 的 [[kv_namespaces]].id
npx wrangler secret put DEEPSEEK_API_KEY      # 粘贴你的新 Key（服务端密钥，不提交）
npx wrangler deploy                   # 部署，得到 https://fitlens-server.<你的子域>.workers.dev
```

#### 方案 B：Node 主机（Render/Railway 等，`server/` 目录）

把 `server/` 部署为 Node Web Service（启动命令 `npm start`），在平台服务端环境变量填 `DEEPSEEK_API_KEY`。已提供 `render.yaml`（Render Blueprint）。

> 两个后端实现提供**完全相同的 API**，前端只需把 `EXPO_PUBLIC_API_URL` 指向其一。

### 联调

在前端 `.env.local` 中设置 `EXPO_PUBLIC_API_URL=https://your-app.onrender.com`，重新构建并部署前端；或本地 `npm run web` 时设置同名变量。

---

## 环境变量配置

**前端**（`.env.example`，无密钥）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` | 后端 API 地址（公开地址，非密钥） |

**后端**（`server/.env.example`，含密钥，绝不提交）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 空 | DeepSeek 密钥（**仅服务端**） |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 支持图片的视觉模型 |
| `CAPTCHA_PROVIDER` | `builtin` | `builtin` 内置图形验证码 / `turnstile` |
| `TURNSTILE_SECRET_KEY` | 空 | 使用 turnstile 时填写 |
| `ALLOWED_ORIGINS` | `*` | 允许跨域来源 |

---

## 认证与安全

- 密码用 **bcrypt** 哈希存储，绝不落明文、不写日志、不返回客户端。
- 登录失败**统一提示**「邮箱或密码错误」，不泄露账号是否存在。
- 服务端会话 token；退出登录后会话失效。
- 登录 / 注册按 **IP + 账号维度**做限速。
- **CAPTCHA 由服务端校验**（签发 → 前端展示 → 服务端校验，一次性 + 5 分钟有效期 + 5 次错误上限）。
- 内置图形验证码是**仅限开发/演示**的方案，非生产级人机验证；生产建议接入 Cloudflare Turnstile（`CAPTCHA_PROVIDER=turnstile`），代码已预留。

---

## AI 能力边界

- 图片由**服务端**以 base64 转发给 DeepSeek 视觉模型（`deepseek-flash`），前端不接触密钥。
- 模型输出经过**结构化解析 + 字段校验 + 数值范围检查**，不直接信任。
- **未配置 `DEEPSEEK_API_KEY` 或调用失败时，明确提示「AI 服务未配置 / 错误」，绝不返回固定/随机/静态映射的假识别结果。**
- 营养由**内置食物营养表**按「确认后的食物名 + 份量」计算，标注来源与近似性；查不到时允许用户编辑，并提示「未查到营养数据」。
- 热量是**估算值**，非精确测量；份量、用油、酱料、配方、隐藏食材无法从照片可靠判断，界面有明确不确定性说明。
- **不声称准确率**：真实准确率（类别准确率、热量误差、用户修正率）是待验证目标，评估方案见 [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md)。

---

## 数据模型与单位口径

- 数据模型见 [`src/lib/types.ts`](src/lib/types.ts)。
- **账号/密码/会话**：存储在**后端**（`server/data/db.json`，文件持久化，生产可替换为数据库）。
- **训练/饮食/身体/偏好记录**：仍存储在**本机**（localStorage / AsyncStorage）——**多设备同步尚未实现**，这是明确的已知限制。
- **热量单位**：内部统一 **kcal**，界面显示「卡」（1 卡 = 1 kcal）；主要界面不混用 kcal/千卡/卡。
- **每日剩余** = 目标 + 训练消耗 − 摄入；训练消耗 = 训练记录消耗之和 + 手动补充（只汇总一次）。
- **「运动消耗」仅指主动运动消耗，不等于全天总能量消耗**（基础代谢未计入）。

---

## 已知限制

1. **后端尚未部署**：账号登录 / CAPTCHA / AI 识别需后端在线；部署前公开链接会提示「无法连接服务器」。
2. **DeepSeek Key 未配置**：识别会明确提示「AI 服务未配置」，不会给假结果。
3. **内置 CAPTCHA 非生产级**：需接入 Turnstile 等成熟服务才可视为生产防护。
4. **记录存本机**：训练/饮食/身体数据仅本机，无跨设备同步。
5. **Android APK 未实际生成**：需 EAS 账号云构建；iOS 未配置。
6. **营养表覆盖有限**：仅内置约 50 种常见食物，查不到时允许手动编辑。
7. **真实评测数据**：尚未实测，准确率等指标待验证，不编造。

---

## 评测 / 指标 / 路线 / 产品方案

- AI 识别评估方案（评测集、指标、低置信度处理、用户修正机制）：[`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md)
- 产品指标建议（记录完成率、打卡留存、识别后修改率、周活等）：[`docs/METRICS.md`](docs/METRICS.md)
- 迭代路线（短期/中期）：[`docs/ROADMAP.md`](docs/ROADMAP.md)
- 产品方案（用户问题、定位、关键取舍）：[`docs/PRODUCT.md`](docs/PRODUCT.md)

---

## License

MIT（见 `LICENSE`）。
