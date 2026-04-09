# PayPal Sandbox 联调清单

更新时间：2026-03-24

这份清单基于当前仓库实现整理，目标是把真实 PayPal Sandbox 联调步骤与本项目现状一一对应，避免“官方文档正确，但和本地实现不完全对齐”。

## 1. 当前实现结论

当前仓库对 PayPal 的接入分成两条链路：

- `credit-pack`：前端已对齐为 PayPal JavaScript SDK Buttons，后端负责创建订单与捕获支付。
- `subscription`：前端仍是后端创建订阅后跳转到 PayPal approval URL，权益最终以 webhook 为准。

对应代码入口：

- 点数包创建订单：[src/app/api/billing/paypal/create-order/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/billing/paypal/create-order/route.ts)
- 点数包捕获支付：[src/app/api/billing/paypal/capture-order/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/billing/paypal/capture-order/route.ts)
- 订阅创建：[src/app/api/billing/paypal/create-subscription/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/billing/paypal/create-subscription/route.ts)
- Webhook 验签与处理：[src/app/api/billing/paypal/webhook/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/billing/paypal/webhook/route.ts)
- PayPal REST API 封装：[src/server/billing/paypal.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/billing/paypal.ts)
- 定价页前端入口：[src/features/saas/PricingClient.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/PricingClient.tsx)
- 点数包 Buttons 组件：[src/features/saas/paypal/PayPalCreditPackButtons.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/paypal/PayPalCreditPackButtons.tsx)
- 账单页支付回流：[src/features/saas/BillingClient.tsx](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/features/saas/BillingClient.tsx)

## 2. 官方模式与本项目映射

PayPal 官方标准 Checkout 当前推荐的是：

- 前端用 JavaScript SDK Buttons
- 后端用 `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` 调 Orders API
- 订单确认后由后端 capture
- Webhook 作为异步补偿与最终一致性保障

和本项目的对应关系：

- `credit-pack`：完全符合这条模式
- `subscription`：暂未改成 JS SDK Buttons，但仍是后端驱动创建 + webhook 生效，业务上可用

官方参考：

- Standard Checkout: [https://developer.paypal.com/docs/checkout/standard/integrate/](https://developer.paypal.com/docs/checkout/standard/integrate/)
- Orders API v2: [https://developer.paypal.com/docs/api/orders/v2/](https://developer.paypal.com/docs/api/orders/v2/)
- Verify Webhook Signature: [https://developer.paypal.com/docs/api/webhooks/v1/](https://developer.paypal.com/docs/api/webhooks/v1/)
- Sandbox Guide: [https://developer.paypal.com/tools/sandbox/](https://developer.paypal.com/tools/sandbox/)
- Sandbox Accounts: [https://developer.paypal.com/api/rest/sandbox/accounts/](https://developer.paypal.com/api/rest/sandbox/accounts/)
- Webhooks Simulator: [https://developer.paypal.com/api/rest/webhooks/simulator/](https://developer.paypal.com/api/rest/webhooks/simulator/)
- Subscriptions Test & Go Live: [https://developer.paypal.com/docs/subscriptions/test-subscriptions/](https://developer.paypal.com/docs/subscriptions/test-subscriptions/)

## 3. Sandbox 前置准备

### 3.1 Developer Dashboard

1. 登录 PayPal Developer Dashboard。
2. 切换到 `Sandbox`。
3. 在 `Apps & Credentials` 下创建或确认存在一个 Sandbox App。
4. 记录：
   - `Client ID`
   - `Client Secret`
5. 在 `Sandbox > Accounts` 确认至少有两类账号：
   - `Business` 卖家账号
   - `Personal` 买家账号

### 3.2 Webhook

1. 为 Sandbox App 创建 webhook。
2. Webhook URL 指向你本地可公网访问的地址，例如：
   - `https://your-tunnel-domain/api/billing/paypal/webhook`
3. 记录 `Webhook ID`。
4. 建议订阅至少这些事件：
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`

## 4. 本地环境变量

当前仓库最少需要这些变量：

```env
NEXT_PUBLIC_APP_URL=https://your-tunnel-domain

PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id

PAYPAL_PLAN_ID_CREATOR=your-sandbox-plan-id
PAYPAL_PLAN_ID_PRO=your-sandbox-plan-id
```

已有模板见 [\.env.local.example](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/.env.local.example)。

注意：

- 当前定价页会把 `PAYPAL_CLIENT_ID` 作为 server component prop 传给前端按钮组件使用，因此本地必须配置该值。
- `NEXT_PUBLIC_APP_URL` 必须是 PayPal 能回跳到的公网 HTTPS 地址，localhost 不能直接用于真实 sandbox 回调。
- 如果你用 tunnel，请确保 PayPal 回调和 JS SDK 页面访问的域名一致。

## 5. 启动前自检

在开始真人 sandbox 联调前，先确认本地基线是绿的：

```bash
npm run check:paypal:sandbox
npm run test
npm run typecheck
npm run test:smoke:paypal
```

当前本地已有这些保障：

- PayPal sandbox readiness 静态检查
- PayPal route tests
- webhook route tests
- payments/paypal service tests
- 离线 smoke：`create-order -> webhook -> credits到账`

## 6. 真实 Sandbox 联调步骤

### 6.1 启动本地服务

1. 配好 `.env.local`
2. 启动本地服务：

```bash
npm run dev
```

3. 用 tunnel 暴露公网 HTTPS 地址。
4. 确认这些地址可访问：
   - `https://your-tunnel-domain/zh-CN/pricing`
   - `https://your-tunnel-domain/zh-CN/billing`
   - `https://your-tunnel-domain/api/billing/paypal/webhook`

### 6.2 联调一：点数包 credit-pack

目标：验证 JS SDK Buttons + 后端 create/capture + 账单刷新。

步骤：

1. 登录本地站点。
2. 打开 `/zh-CN/pricing`。
3. 在点数包卡片下确认 PayPal Buttons 正常渲染。
4. 点击购买点数。
5. 使用 Sandbox Personal 买家账号完成支付。
6. JS SDK Buttons 会先在 `createOrder` 回调内调用：
   - `POST /api/billing/paypal/create-order`
7. 用户在 PayPal 侧确认后，`onApprove` 再调用：
   - `POST /api/billing/paypal/capture-order`
8. 前端成功后跳转到 `/zh-CN/billing?checkout=success&purchaseKind=credit-pack`。
9. 在账单页确认：
   - `credits` 余额增加
   - 新增一条 `payment order`
   - 新增一条 `pack_purchase` ledger entry

建议同时观察：

- 浏览器 Network：
  - `create-order` 返回 `paymentOrderId` 和 `providerOrderId`
  - `capture-order` 返回 `ok: true`
- 账单页 UI：
  - 出现 “PayPal payment completed. Credits are available now.” 或中文对应提示

通过标准：

- `paymentOrders.status === paid`
- `creditAccount.availableCredits` 增加
- 不需要手工再次 capture

### 6.3 联调二：订阅 subscription

目标：验证 redirect 发起 + PayPal 订阅 + webhook 发放权益。

步骤：

1. 登录本地站点。
2. 打开 `/zh-CN/pricing`。
3. 点击某个非免费套餐的订阅按钮。
4. 前端调用 `POST /api/billing/paypal/create-subscription`。
5. 浏览器跳转到 PayPal approval URL。
6. 使用 Sandbox Personal 买家账号完成订阅。
7. 回站到 `/zh-CN/billing?checkout=success&purchaseKind=subscription&paymentOrderId=...`
8. 等待 PayPal webhook 命中本地 `/api/billing/paypal/webhook`
9. 刷新账单页，确认：
   - `subscription.status === active`
   - `subscription.planKey` 正确
   - 月度 credits 已发放

通过标准：

- 本地 `payment order` 变为 `paid`
- `subscriptions` 当前记录已激活
- `creditAccount.availableCredits` 增加

注意：

- 订阅当前不是 JS SDK Buttons 模式，属于后端生成 approval URL 后跳转
- 订阅权益以 webhook 为准，不应只依赖回跳页面

### 6.4 联调三：Webhook

目标：验证签名校验、事件处理、幂等性。

步骤：

1. 在 PayPal Developer Dashboard 或 Webhooks Simulator 中发送测试事件。
2. 优先验证：
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
3. 本地观察 webhook route 返回：
   - `ok: true`
   - `received: true`

当前项目的签名校验依赖这些 header：

- `PAYPAL-TRANSMISSION-ID`
- `PAYPAL-TRANSMISSION-TIME`
- `PAYPAL-TRANSMISSION-SIG`
- `PAYPAL-CERT-URL`
- `PAYPAL-AUTH-ALGO`

对应实现见 [src/server/billing/paypal.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/server/billing/paypal.ts) 和 [src/app/api/billing/paypal/webhook/route.ts](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/src/app/api/billing/paypal/webhook/route.ts)。

## 7. 联调时的推荐观察点

### 浏览器侧

- `/pricing` 页是否成功加载 PayPal JS SDK
- credit-pack 按钮是否渲染
- `create-order` 返回的 `providerOrderId` 是否为真实 PayPal order id
- `capture-order` 是否只触发一次

### 服务端侧

- webhook 是否收到且验签成功
- `paymentOrders` 是否从 `pending` 变为 `paid`
- `creditLedger` 是否新增一条正确的 grant 记录
- 重复 webhook 是否不会重复发放 credits

### UI 侧

- `/billing` 页提示文案是否和真实状态一致
- credits 余额是否即时刷新
- 订单列表是否出现对应 `providerOrderId`

## 8. 常见失败与排查

### 8.1 Buttons 不渲染

先检查：

- `PAYPAL_CLIENT_ID` 是否已配置
- 页面是否在 HTTPS 域名下
- 浏览器控制台是否有 JS SDK 加载错误

### 8.2 create-order 成功，但支付后不到账

先检查：

- `capture-order` 是否成功返回 `200`
- `webhook` 是否也成功到达
- `/zh-CN/billing` 是否成功刷新 summary

### 8.3 订阅回站了，但权益未生效

先检查：

- `PAYPAL_WEBHOOK_ID` 是否正确
- webhook URL 是否可被 PayPal 访问
- 是否收到了 `BILLING.SUBSCRIPTION.ACTIVATED`
- `PAYPAL_PLAN_ID_CREATOR` / `PAYPAL_PLAN_ID_PRO` 是否对应正确 Sandbox Plan

### 8.4 Webhook 收到但验签失败

先检查：

- `PAYPAL_WEBHOOK_ID` 是否来自同一个 Sandbox App
- 当前请求是否来自 Sandbox 而非 Live
- tunnel 是否篡改了 body 或 header

### 8.5 重复到账风险

当前服务层对已支付订单做了幂等保护，但联调时仍应刻意验证：

1. 同一支付完成后刷新账单页
2. 重复触发 webhook
3. 确认 credits 不会再次增加

## 9. 建议的真实验收顺序

1. 本地跑：
   - `npm run check:paypal:sandbox`
   - `npm run test`
   - `npm run typecheck`
   - `npm run test:smoke:paypal`
2. 先联调 `credit-pack`
3. 再联调 `subscription`
4. 最后用 webhook simulator 补发事件验证幂等性与取消路径

## 10. 上线切换清单

Sandbox 验证通过后，再切到 Live：

1. 在 Developer Dashboard 新建或切换到 Live App
2. 替换：
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_WEBHOOK_ID`
   - `PAYPAL_PLAN_ID_CREATOR`
   - `PAYPAL_PLAN_ID_PRO`
3. 设置：

```env
PAYPAL_MODE=live
```

4. 把 Webhook URL 指向正式域名
5. 再走一遍小额真实支付验收

## 11. 当前已知实现差异

截至 2026-03-24，当前代码仍有一个明确差异需要记住：

- `credit-pack`：已是 JS SDK Buttons 模式
- `subscription`：仍是 approval URL redirect 模式，不是 JS SDK Buttons 模式

这不影响 Sandbox 联调，但会影响你在验收时对“是否全站都是标准 Buttons”的判断。

## 12. 联调结果回填

真实 sandbox 跑完后，至少要同步回填这三处：

1. 在 [docs/paypal-sandbox-execution-report.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/paypal-sandbox-execution-report.md) 记录实际环境、结果、异常和结论。
2. 更新 [docs/comprehensive-prd.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/comprehensive-prd.md) 里的支付验收状态。
3. 更新 [docs/development-plan.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/development-plan.md) 的 Phase 5 sandbox 项，避免文档继续和实际验收状态脱节。
