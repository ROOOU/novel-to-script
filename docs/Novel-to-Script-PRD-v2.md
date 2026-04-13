# Novel-to-Script PRD v2（贴合当前仓库的执行版）

> 更新日期：2026-04-10  
> 目的：在不推翻现有 SaaS 工作台、任务、支付、鉴权、Artifact 体系的前提下，升级“原文 -> 分析 -> 大纲 -> 剧本 -> 分镜 -> 导出”核心链路。

## 1. 本版结论

当前项目已经不是早期的单页工具，而是一套可运行的内容生产 SaaS：

- 已有项目工作台、任务中心、ArtifactRelation、PayPal、Google 登录
- 已有一键 pipeline：`script-generation -> storyboard-generation`
- 已有结构化 storyboard metadata 和失败诊断

因此下一阶段不应该“推倒重写”，而应该在现有链路上补齐更强的中间状态层与最终提示词编译层。

## 2. 当前产品定位

当前产品定位为：

**面向视频生成前置环节的叙事结构化与提示词编译平台。**

平台输入：

- 小说原文
- 章节文本
- 剧情文本

平台输出：

- 分析
- 故事圣经 `StoryBible`
- 场景卡 `SceneCards`
- 大纲
- 剧本
- 分镜
- 结构化镜头计划 `ShotPlan`
- 可直接下游复用的提示词包 `PromptPack`

## 3. 本阶段必须坚持的边界

- 不接入视频生成 API
- 不在平台内直接生成视频
- 不做图片素材管理
- 不做复杂人物一致性系统
- 不砍掉现有 fallback 和多 provider 能力
- 不移除现有 `analysis / outline / script / storyboard`，而是在其上扩展

## 4. 当前现状判断

### 4.1 已有优势

- 已有 Next.js App Router + API + SaaS 工作台
- 已有 Job / Artifact / ArtifactRelation 基础设施
- 已有一键 pipeline 和任务追踪
- 已有 PayPal 计费和积分系统
- 已有 Google 登录和生产级会话桥接
- 已有 OpenAI-compatible LLM 网关层与 fallback

### 4.2 主要短板

1. 长文本仍然偏“单次分析”，复杂度识别不足  
2. `analysis` 和 `outline` 可用，但不够厚，难以承载长篇持续状态  
3. `storyboard` 已有结构化镜头 metadata，但还不是明确的 `shot_plan + prompt_pack` 双输出  
4. 快速模式与长篇模式还没有统一到底层一套引擎

## 5. 产品目标

### 5.1 总目标

将当前链路从：

`原文 -> 分析 -> 大纲 -> 剧本 -> 分镜`

升级为：

`原文 -> 分析 -> StoryBible -> SceneCards -> 大纲 -> 剧本 -> ShotPlan -> PromptPack -> 导出`

### 5.2 执行原则

- 用户可以看到“快速模式 / 长篇模式”两个入口
- 系统底层只维护一套工作流
- 短文本是长流程的退化情况，不再独立维护第二套引擎
- 新增结构层必须复用现有 Job / Artifact / ArtifactRelation 体系

## 6. 核心工作流

### 6.1 第一步：文本预处理

输出：

- `cleanedText`
- `textStats`
- `estimatedSceneBreaks`
- `estimatedTimeJumps`
- `estimatedPovSwitches`

### 6.2 第二步：复杂度判定

新增 `decidePipelineMode(input)`：

- `direct`
- `segmented`

判定因素：

- 文本长度
- 场景切换密度
- 时间跳跃
- 视角切换
- 角色密度

### 6.3 第三步：StoryBible

这是全局叙事状态层，至少包含：

- 项目摘要
- 题材
- themes
- toneGuide
- characters
- locations
- props
- timeline
- unresolvedThreads

### 6.4 第四步：SceneCards

这是场级中间状态层，至少包含：

- `sceneId`
- `title`
- `summary`
- `characters`
- `location`
- `time`
- `goal`
- `conflict`
- `turningPoint`
- `visualBeats`
- `continuityIn`
- `continuityOut`

### 6.5 第五步：剧本

剧本生成继续保留现有优势，但生成输入要逐步从“analysis + outline”过渡为：

- StoryBible
- SceneCards
- 用户配置

### 6.6 第六步：ShotPlan

将 storyboard 从“提示词文本”为主，升级为“结构化镜头计划”：

- `shotId`
- `sceneId`
- `order`
- `durationSec`
- `shotType`
- `subject`
- `location`
- `primaryAction`
- `secondaryAction`
- `emotion`
- `cameraMotion`
- `lighting`
- `continuityNote`

### 6.7 第七步：PromptPack

从 ShotPlan 编译得到最终可复制结果：

- `mainPrompt`
- `negativePrompt`
- `styleHints`
- `safetyNotes`
- `copyReadyText`
- `targetPlatform`

## 7. 执行策略

### Phase A：补齐结构层，不动主 UI 骨架

目标：

- 新增 `story_bible`
- 新增 `scene_cards`
- 新增 `shot_plan`
- 新增 `prompt_pack`

要求：

- 继续保留 `analysis / outline / script / storyboard`
- 在现有工作台中先通过 ArtifactBrowser 和 lineage 可见
- 不强制一上来就重做所有 tab

### Phase B：统一模式引擎

目标：

- 快速模式 / 长篇模式共用一套 engine
- 新增复杂度判定
- 对复杂文本走 segmented

### Phase C：结果页重构

结果页逐步升级为：

- 总览
- StoryBible
- SceneCards
- 剧本
- ShotPlan
- PromptPack
- 任务

## 8. API 与数据要求

### 8.1 保留现有兼容

现有接口不删除：

- `/api/generate`
- `/api/storyboard`
- `/api/projects/[projectId]/jobs`
- `/api/projects/[projectId]/pipelines`

### 8.2 新增字段允许渐进启用

`StoryboardGenerateRequestV2` 逐步支持：

- `storyBible`
- `sceneCards`
- `outputMode`
- `targetPlatform`
- `characterRefs`
- `locationRefs`
- `continuityHints`

## 9. 代码落地顺序

### 第一批

1. `src/server/shared/platform/domain/entities.ts`
2. `src/server/script-generation/application/run-script-generation.ts`
3. `src/server/storyboard/application/run-storyboard-generation.ts`
4. `src/server/generation/processor.ts`
5. `src/features/storyboard/contracts.ts`

### 第二批

1. `src/server/story-engine/complexity.ts`
2. `src/server/story-engine/chunking.ts`
3. `src/server/story-engine/story-bible.ts`
4. `src/server/storyboard/prompt-compiler.ts`

### 第三批

1. `src/features/saas/ProjectWorkspaceClient.tsx`
2. `src/features/saas/project/AssetBrowserPanel.tsx`
3. `src/features/saas/project/StoryboardPanel.tsx`
4. `src/features/saas/project/JobTimelinePanel.tsx`

## 10. 当前立即执行项

这一轮直接落地的内容：

- 在现有脚本链路中补出 `story_bible` 与 `scene_cards`
- 在现有分镜链路中补出 `shot_plan` 与 `prompt_pack`
- 保持现有 PayPal / 登录 / 工作台 / pipeline 不回退
- 先让新结构层进入 Artifact 体系，再继续做复杂度引擎

## 11. 不执行的建议

以下内容本版明确不采纳：

- 删除 LLM fallback
- 强制只支持单 provider
- 现在就废弃 analysis / outline
- 现在就做复杂分镜可视化编辑器
- 现在就接入下游视频平台 API

## 12. 成功标准

本阶段完成后，系统要同时满足：

- 原有生产链路不倒退
- 新 artifact 类型能随任务自动产出
- 新产物能被下载、浏览、追踪来源
- 后续可以在不推翻现有链路的前提下继续接入 segmented 长文本引擎
