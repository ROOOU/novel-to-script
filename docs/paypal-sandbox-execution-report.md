# PayPal Sandbox 执行记录

更新时间：2026-03-24
状态：待执行

这份文档用于记录真实 PayPal Sandbox 联调结果。只有在这里留下可复核记录后，才应更新 [docs/comprehensive-prd.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/comprehensive-prd.md) 和 [docs/development-plan.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/development-plan.md) 中对应的 Phase 5 验收状态。

## 1. 执行信息

| 字段 | 值 |
|------|----|
| 执行日期 | 待填写 |
| 执行人 | 待填写 |
| Git 提交 / 分支 | 待填写 |
| 环境 | Sandbox |
| Tunnel / 公网域名 | 待填写 |
| PayPal App | 待填写 |
| Seller 账号 | 待填写 |
| Buyer 账号 | 待填写 |
| Webhook ID | 待填写 |

## 2. 启动前基线

| 检查项 | 结果 | 备注 |
|--------|------|------|
| `npm run check:paypal:sandbox` | 待填写 | 贴摘要 |
| `npm run test` | 待填写 | |
| `npm run typecheck` | 待填写 | |
| `npm run test:smoke:paypal` | 待填写 | |

## 3. Credit-Pack 联调

| 项目 | 预期 | 实际 | 结果 |
|------|------|------|------|
| Pricing 页成功加载 PayPal JS SDK | Buttons 正常渲染 | 待填写 | 待填写 |
| `POST /api/billing/paypal/create-order` | 返回 `paymentOrderId` + `providerOrderId` | 待填写 | 待填写 |
| `POST /api/billing/paypal/capture-order` | 返回 `ok: true` | 待填写 | 待填写 |
| 回跳到 `/billing?checkout=success&purchaseKind=credit-pack` | 成功 | 待填写 | 待填写 |
| `paymentOrders.status` | `paid` | 待填写 | 待填写 |
| `creditAccount.availableCredits` | 增加 | 待填写 | 待填写 |
| `creditLedger` | 新增 `pack_purchase` | 待填写 | 待填写 |

## 4. Subscription 联调

| 项目 | 预期 | 实际 | 结果 |
|------|------|------|------|
| `POST /api/billing/paypal/create-subscription` | 返回 `approvalUrl` | 待填写 | 待填写 |
| 浏览器跳转到 PayPal approval URL | 成功 | 待填写 | 待填写 |
| 回跳到 `/billing?checkout=success&purchaseKind=subscription&paymentOrderId=...` | 成功 | 待填写 | 待填写 |
| Webhook 到达 `/api/billing/paypal/webhook` | 成功验签 | 待填写 | 待填写 |
| `paymentOrders.status` | `paid` | 待填写 | 待填写 |
| `subscription.status` | `active` | 待填写 | 待填写 |
| `subscription.planKey` | 匹配购买计划 | 待填写 | 待填写 |
| `creditAccount.availableCredits` | 增加 | 待填写 | 待填写 |

## 5. Webhook 验证

| 事件 | 预期 | 实际 | 结果 |
|------|------|------|------|
| `PAYMENT.CAPTURE.COMPLETED` | 正常处理 / 幂等 | 待填写 | 待填写 |
| `BILLING.SUBSCRIPTION.ACTIVATED` | 正常发放订阅权益 | 待填写 | 待填写 |
| `BILLING.SUBSCRIPTION.CANCELLED` | 订阅正确变更状态 | 待填写 | 待填写 |
| 重复发送同一事件 | 不重复发放 credits | 待填写 | 待填写 |

## 6. 观察值

### 6.1 账单页

- 当前套餐：待填写
- Credits 余额：待填写
- 新增 payment order：待填写
- 新增 ledger entry：待填写

### 6.2 Network / Server

- 关键 request / response：待填写
- Webhook 验签结果：待填写
- 错误码 / 异常栈：待填写

## 7. 结论

- Credit-pack：待填写
- Subscription：待填写
- Webhook：待填写
- 是否可以勾选 Phase 5 的两项 PayPal sandbox 验收：待填写

## 8. 回填动作

完成联调后，按顺序回填：

1. 更新本文件的最终结论和日期。
2. 更新 [docs/comprehensive-prd.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/comprehensive-prd.md) 中支付验收勾选。
3. 更新 [docs/development-plan.md](/Users/shengyufei/Desktop/op%20短剧_副本/novel-to-script/docs/development-plan.md) Phase 5 中的 PayPal sandbox 项。
