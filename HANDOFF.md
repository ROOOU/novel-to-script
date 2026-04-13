# HANDOFF.md

## 1. 已完成的功能 / 任务

### 核心产品链路

当前生产主链路已经稳定在：

`原文 -> 分析 -> 大纲 -> 剧本 -> 分镜 -> 导出`

并且近期已经完成多轮线上排障与修复，包括：

- 原文上传后卡在分析阶段的问题排查与修复
- 分镜阶段流式调用长期挂起的问题修复
- 分镜 JSON 解析失败时的多层 fallback 补强
- 分镜诊断信息在工作台和时间线中的可视化展示

### 登录与支付

- Google-only 登录链路已修复并稳定
- Clerk 登录回跳与 session bridge 已优化
- PayPal live 支付链路已修复并实测通过
- Creator 价格已调整为 `$19.90`
- 生产环境当前以 PayPal 为主支付方案

### 前端与工作台

- 已完成一轮基于 Clay 风格方向的前端重构
- Pricing / Projects / Billing / Project Workspace 已做统一视觉收口
- 中文界面下大量英文漏出已修复
- 分镜诊断信息已出现在：
  - 分镜详情面板
  - 任务时间线

### LLM / Provider 层

- 运行时配置已统一为：
  - `LLM_API_KEY`
  - `LLM_BASE_URL`
  - `LLM_MODEL_NAME`
  - `LLM_FALLBACKS`
- 旧的 `OPENAI_* / API_* / MODEL_NAME` 兼容主路径已移除
- 项目保留 OpenAI-compatible client 层，以兼容 `new-api` 这类网关
- fallback 能力保留，不允许为了“简化”而移除

### PRD v2 第一阶段

已经根据执行版 PRD v2 落地了新的 artifact 结构层，且本地测试通过：

- `story_bible`
- `scene_cards`
- `shot_plan`
- `prompt_pack`

相关实现已接入：

- script generation 阶段可产出 `story_bible / scene_cards`
- storyboard generation 阶段可产出 `shot_plan / prompt_pack`
- artifact relation / workspace / presentation 已认识这些新类型

关键文件：

- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/server/shared/platform/domain/entities.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/server/script-generation/application/run-script-generation.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/server/storyboard/application/run-storyboard-generation.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/server/storyboard/prompt-compiler.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/server/generation/processor.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/features/saas/project/AssetBrowserPanel.tsx`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/features/saas/project/artifact-lineage.ts`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/src/features/saas/project/presentation.ts`

### PRD v2 第二阶段基础

复杂度识别与分段执行的“元数据基础层”已经落地：

- 新增 story engine：
  - `complexity.ts`
  - `chunking.ts`
- 请求类型、route、pipeline service 已能识别：
  - `generationMode`
  - `targetOutput`
  - `executionMode`
  - `complexityInfo`
  - `chunkPlan`

并且这一轮已完成一个重要收口：

- `pipelineMode` 现在只表示 `'novel-to-storyboard'`
- `direct | segmented` 现在统一叫 `executionMode`

这项收口已完成对应测试与 build 验证。

## 2. 当前正在处理的内容

当前正在推进的是 `Novel-to-Script-PRD-v2.md` 的 Phase 2。

现阶段状态：

- 已完成 Phase 2 的命名与元数据边界收口
- 还没有开始真正的 segmented 行为执行

也就是说，现在系统已经能：

- 评估文本复杂度
- 产出 `complexityInfo`
- 产出 `chunkPlan`
- 判定 `executionMode = direct | segmented`

但目前还不能说“长文本已经真的走了分段分析 / 分段汇总 / 分段剧本生成”。

当前 Phase 2 更准确的状态是：

- 元数据和接口准备好了
- 真正的分段执行逻辑还没开始

最自然的下一步是：

1. 在 script generation 中引入 segmented 的第一版行为
2. 先做“分段分析 + 汇总”而不是一口气做完整多阶段分段引擎
3. 保持对现有 `analysis / outline / script / storyboard` 的兼容

## 3. 还未解决的问题

### 1. Segmented 还只是元数据，不是完整执行模式

虽然已经有：

- `executionMode`
- `complexityInfo`
- `chunkPlan`

但系统当前仍然主要按单次分析 / 单次 outline / 单次 script 生成在跑。

这意味着：

- 长文本支持仍处于“前置准备阶段”
- 真正的复杂长篇可靠性还没有完全建立

### 2. 新 artifact 已接入，但 UI 还只是最小可见

`story_bible / scene_cards / shot_plan / prompt_pack` 已经进入 artifact 体系，
但前端还没有形成完整的新结果页结构。

当前仍以旧主骨架为主：

- analysis
- outline
- script
- storyboard

后续还需要逐步补齐：

- StoryBible 可视化
- SceneCards 结构化浏览
- ShotPlan 专门视图
- PromptPack 面向下游平台的展示与导出

### 3. 分镜结构化仍然依赖 fallback

虽然分镜解析已经大幅增强，但当前模型输出仍可能命中：

- `text-derived`
- `partial-text-derived`

这说明：

- 链路稳定性已经比以前好很多
- 但“上游稳定返回严格结构化 shot JSON”这件事仍未完全解决

### 4. 一些本地改动尚未提交 / 推送 / 部署

当前工作树有较多未提交改动，包含：

- PRD v2 文档
- README / AGENTS
- Phase 1 新 artifact 实现
- Phase 2 executionMode 收口

这些内容已经过局部测试和 build，但尚未统一提交、推 GitHub、发生产。

## 4. 重要的设计决策和约定

### 架构决策

1. 这是一个“增量演进的生产系统”，不是重写项目  
不允许为了“更优雅”而推翻现有 Job / Artifact / ArtifactRelation / Workspace 体系。

2. 保留现有 artifact 主链  
现有这些 artifact 不能直接砍掉：

- `analysis`
- `outline`
- `script`
- `storyboard`

新结构必须以增量方式加入：

- `story_bible`
- `scene_cards`
- `shot_plan`
- `prompt_pack`

3. 优先保链路稳定，而不是追求一次性理想结构  
比如 storyboard 解析要优先 graceful degradation，而不是严格失败。

### 命名约定

这一条非常重要，后续不要再混：

- `pipelineMode` 只用于表示 pipeline 标识  
  当前有效值：`'novel-to-storyboard'`

- `executionMode` 只用于表示执行模式  
  当前有效值：`'direct' | 'segmented'`

看到 `'novel-to-storyboard'`，字段名只能叫 `pipelineMode`。  
看到 `'direct' | 'segmented'`，字段名只能叫 `executionMode`。

### Provider / LLM 约定

1. LLM 统一配置使用：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL_NAME`
- `LLM_FALLBACKS`

2. 不删除 OpenAI-compatible client 层  
因为这层正被 `new-api` 等网关复用。

3. 不删除 fallback  
这是生产稳定性要求，不是可选优化。

### 登录与支付约定

1. 登录保持 Google-only  
不要无意中把邮箱密码登录、多 provider 登录重新带回来。

2. 当前生产支付主线是 PayPal  
不要按 Stripe-first 思路判断当前架构。

### 设计与协作文档

当前协作文档应优先看：

- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/AGENTS.md`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/README.md`
- `/Users/shengyufei/Desktop/op 短剧_副本/novel-to-script/docs/Novel-to-Script-PRD-v2.md`

### 推荐接手顺序

如果下一位继续做 Phase 2，建议按这个顺序：

1. 先从 `complexity.ts / chunking.ts / pipeline-service.ts / generate route` 理解现在的元数据边界
2. 再从 `run-script-generation.ts` 开始做 segmented 的第一版真实行为
3. 做完后同步更新：
   - route tests
   - pipeline service tests
   - processor tests
   - pipeline flow tests
   - build

