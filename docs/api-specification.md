# NovelScript SaaS API Specification

> 关联 PRD：`docs/comprehensive-prd.md` v3.0  
> 关联 FSD：`docs/functional-specification.md` v1.0  
> 关联 Schema：`docs/database-schema.md` v1.0  
> 更新日期：2026-03-24  
> 版本：v1.0

---

## 1. 通用约定

### 1.1 Base URL

```
/api
```

### 1.2 认证

所有标记 🔒 的接口需通过 Cookie Session 认证。未认证请求返回 `401`。

认证通过 `requireViewerResponse()` 实现，解析当前用户的 `viewer` 上下文：

```typescript
{ user, organization, workspace, subscription, creditAccount }
```

### 1.3 响应格式

**成功响应**：
```json
{ "ok": true, ...data }
```

**失败响应**：
```json
{ "ok": false, "error": "ERROR_CODE" }
```

### 1.4 请求体验证

所有 POST/PATCH 请求体通过 `zod` schema 验证。验证失败返回 `400`。

---

## 2. 认证

### 2.1 获取/管理 Session

#### `GET /api/auth/session` 🔒

获取当前登录用户的 session 信息。

**响应 200**：
```json
{
  "ok": true,
  "user": User,
  "organization": Organization,
  "workspace": Workspace,
  "subscription": Subscription | null,
  "creditAccount": CreditAccount | null
}
```

---

## 3. 项目管理

### 3.1 项目列表

#### `GET /api/projects` 🔒

获取当前用户的所有项目。

**响应 200**：
```json
{
  "ok": true,
  "projects": Project[]
}
```

### 3.2 创建项目

#### `POST /api/projects` 🔒

**请求体**：
```json
{
  "name": "string (required, min 1)",
  "description": "string (optional)",
  "genre": "string (optional)"
}
```

**响应 200**：
```json
{
  "ok": true,
  "project": Project
}
```

### 3.3 获取项目详情（Project Bundle）

#### `GET /api/projects/:projectId` 🔒

返回项目完整数据包，包含所有关联的源文档、任务、工件和工件关系。

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `projectId` | string | 项目 ID |

**响应 200**：
```json
{
  "ok": true,
  "project": Project,
  "sourceDocuments": SourceDocument[],
  "jobs": GenerationJob[],
  "artifacts": GenerationArtifact[],
  "artifactRelations": ArtifactRelation[],
  "insights": ProjectArtifactInsights
}
```

**响应 404**：
```json
{ "ok": false, "error": "PROJECT_NOT_FOUND" }
```

---

## 4. 原文管理

### 4.1 保存原文

#### `POST /api/projects/:projectId/source` 🔒

保存或更新项目的原文内容。如果项目已有 SourceDocument，则更新；否则创建新的。

**请求体**：
```json
{
  "title": "string (required, min 1)",
  "textContent": "string (required, min 1)"
}
```

**响应 200**：
```json
{
  "ok": true,
  "sourceDocument": SourceDocument
}
```

**响应 404**：
```json
{ "ok": false, "error": "PROJECT_NOT_FOUND" }
```

---

## 5. 生成任务（Jobs）

### 5.1 获取项目任务列表

#### `GET /api/projects/:projectId/jobs` 🔒

获取项目下所有生成任务，按 `createdAt` 降序。

**响应 200**：
```json
{
  "ok": true,
  "jobs": GenerationJob[]
}
```

### 5.2 创建生成任务

#### `POST /api/projects/:projectId/jobs` 🔒

创建新的生成任务（剧本生成或分镜生成）。

**请求体（剧本生成）**：
```json
{
  "kind": "script-generation",
  "payload": {
    "text": "string (required)",
    "genre": "urban | xianxia | fantasy",
    "config": {
      "genre": "urban | xianxia | fantasy",
      "episodeCount": "integer (1-20)",
      "episodeDuration": "1:00-1:30 | 1:30-2:00 | 2:00-3:00",
      "style": "dramatic | comedic | suspense",
      "includeDirectorNotes": "boolean"
    },
    "analysis": "AnalysisResult (optional, 复用已有分析)"
  }
}
```

**请求体（分镜生成）**：
```json
{
  "kind": "storyboard-generation",
  "payload": {
    "scriptArtifactIds": "string[] (optional, 优先)",
    "scriptText": "string (optional, 手动输入)",
    "visualStyle": "string (optional)",
    "colorTone": "string (optional)",
    "genreLabel": "string (optional)",
    "safeMode": "boolean (optional)"
  }
}
```

> **输入优先级**：`scriptArtifactIds` > `scriptText`。至少需要一个。

**响应 200**：
```json
{
  "ok": true,
  "job": GenerationJob
}
```

**响应 400**：
```json
{ "ok": false, "error": "STORYBOARD_SOURCE_REQUIRED" }
{ "ok": false, "error": "SCRIPT_ARTIFACT_NOT_FOUND:artifactId" }
{ "ok": false, "error": "SCRIPT_ARTIFACT_NOT_IN_PROJECT:artifactId" }
{ "ok": false, "error": "SCRIPT_ARTIFACT_KIND_INVALID:artifactId" }
```

**响应 402**：
```json
{ "ok": false, "error": "INSUFFICIENT_CREDITS" }
```

### 5.3 获取单个任务详情

#### `GET /api/jobs/:id` 🔒

获取单个任务详情。

**响应 200**：
```json
{
  "ok": true,
  "job": GenerationJob
}
```

### 5.4 取消任务

#### `POST /api/projects/:projectId/jobs/:jobId` 🔒

更新任务状态（取消）。

---

## 6. Pipeline（一键链路）

### 6.1 创建 Pipeline

#### `POST /api/projects/:projectId/pipelines` 🔒

创建小说→分镜一键生成 Pipeline。后台自动串行执行剧本生成→分镜生成。

**请求体**：
```json
{
  "mode": "novel-to-storyboard",
  "payload": {
    "text": "string (required, min 1)",
    "genre": "urban | xianxia | fantasy",
    "config": {
      "genre": "urban | xianxia | fantasy",
      "episodeCount": "integer (1-20)",
      "episodeDuration": "1:00-1:30 | 1:30-2:00 | 2:00-3:00",
      "style": "dramatic | comedic | suspense",
      "includeDirectorNotes": "boolean"
    },
    "analysis": "AnalysisResult (optional)",
    "storyboardConfig": {
      "visualStyle": "string (optional)",
      "colorTone": "string (optional)",
      "genreLabel": "string (optional)",
      "safeMode": "boolean (optional)"
    }
  }
}
```

**响应 200**：
```json
{
  "ok": true,
  "pipeline": {
    "mode": "novel-to-storyboard",
    "job": GenerationJob
  }
}
```

**响应 402**：
```json
{ "ok": false, "error": "INSUFFICIENT_CREDITS" }
```

---

## 7. 工件（Artifacts）

### 7.1 获取任务工件列表

#### `GET /api/jobs/:id/artifacts` 🔒

获取指定任务生成的所有工件。

**响应 200**：
```json
{
  "ok": true,
  "artifacts": GenerationArtifact[]
}
```

### 7.2 获取工件版本列表

#### `GET /api/artifacts/:artifactId/versions` 🔒

获取工件的版本历史。

**响应 200**：
```json
{
  "ok": true,
  "versions": GenerationArtifact[]
}
```

### 7.3 下载工件

#### `GET /api/artifacts/:artifactId/download` 🔒

下载工件内容为文件。

**Query 参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `format` | string | 下载格式（可选） |

**响应**：文件流（Content-Disposition: attachment）

---

## 8. 导出

### 8.1 创建导出

#### `POST /api/projects/:projectId/exports` 🔒

创建项目的统一导出工件。

**请求体**：
```json
{
  "format": "markdown | json | text (default: markdown)"
}
```

**响应 200**：
```json
{
  "ok": true,
  "artifact": GenerationArtifact,
  "downloadUrl": "/api/artifacts/{artifactId}/download"
}
```

---

## 9. 支付与计费

### 9.1 计费摘要

#### `GET /api/billing/summary` 🔒

获取当前用户的计费信息摘要。

**响应 200**：
```json
{
  "ok": true,
  "subscription": Subscription,
  "creditAccount": CreditAccount,
  "plan": PlanCatalogEntry
}
```

### 9.2 PayPal 订阅

#### `POST /api/billing/paypal/create-subscription` 🔒

创建 PayPal 订阅。

**请求体**：
```json
{
  "planKey": "creator | pro"
}
```

**响应 200**：
```json
{
  "ok": true,
  "approvalUrl": "https://www.paypal.com/..."
}
```

### 9.3 PayPal 点数包购买

#### `POST /api/billing/paypal/create-order` 🔒

创建 PayPal 点数包订单。

**请求体**：
```json
{
  "creditPackKey": "credits-50 | credits-200 | credits-500"
}
```

**响应 200**：
```json
{
  "ok": true,
  "orderId": "string",
  "approvalUrl": "string"
}
```

#### `POST /api/billing/paypal/capture-order` 🔒

捕获 PayPal 订单支付。

**请求体**：
```json
{
  "orderId": "string"
}
```

**响应 200**：
```json
{
  "ok": true,
  "paymentOrder": PaymentOrder,
  "creditsGranted": "number"
}
```

### 9.4 PayPal Webhook

#### `POST /api/billing/paypal/webhook`

PayPal 服务端回调。**无需认证**，通过 webhook 签名验证。

**支持事件类型**：
- `BILLING.SUBSCRIPTION.ACTIVATED` — 订阅激活
- `BILLING.SUBSCRIPTION.CANCELLED` — 订阅取消
- `BILLING.SUBSCRIPTION.EXPIRED` — 订阅过期
- `PAYMENT.CAPTURE.COMPLETED` — 支付完成

### 9.5 Checkout Session（兼容层）

#### `POST /api/billing/checkout-session` 🔒

旧版结账入口（兼容重定向至 PayPal 流程）。

### 9.6 Portal Session

#### `POST /api/billing/portal-session` 🔒

跳转用户订阅管理页面。

---

## 10. 兑换码

### 10.1 兑换

#### `POST /api/redeem-codes/redeem` 🔒

用户兑换信用额度码。

**请求体**：
```json
{
  "code": "string"
}
```

**响应 200**：
```json
{
  "ok": true,
  "creditsGranted": "number"
}
```

**响应 400**：
```json
{ "ok": false, "error": "CODE_NOT_FOUND | CODE_EXPIRED | CODE_EXHAUSTED | ALREADY_REDEEMED" }
```

---

## 11. 管理员接口

### 11.1 开发场景

#### `POST /api/admin/dev/scenarios` 🔒 (admin)

开发环境专用，用于初始化测试场景数据。

### 11.2 确认支付订单

#### `POST /api/admin/payment-orders/:id/confirm` 🔒 (admin)

手动确认支付订单（管理员操作）。

### 11.3 兑换码活动管理

#### `POST /api/admin/redeem-code-campaigns` 🔒 (admin)

创建兑换码活动。

#### `POST /api/admin/redeem-code-campaigns/:id/generate` 🔒 (admin)

为活动批量生成兑换码。

---

## 12. 旧版接口（兼容层）

### 12.1 独立生成（不绑定项目）

#### `POST /api/generate`

旧版独立生成接口。后续将引导用户通过项目→Jobs 路径使用。

#### `POST /api/storyboard`

旧版独立分镜生成接口。后续将引导用户通过项目→Jobs 路径使用。

---

## 13. 错误码速查表

| 错误码 | HTTP | 场景 |
|--------|------|------|
| `PROJECT_NOT_FOUND` | 404 | 项目不存在或无权限 |
| `INSUFFICIENT_CREDITS` | 402 | 积分不足 |
| `STORYBOARD_SOURCE_REQUIRED` | 400 | 分镜未提供输入来源 |
| `SCRIPT_ARTIFACT_NOT_FOUND:{id}` | 400 | 剧本工件不存在 |
| `SCRIPT_ARTIFACT_NOT_IN_PROJECT:{id}` | 400 | 剧本工件不属于当前项目 |
| `SCRIPT_ARTIFACT_KIND_INVALID:{id}` | 400 | 工件类型非 script |
| `JOB_CREATE_FAILED` | 400 | 任务创建失败 |
| `PIPELINE_CREATE_FAILED` | 400 | Pipeline 创建失败 |
| `JOB_CANCELLED` | — | 内部：任务已取消 |
| `SCRIPT_JOB_PAYLOAD_MISSING` | — | 内部：剧本任务缺少 payload |
| `STORYBOARD_JOB_PAYLOAD_MISSING` | — | 内部：分镜任务缺少 payload |
| `LLM_CONFIG_MISSING` | — | 内部：LLM 配置缺失 |
| `CODE_NOT_FOUND` | 400 | 兑换码不存在 |
| `CODE_EXPIRED` | 400 | 兑换码已过期 |
| `CODE_EXHAUSTED` | 400 | 兑换码已用完 |
| `ALREADY_REDEEMED` | 400 | 用户已兑换过 |

---

## 14. API 路由总览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/session` | 获取 Session |
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:projectId` | 项目 Bundle |
| POST | `/api/projects/:projectId/source` | 保存原文 |
| GET | `/api/projects/:projectId/jobs` | 任务列表 |
| POST | `/api/projects/:projectId/jobs` | 创建任务 |
| GET/PATCH | `/api/projects/:projectId/jobs/:jobId` | 任务详情/更新 |
| POST | `/api/projects/:projectId/pipelines` | 创建 Pipeline |
| POST | `/api/projects/:projectId/exports` | 创建导出 |
| GET | `/api/jobs/:id` | 单个任务详情 |
| GET | `/api/jobs/:id/artifacts` | 任务工件列表 |
| GET | `/api/artifacts/:artifactId/versions` | 工件版本列表 |
| GET | `/api/artifacts/:artifactId/download` | 下载工件 |
| GET | `/api/billing/summary` | 计费摘要 |
| POST | `/api/billing/paypal/create-subscription` | PayPal 订阅 |
| POST | `/api/billing/paypal/create-order` | PayPal 点数包 |
| POST | `/api/billing/paypal/capture-order` | PayPal 捕获 |
| POST | `/api/billing/paypal/webhook` | PayPal Webhook |
| POST | `/api/billing/checkout-session` | Checkout（兼容） |
| POST | `/api/billing/portal-session` | Portal |
| POST | `/api/redeem-codes/redeem` | 兑换码兑换 |
| POST | `/api/admin/dev/scenarios` | 开发场景 |
| POST | `/api/admin/payment-orders/:id/confirm` | 确认订单 |
| POST | `/api/admin/redeem-code-campaigns` | 创建活动 |
| POST | `/api/admin/redeem-code-campaigns/:id/generate` | 生成兑换码 |
