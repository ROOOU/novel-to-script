# NovelScript

NovelScript 是一个面向短剧改编的网站。  
网站把小说原文整理成可生产的内容资产，主链路是：

`原文 -> 分析 -> 大纲 -> 剧本 -> 分镜 -> 导出`

当前线上站点：`https://app.012294.xyz`

## 网站功能

### 1. 项目工作台

- 支持多项目管理，每个项目独立保存原文、任务、产物和导出记录
- 支持创建项目、进入工作台、归档删除项目
- 项目列表页提供快速进入、删除、加载反馈和骨架屏

### 2. 原文录入与配置

- 支持直接粘贴小说原文或项目描述
- 支持上传 `.txt`、`.md`、`.docx` 文件，自动提取正文
- 支持设置：
  - 题材类型：`仙侠修真 / 都市情感 / 奇幻冒险 / 古风权谋 / 悬疑推理 / 重生逆袭`
  - 叙事风格：`戏剧化 / 轻喜剧 / 悬疑压迫 / 甜宠 / 暗黑向 / 爽感快节奏`
  - 集数
  - 单集时长

### 3. 剧本生成链路

- 保存原文后可以直接发起剧本生成任务
- 剧本任务会自动产出：
  - 小说分析
  - 分集大纲
  - 单集剧本
- 不同题材和风格会进入不同 Prompt 分支，影响分析重点、剧情结构、对白语气和节奏

### 4. 一键生成分镜

- 可以从原文直接跑完整 pipeline
- 也可以从已有剧本版本继续生成分镜
- 支持按剧本版本、集数、场景范围筛选分镜输入
- 分镜结果包含结构化镜头数据，并带有 JSON 解析兜底，降低生成异常时的失败率

### 5. 结构化编辑与版本管理

- 工作台内置结构化编辑器，分开编辑：
  - 分析
  - 大纲
  - 剧本
- 支持版本链、基于版本继续修改、查看当前内容类型
- 项目侧边栏和流程区会同步显示当前题材、集数、阶段状态

### 6. 导出与交付

- 支持把当前项目的源文、任务和产物导出
- 适合交付给编剧、分镜师、AI 视频团队或归档备份

### 7. 账号、支付与积分

- 登录方式：仅支持 Google 账号登录
- 登录后会自动同步站内会话并进入项目工作台
- 支付方式：PayPal
- 支持订阅套餐和积分包购买
- 网站内置积分账户、账单中心、使用记录、兑换码功能

### 8. 运营与测试入口

- 提供运营后台
- 支持兑换码批量生成
- 提供开发者测试通道，用于联调积分、支付、项目和兑换码场景

## 主要页面

- 首页：产品介绍和进入主链路
- 登录页：Google-only 登录
- 价格页：套餐与积分包购买
- 项目列表页：创建和管理项目
- 项目工作台：原文、分析、大纲、剧本、分镜、导出
- Billing 页面：订阅、积分余额、账单和用量
- Redeem 页面：兑换码充值
- Admin / Dev Testing：运营和内部联调入口

## 典型使用流程

1. 使用 Google 账号登录
2. 创建项目
3. 上传或粘贴小说原文
4. 选择题材类型、叙事风格、集数和单集时长
5. 先生成剧本，检查分析、大纲和剧本结果
6. 再按版本或范围生成分镜
7. 导出当前项目产物

## 本地开发

```bash
npm install
npm run dev
```

默认地址：

- [http://localhost:3000](http://localhost:3000)

常用命令：

```bash
npm run dev
npm run build
npm run test
npm run typecheck
npm run lint
```

## 环境变量

网站的模型、登录和支付依赖服务端环境变量。

### 必需变量

```bash
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=
CLERK_SECRET_KEY=
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL_NAME=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=
PAYPAL_WEBHOOK_ID=
PAYPAL_PLAN_ID_CREATOR=
PAYPAL_PLAN_ID_PRO=
```

### 可选变量

```bash
LLM_FALLBACKS=
DATABASE_URL=
REDIS_URL=
```

说明：

- `LLM_BASE_URL` 使用 OpenAI-compatible 根路径
- 可以通过 `LLM_FALLBACKS` 配置多个兼容接口做 fallback
- 生产环境变量以 Vercel 控制台为准
- 本地 `.env.local` 仅用于本地开发

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Clerk
- PayPal
- Vitest
- OpenAI-compatible LLM 接口

## 测试

```bash
npm run build
npm run test
```

核心链路重点覆盖：

- 项目创建与工作台流程
- 剧本生成
- 分镜生成
- PayPal 支付路由
- 登录会话桥接

## 相关文档

- [HANDOFF.md](/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/HANDOFF.md)
- [docs/Novel-to-Script-PRD-v2.md](/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/docs/Novel-to-Script-PRD-v2.md)
