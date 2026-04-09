# QA Test Plan - NovelScript SaaS

> 基于文档：`docs/functional-specification.md`、`docs/comprehensive-prd.md`  
> 目的：提炼可直接转化为 Jest/Vitest/集成测试的核心验收标准，覆盖 P0 主流程与关键约束。

---

## 1. 测试目标

确保 NovelScript SaaS 作为“面向个人创作者的项目制 AI 创作平台”满足以下核心要求：

1. 用户以 **项目** 为唯一主入口，而不是分散工具页。
2. 创作链路支持 **原文 → 分析 → 大纲 → 剧本 → 分镜** 的资产化沉淀。
3. 任一阶段产物都可 **浏览、追溯、下载、复用**。
4. 一键 Pipeline 与手动链路都满足 **阶段可见、关系可追溯、失败可恢复**。
5. Credits / 套餐 / PayPal 支付 / 并发与权限约束行为正确。
6. 前台 UI 不暴露 Workspace / Organization 等多租户复杂度。

---

## 2. 推荐测试分层

### 2.1 单元测试（Jest/Vitest）
- slug 生成、字数统计、输入校验、credits 估算
- storyboard payload 规范化
- entitlements 校验
- artifact relation 写入逻辑
- 错误码映射

### 2.2 集成测试
- API 路由：auth / project / source / jobs / pipeline / exports / billing
- DB 持久化结果：Project / SourceDocument / GenerationJob / GenerationArtifact / ArtifactRelation / CreditLedgerEntry
- webhook 幂等性

### 2.3 端到端测试（后续可补 Playwright）
- 登录后首页跳转
- 项目内完整创作流程
- 剧本完成后继续生成分镜
- 导出中心与任务中心展示

---

## 3. 核心验收标准总表

## A. 用户认证与初始化

### A1. 注册自动初始化
**验收标准**
- 用户注册成功后，系统自动创建：`User`、`Organization`、`Workspace`、`CreditAccount`、`Subscription(free)`。
- 自动发放 Free 计划 30 credits。
- 注册完成后跳转到 `/{locale}/projects`。
- 前端不展示 Organization / Workspace 创建过程。

**建议断言**
- `User.status === 'active'`
- `Workspace.slug === 'default'`
- `Subscription.planKey === 'free'`
- 存在 `CreditLedgerEntry.kind === 'subscription_grant'`
- `availableCredits === 30`

### A2. 登录与 viewer 上下文
**验收标准**
- 登录成功后生成 session，并更新 `User.lastLoginAt`。
- 受保护 API 能通过 `requireViewerResponse()` 解析到完整 `viewer`。

**建议断言**
- viewer 包含 `user / organization / workspace / subscription / creditAccount`
- 未登录访问受保护 API 返回认证失败

---

## B. 首页、导航与产品定位

### B1. 首页路由正确
**验收标准**
- 未登录访问 `/` 显示 Landing Page。
- 已登录访问 `/` 自动跳转到 `/{locale}/projects`。

### B2. 旧路径兼容
**验收标准**
- `/console` 重定向到 `/{locale}/projects`。
- `/storyboard`：已登录跳项目中心，未登录回 Landing。

### B3. 导航去工具化、多租户隐藏
**验收标准**
- 已登录导航仅体现 `Projects / Pricing / Credits / Avatar`。
- UI 中不出现 `Workspace`、`Organization`、`Team`、`Enterprise` 等字样。
- 不存在独立“工具页”主入口。

---

## C. 项目中心

### C1. 创建项目
**验收标准**
- 可用 `name / description / genre` 创建项目。
- 自动生成唯一 `slug`，冲突时追加后缀。
- 新项目默认 `status = 'draft'`。
- 项目归属于当前 viewer 的 organization / workspace。

### C2. 项目数权益限制
**验收标准**
- Free 用户最多 2 个项目。
- Creator 用户最多 15 个项目。
- Pro 用户无限。
- 超限时创建失败并返回明确错误。

### C3. 项目列表与 Bundle 聚合
**验收标准**
- 列表按 `updatedAt DESC` 排序。
- 项目详情返回 `project + sourceDocuments + jobs + artifacts + artifactRelations + insights`。

### C4. 项目归档/删除
**验收标准**
- 归档会把项目状态置为 `archived`，并写入 `archivedAt`。
- 删除符合软删除/归档语义，不应造成非预期硬删除。

---

## D. 原文输入与素材管理

### D1. 原文保存
**验收标准**
- 可通过 `POST /api/projects/[projectId]/source` 保存 `title + textContent`。
- 首次保存创建 `SourceDocument(kind='novel')`。
- 再次保存更新同一原文而非重复创建。
- `Project.sourceDocumentId` 正确关联。
- 正确计算中文字数。

### D2. 权限与归属校验
**验收标准**
- 无权限用户不能写入他人项目原文。
- 项目不存在返回 `PROJECT_NOT_FOUND` 或等价错误。

### D3. 原文回看
**验收标准**
- 项目工作台原文 Tab 总是能显示最新 `textContent`。

### D4. 文件上传（P1 预埋）
**验收标准**
- txt/md/docx 上传后能抽取文本并落入同一 `SourceDocument` 数据模型。

---

## E. 剧本生成链路

### E1. 生成配置合法性
**验收标准**
- 剧本配置支持：`genre`、`episodeCount(1-20)`、`episodeDuration`、`style`、`includeDirectorNotes`。
- 非法参数应被拒绝。

### E2. 剧本任务创建
**验收标准**
- 创建 `script-generation` Job 前先做 credits 预估和预留。
- 任务初始状态为 `queued`。
- 超过并发限制时不能创建新任务。

### E3. 剧本任务执行与工件沉淀
**验收标准**
- 任务执行阶段依次表现为：预处理 → 分析 → 大纲 → 剧本(逐集) → 完成。
- 会生成：1 个 analysis、1 个 outline、N 个 script 工件。
- 所有工件归属当前项目并可在 Bundle 中查到。

### E4. 剧本链路关系追溯
**验收标准**
- 自动写入 `analysis -> outline` 的 `derived_from` 关系。
- 自动写入 `outline -> script(每集)` 的 `derived_from` 关系。

### E5. Credits 结算
**验收标准**
- 估算公式：`30 + max(1, episodeCount) * 15`。
- 成功时 credits 从 `reserved -> captured`。
- 失败/取消时 credits 从 `reserved -> released`。

### E6. 剧本完成后的关键联动
**验收标准**
- 剧本完成后，UI 必须出现主按钮：**继续生成分镜**。
- 每一集剧本都支持查看、复制、下载、再生成。
- 分析与大纲也支持浏览与下载。

### E7. 错误处理
**验收标准**
- LLM 失败时任务标记 failed，并释放预留 credits。
- credits 不足返回 `INSUFFICIENT_CREDITS`（HTTP 402）。
- 取消任务后状态变更为 `cancelled`，不继续后续流程。

---

## F. 分镜生成链路

### F1. 输入优先级与校验
**验收标准**
- `scriptArtifactIds` 优先级高于 `scriptText`。
- `scriptArtifactIds` 会去重、去空。
- 每个 script artifact 必须存在、属于当前项目、且 `kind === 'script'`。
- 当 `scriptArtifactIds` 和 `scriptText` 均为空时，返回 `STORYBOARD_SOURCE_REQUIRED`。

### F2. 分镜执行过程
**验收标准**
- 任务阶段应体现：解析 → 角色/场景识别 → 生成 → 流式输出 → 完成。
- 失败时可在同一工作台重试，不要求切页。

### F3. 分镜工件与关系
**验收标准**
- 成功后创建 storyboard 工件。
- 自动写入 `script -> storyboard` 的 `derived_from` 关系。
- 分镜 metadata 中记录来源剧本版本 ID / `sourceScriptArtifactIds`。

### F4. 安全模式
**验收标准**
- `safeMode = true` 时，敏感内容被替换或标注。
- 若触发 `content_policy_blocked`，整个任务失败。

### F5. Credits 结算
**验收标准**
- 估算公式：`max(8, episodeCount * 8)`。
- 成功捕获、失败/取消释放。

### F6. P1 结构化分镜输出
**验收标准**
- 除文本外，还应输出结构化镜头 JSON。
- JSON 至少包含：`sceneId, shotId, shotType, camera, composition, motion, subject, environment, lighting, audioHint, videoPrompt`。

### F7. P1 选择生成范围
**验收标准**
- 支持全剧本 / 指定集 / 指定场景生成分镜。

---

## G. 小说 → 分镜 Pipeline

### G1. Pipeline 串行编排
**验收标准**
- `POST /api/projects/[projectId]/pipelines` 可创建 `novel-to-storyboard` 链路。
- 后台顺序必须是：剧本 Job 成功后，再自动创建分镜 Job。
- 不能绕过剧本阶段直接得到分镜。

### G2. 中间资产保留
**验收标准**
- 一键模式下，分析、大纲、剧本、分镜都必须保留为独立工件。
- 中间阶段在前端必须显式可见，不能完全隐藏。

### G3. 失败与中途停下
**验收标准**
- 如果剧本阶段失败，分镜 Job 不创建。
- 用户取消剧本 Job 后，Pipeline 停止，已生成剧本工件保留。
- 用户可在剧本阶段手动调整后，再单独触发分镜。

### G4. Pipeline 元数据
**验收标准**
- 剧本 Job metadata 中带有 `pipelineMode: 'novel-to-storyboard'`。
- 分镜与剧本之间存在明确 artifact relation 和来源 ID。

---

## H. 资产浏览与导出

### H1. 统一资产浏览
**验收标准**
- 导出/资产中心统一展示 analysis / outline / script / storyboard。
- 支持按类型筛选、按时间倒序排列。

### H2. 依赖关系展示
**验收标准**
- 工件视图能展示上游与下游依赖关系。
- 历史工件若无 relation，降级显示“无依赖数据（历史产物）”。

### H3. 导出格式
**P0 验收标准**
- 支持 TXT / Markdown / JSON 导出。
- Markdown 导出应按 kind 追加合理标题结构。
- JSON 导出包含完整结构化数据。

**P1 验收标准**
- 支持 DOCX。
- 分镜支持 CSV。

---

## I. 任务中心

### I1. 任务状态机
**验收标准**
- 状态流转符合：`queued -> running -> succeeded/failed/cancelled`。
- `failed -> queued` 支持重试语义。
- `queued` 也可直接取消。

### I2. 任务列表字段
**验收标准**
- 展示：任务类型、状态、创建时间、进度、当前阶段、已结算积分、错误信息。

### I3. 阶段化进度
**验收标准**
- 剧本任务显示细粒度阶段进度，不是只显示流式文本。
- 分镜任务显示解析/识别/生成/流式输出等阶段。
- Pipeline 模式下两个子任务进度独立展示。

---

## J. Credits、套餐与并发控制

### J1. 套餐权益
**验收标准**
- Free / Creator / Pro 月 credits、项目数、最大并发均符合文档。
- 所有计划：`maxMembers = 1`、`maxWorkspaces = 1`、`canUseTeamCollaboration = false`。

### J2. 并发控制
**验收标准**
- 创建 Job 前检查当前 workspace 活跃任务数。
- 超过 `entitlements.maxConcurrentJobs` 时应拒绝新任务。

### J3. Credits 账户与流水一致性
**验收标准**
- credits 变更必须能在 `CreditLedgerEntry` 中追溯来源。
- job 成本、订阅发放、点数包充值类型区分明确。

---

## K. 支付系统（PayPal 替代 Stripe）

### K1. PayPal 订阅支付
**验收标准**
- 可创建 PayPal Subscription 并返回 approval URL。
- PayPal webhook `BILLING.SUBSCRIPTION.ACTIVATED` 到达后，系统 upsert 当前订阅并发放月 credits。

### K2. 点数包购买
**验收标准**
- 可创建 PayPal Order。
- capture 成功后写入 `PaymentOrder(status='paid')`。
- credits 正确增加，并写入 `CreditLedgerEntry`。

### K3. Webhook 签名与幂等
**验收标准**
- webhook 会校验 `PAYPAL_WEBHOOK_ID`。
- 同一 `providerOrderId` / `providerSubscriptionId` 不会重复交付 credits 或重复创建订阅。

### K4. Stripe 完全移除
**验收标准**
- 代码、依赖、环境变量、前端入口均不再包含 Stripe。
- 定价页只展示 USD 和 PayPal。

---

## L. 国际化与文案约束

### L1. i18n 覆盖
**验收标准**
- 用户可见文本支持 `zh-CN / en-US`。
- 套餐名称和描述通过 i18n 配置提供。

### L2. 文案收口
**验收标准**
- 前台产品叙事聚焦个人创作者，不再以 Team / Enterprise 为主叙事。

---

## M. 错误码与异常处理

### M1. 错误码正确性
**重点断言**
- `PROJECT_NOT_FOUND` -> 404
- `INSUFFICIENT_CREDITS` -> 402
- `STORYBOARD_SOURCE_REQUIRED` -> 400
- `SCRIPT_ARTIFACT_NOT_FOUND` -> 400
- `SCRIPT_ARTIFACT_NOT_IN_PROJECT` -> 400
- `SCRIPT_ARTIFACT_KIND_INVALID` -> 400
- `JOB_CREATE_FAILED` -> 400
- `PIPELINE_CREATE_FAILED` -> 400

### M2. 失败后的资源一致性
**验收标准**
- 失败任务不会留下错误归属的工件关系。
- credits 不会重复扣减。
- 已成功沉淀的上游工件不会因下游失败被误删。

---

## 4. 建议优先落地的测试清单（首批）

### P0 首批必须有
1. 注册自动创建 free 订阅 + 30 credits
2. 已登录首页跳转到 `/projects`
3. 创建项目时项目数权益限制
4. 保存原文创建/更新 `SourceDocument`
5. 剧本任务成功生成 analysis + outline + N scripts
6. 剧本任务写入 artifact relations
7. 剧本完成后“继续生成分镜”联动存在
8. 分镜生成校验 `scriptArtifactIds` 优先级与归属
9. 分镜 metadata 记录来源 script ID
10. Pipeline：剧本成功后自动创建分镜任务
11. Pipeline：剧本失败时不创建分镜任务
12. 导出中心可导出 TXT/Markdown/JSON
13. 任务状态机与阶段化进度正确
14. credits reserve/capture/release 生命周期正确
15. PayPal webhook 幂等，不重复发放权益
16. UI / 接口不暴露 Workspace/Organization 概念

### P1 第二批建议补齐
1. 文件上传 txt/md/docx 文本抽取
2. 分镜结构化 JSON 输出
3. 指定集/场景生成分镜
4. DOCX / CSV 导出
5. 失败重试链路
6. 用量与权益可视化

---

## 5. 测试数据建议

### 用户样例
- `free_user`
- `creator_user`
- `pro_user`

### 项目样例
- 无原文项目
- 有原文未生成项目
- 有完整 analysis/outline/script/storyboard 项目
- 含历史无 relation 工件项目

### 剧本/分镜输入样例
- 最小合法原文
- 长文本原文
- 多集剧本
- 非法 scriptArtifactId
- 跨项目 scriptArtifactId
- safeMode 敏感内容样例

---

## 6. 结论

这份 QA 计划的核心是把产品验收标准转成三类可测试对象：

1. **链路正确**：从原文到分镜的生成流程必须可串联。
2. **资产正确**：每个阶段产物必须可落库、可追溯、可下载。
3. **系统正确**：权益、计费、支付、并发、错误处理必须一致。

如需继续推进，下一步可直接基于本文件拆分：
- `tests/unit/*.test.ts`
- `tests/integration/api/*.test.ts`
- `tests/integration/pipeline/*.test.ts`
- `tests/integration/billing/*.test.ts`
