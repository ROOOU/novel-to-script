# Reviewer Notes

> 角色：Code Reviewer（架构与代码审查）
> 来源文档：`docs/database-schema.md`、`docs/api-specification.md`
> 用途：作为 Builder 完成后的验收清单与审查基线
> 更新时间：2026-03-24

---

## 1. 我对当前架构的理解

这是一个围绕 **“项目（Project）驱动的小说→剧本→分镜→导出”** 的 SaaS 平台，核心特征有 4 个：

1. **多租户结构明确**：`users -> organizations -> workspaces -> projects`
2. **创作流程全量落库**：原文、任务、工件、工件关系都保留，可追踪可回放
3. **计费与生成解耦但联动**：任务创建时要经过积分校验/预留/结算
4. **接口以 Project 为主入口**：前端主要通过项目聚合读取数据，再对 jobs/artifacts 做细分操作

整体上是一个典型的：
- 上层：Session + Project-oriented API
- 中层：Generation Pipeline / Billing / Redeem Code 业务服务
- 下层：PostgreSQL + Drizzle ORM 的实体快照型存储

---

## 2. 数据模型的核心设计理解

## 2.1 租户与身份域

### `users`
用户主体，邮箱全局唯一，支持状态流转：`active | invited | suspended | deleted`。

### `organizations`
真正的计费/资源归属主体。订阅、积分账户、支付订单都挂在 organization 下。

### `workspaces`
组织下的工作空间，用于隔离项目与默认配置。`(organizationId, slug)` 唯一。

### 审查重点
- 大多数业务资源都必须同时带 `organizationId`，很多还要带 `workspaceId`
- Builder 的实现里不能只按 `id` 查询后直接返回，必须验证资源是否属于当前 viewer 的 organization/workspace

---

## 2.2 创作链路域

### `projects`
项目是业务中心。
- 挂靠到 `organizationId` + `workspaceId`
- 有 `sourceDocumentId` 作为当前原文指针
- 有 `latestGenerationJobId` 作为快捷访问指针

### `source_documents`
项目原始输入与其他来源文档的统一载体。
- `kind` 支持：`novel | script | outline | storyboard | reference | export`
- `textContent` 可直接存正文
- 未来也允许 `storageKey` 外部存储

我理解当前主流程里，至少要稳定支持 **novel 原文保存/更新**。

### `generation_jobs`
任务是异步执行单元。
- `kind`：`script-generation | storyboard-generation | export-generation | analysis-generation`
- `status`：`queued | running | succeeded | failed | cancelled`
- `billingState`：`none | reserved | captured | released`
- `inputSnapshot` 保存发起时输入快照
- `progress/currentStep` 用于前端状态展示

这意味着任务创建不是简单插入一条记录，而是要保证：
- 输入快照可复现
- 积分状态与任务状态一致
- 失败/取消时有正确回滚或释放语义

### `generation_artifacts`
工件是任务输出结果。
- `kind`：`analysis | outline | script | storyboard | export | prompt`
- 支持版本化：`version`、`parentArtifactId`、`versionGroupId`
- 支持可编辑标记：`isEditable`
- 支持元数据扩展

这里说明系统不是“一次生成后即覆盖”，而是**保留产物历史**。

### `artifact_relations`
记录工件之间的派生关系，当前主要是 `derived_from`。

关键价值：
- 能表达 `analysis -> outline -> script -> storyboard` 链路
- 支持从分镜反查来源剧本，从剧本反查来源 outline
- 审查时要看 Builder 是否真的写入关系，而不只是生成了 artifacts

---

## 2.3 计费与积分域

### `subscriptions`
每个 organization 只有一个当前订阅（`organizationId` 唯一）。
包含 plan、计费周期、权益 `entitlements` 等。

### `payment_orders`
支付订单既支持订阅，也支持点数包：`purchaseKind = subscription | credit-pack`。

### `credit_accounts`
组织级积分总账。

关键公式：
`availableCredits = grantedCreditsTotal - consumedCreditsTotal - reservedCredits`

### `credit_ledger_entries`
积分流水是审计核心。
典型类型：
- 发放：`subscription_grant` / `pack_purchase` / `redeem_code_grant`
- 消耗链路：`job_reserve` / `job_capture` / `job_release`

我对系统计费语义的理解：
1. 创建任务前先检查可用积分
2. 创建任务时预留积分（reserve）
3. 成功完成后 capture
4. 失败/取消时 release

因此后续审查要重点检查：**job 状态变化和 ledger 变化是否成对出现**。

---

## 2.4 兑换码域

- `redeem_code_campaigns`：活动模板
- `redeem_codes`：具体兑换码实例
- `redeem_code_redemptions`：兑换记录

这是一个典型的一次或多次发放额度机制，要求防重、防超限、防过期。

---

## 2.5 基础设施域

### `platform_store_snapshots`
运行时快照表，不属于核心业务链路，但用于持久化平台状态。

---

## 3. Schema 设计上的关键约束理解

## 3.1 全表 audit columns + `data` 快照列
每张业务表都有：
- `createdAt`
- `createdByUserId`
- `updatedAt`
- `updatedByUserId`
- `data: jsonb`

这说明实现上不能只维护结构化字段；还要同步维护完整 JSON 快照，否则会破坏设计假设。

### 审查重点
- 插入和更新时是否同步刷新 `data`
- `updatedAt` 是否在每次修改时更新
- 审计字段是否尽可能记录真实操作用户

## 3.2 不使用数据库级外键
文档明确说明：**依赖应用层保证数据一致性**。

这会带来两个后果：
1. Builder 必须在 service/repository 层手动校验关联资源存在性与归属
2. 删除/更新操作更容易产生脏数据，代码里必须更严谨

### 审查重点
- 是否做了 parent-child ownership 校验
- 是否只按主键更新而没有验证租户边界
- 是否在创建 artifact/job/redeem record 时校验上游实体存在

---

## 4. API 设计的核心理解

## 4.1 统一约定
- Base URL：`/api`
- 认证：Cookie Session
- 认证上下文：`{ user, organization, workspace, subscription, creditAccount }`
- 成功：`{ ok: true, ... }`
- 失败：`{ ok: false, error }`
- POST/PATCH 用 zod 校验

### 审查重点
- 所有 🔒 接口都必须经过 `requireViewerResponse()` 或等价认证保护
- 响应结构要统一，不要混出别的 envelope
- 参数校验不能缺省，尤其是创建任务与支付类接口

---

## 4.2 项目相关 API 是主工作流入口

### `GET /api/projects`
返回当前用户可见项目列表。

### `POST /api/projects`
创建项目。

### `GET /api/projects/:projectId`
返回 Project Bundle：
- `project`
- `sourceDocuments`
- `jobs`
- `artifacts`
- `artifactRelations`
- `insights`

这是很关键的聚合接口，意味着前端项目页很可能依赖它一次性还原项目全貌。

### 审查重点
- Bundle 查询是否完整
- 是否按项目归属过滤，而不是把其他项目的数据带出来
- `insights` 是否有合理默认值或聚合逻辑

---

## 4.3 原文管理

### `POST /api/projects/:projectId/source`
语义不是“新增任意 source_document”，而是：
- 项目已有 source document 时更新
- 否则创建新的

### 审查重点
- 是否正确维护 `projects.sourceDocumentId`
- 更新时是否保留项目与文档关系一致性
- `title/textContent` 是否按 zod 要求校验

---

## 4.4 Jobs 与 Pipeline

### `POST /api/projects/:projectId/jobs`
支持两类核心任务：
- `script-generation`
- `storyboard-generation`

#### 剧本生成输入
基于原文文本 + config，可附带复用分析结果。

#### 分镜生成输入
优先级：`scriptArtifactIds > scriptText`，至少提供一种。
还要求校验：
- artifact 存在
- artifact 属于当前 project
- artifact.kind = `script`

### `POST /api/projects/:projectId/pipelines`
一键串行链路：小说→剧本→分镜。
本质上是对 jobs 的更高层编排，首个返回对象里仍然落到一个 `GenerationJob`。

### 审查重点
- 是否严格校验 storyboard 输入来源
- 是否正确返回约定错误码
- job 创建时是否写入 `inputSnapshot`
- pipeline 是否真正串行编排，而不是只创建一个壳记录
- 任务取消接口是否真的能落库到 `cancelled` 及相关时间字段

---

## 4.5 Artifacts 与导出

### `GET /api/jobs/:id/artifacts`
按 job 读取输出工件。

### `GET /api/artifacts/:artifactId/versions`
读取版本链。

### `GET /api/artifacts/:artifactId/download`
下载工件内容为文件流。

### `POST /api/projects/:projectId/exports`
创建项目统一导出工件，并返回下载地址。

### 审查重点
- 下载接口是否正确设置 MIME / attachment
- 版本列表是否按同一 `versionGroupId` 或等价逻辑聚合
- 导出生成是否写成 artifact，而不是只临时拼接响应

---

## 4.6 Billing / Redeem / Admin

这些接口虽然不一定是 Builder 当前第一阶段重点，但如果已实现，需要遵守下面原则：
- PayPal webhook 无需 session，但必须有签名校验
- 点数包捕获后要同步 `payment_orders` + `credit_accounts` + `credit_ledger_entries`
- 兑换码兑换要防重、防超限、防越权
- admin 接口要有额外权限校验，不能只有登录态

---

## 5. Builder 实现后我会重点验收的清单

## A. 多租户与权限
- [ ] 所有受保护接口都有认证
- [ ] 所有 project/job/artifact/source 查询都校验 organization / workspace 归属
- [ ] 不存在只按资源 `id` 查询后直接返回的越权风险

## B. 数据模型落地完整性
- [ ] Drizzle schema 与文档字段一致，枚举值没有擅自变更
- [ ] 关键唯一索引存在
- [ ] 所有业务表都包含 audit columns 与 `data` 字段
- [ ] 插入/更新时 `data` 快照同步刷新

## C. 项目与原文
- [ ] `POST /api/projects` 创建后字段完整
- [ ] `POST /api/projects/:projectId/source` 能正确创建或更新 source document
- [ ] `projects.sourceDocumentId` 会被正确维护

## D. 任务系统
- [ ] `POST /api/projects/:projectId/jobs` 支持 script / storyboard 两类任务
- [ ] `generation_jobs.inputSnapshot` 被完整保存
- [ ] `progress/currentStep/status` 字段有清晰生命周期
- [ ] 任务取消会更新 `cancelledAt` 和状态

## E. 分镜输入校验
- [ ] 未提供 `scriptArtifactIds` 或 `scriptText` 时返回 `STORYBOARD_SOURCE_REQUIRED`
- [ ] `scriptArtifactIds` 中任一 artifact 不存在时返回 `SCRIPT_ARTIFACT_NOT_FOUND:{id}`
- [ ] artifact 不属于当前项目时返回 `SCRIPT_ARTIFACT_NOT_IN_PROJECT:{id}`
- [ ] artifact 类型非 `script` 时返回 `SCRIPT_ARTIFACT_KIND_INVALID:{id}`

## F. 工件与关系链
- [ ] 任务成功后能生成对应 artifacts
- [ ] 工件 `kind/format/version/isEditable` 等字段合理
- [ ] 上下游产物会写入 `artifact_relations`
- [ ] 版本链字段 `parentArtifactId/versionGroupId/version` 有一致语义

## G. Pipeline
- [ ] `/api/projects/:projectId/pipelines` 真正编排小说→剧本→分镜
- [ ] 串行执行时能把上游输出传给下游
- [ ] pipeline 失败时状态、错误、积分处理一致

## H. 计费与积分
- [ ] 创建任务前校验积分余额
- [ ] reserve / capture / release 与 job 状态联动一致
- [ ] `credit_accounts` 数值与 `credit_ledger_entries` 语义一致
- [ ] 返回 `INSUFFICIENT_CREDITS` 的场景正确

## I. API 一致性
- [ ] 成功/失败响应 envelope 统一
- [ ] POST/PATCH 有 zod 校验
- [ ] HTTP 状态码与文档约定一致
- [ ] 路由路径与文档一致，没有私自漂移

## J. 下载与导出
- [ ] `/api/artifacts/:artifactId/download` 真正返回文件流
- [ ] `/api/projects/:projectId/exports` 会创建 export artifact
- [ ] `downloadUrl` 可用且与 artifact 对应

---

## 6. 我认为最容易出问题的地方

1. **多租户越权**：没有数据库 FK 时，最容易出现“查到了别的组织的数据”
2. **任务与积分状态不一致**：比如任务失败了但积分没 release
3. **只写结构化列，不更新 `data` 快照**：后续读模型可能失真
4. **artifact relation 漏写**：页面能显示结果，但无法形成完整链路
5. **pipeline 只是表面接口**：只创建首个 job，没有真正完成串行编排
6. **storyboard 输入校验不完整**：尤其是跨项目 artifact 引用
7. **项目 bundle 聚合不完整**：导致前端详情页缺数据

---

## 7. 给主审/后续验收的建议

如果 Builder 提交代码，我建议按下面顺序审：

1. **先看 schema.ts**：字段、索引、枚举是否贴文档
2. **再看 viewer/auth 中间层**：多租户边界是否稳
3. **再看 projects/source/jobs/pipelines 的 route + service**：主链路是否打通
4. **最后看 billing / redeem / export**：这些是扩展但高风险模块

测试优先级建议：
1. 创建项目
2. 保存原文
3. 发起剧本生成任务
4. 用 script artifact 发起分镜任务
5. 拉取 project bundle 校验聚合结果
6. 校验积分 reserve/capture/release
7. 取消任务与失败回滚

---

## 8. 结论

当前文档定义的不是一个“纯接口拼装型应用”，而是一个：
- 有明确租户边界
- 有完整创作产物链
- 有任务状态机
- 有积分结算语义
- 有项目聚合读模型
的 SaaS 平台。

因此后续代码审查标准不应只看“接口能不能跑通”，而应重点检查：
- **边界是否对**
- **状态是否一致**
- **链路是否可追踪**
- **数据是否可审计**

如果这四件事都成立，Builder 的实现才算真正贴合当前架构规范。
