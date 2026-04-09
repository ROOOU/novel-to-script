This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 一键启动

在 macOS 上，直接双击工作区根目录下的 `start.command`，它会自动进入 `novel-to-script` 目录、安装依赖（如有需要）、启动开发服务器并打开浏览器。

## 后端环境变量

API Key、Base URL、模型名现在统一放在后端环境变量中，前端页面不再提供填写入口，也不会把这些信息存到浏览器。

这套接入是 `OpenAI-compatible` 的，所以除了 OpenAI 官方接口，也支持自建/中转网关，例如 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)。

在项目根目录创建 `.env.local`：

```bash
LLM_API_KEY=sk-...
# 可选，默认 https://api.openai.com/v1
LLM_BASE_URL=https://api.openai.com/v1
# 可选，默认 gemini-2.5-flash
LLM_MODEL_NAME=gemini-2.5-flash
```

如果你准备接入 `new-api + Gemini`，可以直接这样配：

```bash
LLM_API_KEY=sk-newapi-...
LLM_BASE_URL=https://your-new-api-domain.com/v1
LLM_MODEL_NAME=gemini-2.5-flash
```

如果你希望主线路失效时自动切备用线路，还可以额外配置：

```bash
LLM_FALLBACKS=[{"apiKey":"sk-backup","baseUrl":"https://backup-gateway.example.com/v1","modelName":"gemini-2.5-flash","label":"backup"}]
```

补充说明：

- `LLM_BASE_URL` 要指向 `new-api` 的 OpenAI 兼容根路径，通常需要带 `/v1`
- `LLM_MODEL_NAME` 直接填写 `new-api` 暴露出来的 Gemini 模型 ID，例如 `gemini-2.5-flash`、`gemini-2.5-pro-thinking`
- 可以先请求 `GET /v1/models` 确认你实例里实际可用的模型名
- 本项目当前走的是 `chat.completions` 文本生成链路，适合 Gemini 经 `new-api` 暴露的 OpenAI 兼容接口；如果后面要用 OpenAI 风格工具调用，`new-api` 文档说明 Gemini 这条转换目前仍有能力差异
- `LLM_FALLBACKS` 是一个 JSON 数组；当主 provider 返回 `401/403/404/429/5xx`、超时或网络错误时，应用会自动切到备用 provider

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
