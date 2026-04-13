# Novel-to-Script

一个面向短剧生产前置环节的内容生成 SaaS。  
它的核心目标不是“直接生成视频”，而是把小说或剧情文本稳定地转成可复用的制作资产。

当前主链路是：

`原文 -> 分析 -> 大纲 -> 剧本 -> 分镜 -> 导出`

正在推进的下一阶段结构是：

`原文 -> 分析 -> StoryBible -> SceneCards -> 大纲 -> 剧本 -> ShotPlan -> PromptPack -> 导出`

## 当前能力

- 项目工作台与多项目管理
- Google-only 登录
- PayPal 订阅与积分包购买
- 积分驱动的生成任务体系
- 任务 Job、产物 Artifact、来源关系 ArtifactRelation
- 一键 pipeline：`script-generation -> storyboard-generation`
- 分镜结构化输出与解析兜底诊断
- OpenAI-compatible LLM 接入，支持网关与 fallback

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Clerk
- PayPal
- Vitest
- OpenAI-compatible LLM client

## 一键启动

在 macOS 上，直接双击工作区根目录下的 `start.command`。  
它会自动进入 `novel-to-script` 目录、安装依赖（如有需要）、启动开发服务器并打开浏览器。

## 本地开发

先安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

默认访问地址：

- [http://localhost:3000](http://localhost:3000)

常用命令：

```bash
npm run dev
npm run build
npm run test
npm run typecheck
npm run lint
```

## 后端环境变量

LLM 配置统一走服务端环境变量，前端页面不再允许填写 API Key，也不会把模型配置持久化到浏览器。

在项目根目录创建 `.env.local`：

```bash
LLM_API_KEY=sk-...
# 可选，默认 https://api.openai.com/v1
LLM_BASE_URL=https://api.openai.com/v1
# 可选，按你的上游实际模型填写
LLM_MODEL_NAME=glm-5
```

如果你希望主线路失败时自动切备用线路，还可以配置：

```bash
LLM_FALLBACKS=[{"apiKey":"sk-backup","baseUrl":"https://backup-gateway.example.com/v1","modelName":"glm-5","label":"backup"}]
```

### 关于 `new-api`

本项目保留 `OpenAI-compatible` 客户端层，因此可以直接接入 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 这类网关。

例如：

```bash
LLM_API_KEY=sk-newapi-...
LLM_BASE_URL=https://your-new-api-domain.com/v1
LLM_MODEL_NAME=gemini-2.5-flash
```

### 关于 Google AI Studio Gemini

如果你使用的是 Google AI Studio 提供的 Gemini API，并且准备走它的 OpenAI-compatible 接口，也可以直接接入当前项目。

例如：

```bash
LLM_API_KEY=AIza...
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL_NAME=gemini-2.5-flash
```

补充说明：

- `LLM_API_KEY` 使用你的 Google AI Studio / Gemini API key
- `LLM_BASE_URL` 必须填写 OpenAI-compatible 根路径：
  `https://generativelanguage.googleapis.com/v1beta/openai`
- 不要把完整的 `chat/completions` endpoint 填进来
- 当前项目仍统一使用 `LLM_*` 环境变量，不单独新增 `GEMINI_*` 变量
- 如果你是通过 `new-api` 之类的网关转 Gemini，继续按上面的 `new-api` 方式配置即可

补充说明：

- `LLM_BASE_URL` 应指向兼容 OpenAI 的根路径，通常带 `/v1`
- `LLM_MODEL_NAME` 应填写你的网关实际暴露出来的模型 ID
- `LLM_FALLBACKS` 是 JSON 数组
- 当前 fallback 会在 `401/403/404/429/5xx`、超时或网络错误时自动尝试备用 provider

## 生产环境变量约定

生产环境一律以 Vercel 控制台中的 Environment Variables 为准，不以本地 `.env.local` 或 `.env.vercel.production` 为准。

当前仓库已通过 `.vercelignore` 屏蔽本地 env 文件上传，因此：

- 本地 `.env.local` 只用于本地开发
- `.env.local.example` 只作为字段模板
- `.env.vercel.production` 不应再被视为线上真实配置来源

建议的线上维护方式：

1. 所有生产变量只在 Vercel Project Settings -> Environment Variables 中维护
2. 修改后重新触发一次生产部署
3. 不要把生产 key、secret、plan id 回写到本地 env 文件

线上至少应在 Vercel 中维护这些变量：

- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL_NAME`
- `LLM_FALLBACKS`（如使用）
- `DATABASE_URL`
- `REDIS_URL`（如使用）
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_PLAN_ID_CREATOR`
- `PAYPAL_PLAN_ID_PRO`
- `CLERK_SECRET_KEY`

## 核心代码入口

### Pipeline 编排

- [src/server/generation/pipeline-service.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/generation/pipeline-service.ts)
- [src/server/generation/processor.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/generation/processor.ts)

### 剧本生成

- [src/server/script-generation/application/run-script-generation.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/script-generation/application/run-script-generation.ts)

### 分镜生成

- [src/server/storyboard/application/run-storyboard-generation.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/storyboard/application/run-storyboard-generation.ts)
- [src/server/storyboard/prompt-compiler.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/storyboard/prompt-compiler.ts)

### 新增故事结构层

- [src/server/story-engine/story-bible.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/story-engine/story-bible.ts)
- [src/server/story-engine/complexity.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/story-engine/complexity.ts)
- [src/server/story-engine/chunking.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/story-engine/chunking.ts)

### 领域模型

- [src/server/shared/platform/domain/entities.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/shared/platform/domain/entities.ts)

### 工作台前端

- [src/features/saas/ProjectWorkspaceClient.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/ProjectWorkspaceClient.tsx)
- [src/features/saas/project/AssetBrowserPanel.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/project/AssetBrowserPanel.tsx)
- [src/features/saas/project/JobTimelinePanel.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/project/JobTimelinePanel.tsx)
- [src/features/saas/project/StoryboardPanel.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/project/StoryboardPanel.tsx)

## 鉴权与支付

### 登录

当前登录策略是 Google-only。

关键文件：

- [src/features/saas/GoogleOnlySignInButton.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/GoogleOnlySignInButton.tsx)
- [src/features/saas/ClerkSessionBridge.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/ClerkSessionBridge.tsx)
- [src/app/api/auth/session/clerk/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/auth/session/clerk/route.ts)

### 支付

当前生产支付主线是 PayPal，不是 Stripe。

关键文件：

- [src/server/billing/paypal.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/billing/paypal.ts)
- [src/server/billing/payments.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/billing/payments.ts)
- [src/features/saas/PricingClient.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/PricingClient.tsx)

## 测试

核心链路验证：

```bash
npm test -- src/server/generation/__tests__/pipeline-flow.test.ts src/server/storyboard/application/__tests__/run-storyboard-generation.test.ts src/app/api/__tests__/project-main-flow.test.ts
npm run build
```

补充验证：

```bash
npm test -- src/server/generation/__tests__/pipeline-service.test.ts src/server/generation/__tests__/processor.test.ts src/app/api/generate/route.test.ts src/app/api/projects/[projectId]/pipelines/route.test.ts
npm test -- src/server/billing/__tests__/paypal.test.ts src/app/api/billing/paypal/routes.test.ts
npm test -- src/lib/__tests__/llm.test.ts src/lib/__tests__/server-llm-config.test.ts
```

## 设计与协作说明

项目级协作说明见：

- [AGENTS.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/AGENTS.md)

当前执行版 PRD 见：

- [docs/Novel-to-Script-PRD-v2.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/Novel-to-Script-PRD-v2.md)

## 当前状态

截至 2026-04-10：

- `story_bible / scene_cards / shot_plan / prompt_pack` 已在本地进入第一阶段实现
- 长文本复杂度识别与 `direct / segmented` 元数据基础正在推进
- 主系统仍然以“稳定扩展现有 SaaS”为原则，而不是推倒重做

如果你是新协作者，最适合先看三处：

1. [AGENTS.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/AGENTS.md)
2. [docs/Novel-to-Script-PRD-v2.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/Novel-to-Script-PRD-v2.md)
3. [src/server/generation/processor.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/generation/processor.ts)
