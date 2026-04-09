import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from './check-paypal-sandbox-readiness.mjs';

const PLAN_DEFINITIONS = [
  {
    envKey: 'PAYPAL_PLAN_ID_CREATOR',
    slug: 'creator',
    name: 'NovelScript Creator Monthly',
    description: 'Creator plan for individual adaptation workflows.',
    value: '9.90',
  },
  {
    envKey: 'PAYPAL_PLAN_ID_PRO',
    slug: 'pro',
    name: 'NovelScript Pro Monthly',
    description: 'Pro plan for high-volume creators.',
    value: '29.00',
  },
];

function loadEnvFile(cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env.local');
  if (!existsSync(envPath)) {
    throw new Error(`Missing .env.local at ${envPath}`);
  }

  const content = readFileSync(envPath, 'utf8');
  const fileEnv = parseEnvFile(content);
  return { envPath, content, fileEnv };
}

function resolvePayPalEnv(cwd = process.cwd()) {
  const { envPath, content, fileEnv } = loadEnvFile(cwd);
  const env = {
    ...fileEnv,
    ...process.env,
  };

  const clientId = env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim();
  const mode = env.PAYPAL_MODE?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in .env.local');
  }

  return {
    envPath,
    content,
    env,
    clientId,
    clientSecret,
    mode,
    baseUrl: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
  };
}

async function payPalRequest(baseUrl, accessToken, pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal API ${pathname} failed (${response.status}): ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function createAccessToken(config) {
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal OAuth failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('PayPal OAuth response did not include access_token');
  }

  return payload.access_token;
}

async function createProduct(baseUrl, accessToken) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const product = await payPalRequest(baseUrl, accessToken, '/v1/catalogs/products', {
    method: 'POST',
    body: JSON.stringify({
      name: `NovelScript Membership ${timestamp}`,
      description: 'Subscription product for NovelScript sandbox validation.',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });

  if (!product?.id) {
    throw new Error('PayPal product creation succeeded without returning an id');
  }

  return product;
}

async function createPlan(baseUrl, accessToken, productId, definition) {
  const plan = await payPalRequest(baseUrl, accessToken, '/v1/billing/plans', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      name: definition.name,
      description: definition.description,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: definition.value,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: '0',
        inclusive: false,
      },
    }),
  });

  if (!plan?.id) {
    throw new Error(`PayPal plan creation for ${definition.slug} succeeded without returning an id`);
  }

  try {
    await payPalRequest(baseUrl, accessToken, `/v1/billing/plans/${encodeURIComponent(plan.id)}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('PLAN_STATUS_INVALID')) {
      throw error;
    }
  }

  return plan;
}

function updateEnvValue(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }

  const trimmed = content.endsWith('\n') ? content : `${content}\n`;
  return `${trimmed}${key}=${value}\n`;
}

function persistPlanIds(envPath, content, planMap) {
  let nextContent = content;
  for (const [key, value] of Object.entries(planMap)) {
    nextContent = updateEnvValue(nextContent, key, value);
  }
  writeFileSync(envPath, nextContent, 'utf8');
}

export async function provisionPayPalSandboxPlans(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = resolvePayPalEnv(cwd);

  if (config.mode !== 'sandbox') {
    throw new Error(`Expected PAYPAL_MODE=sandbox, received ${config.mode}`);
  }

  const accessToken = await createAccessToken(config);
  const product = await createProduct(config.baseUrl, accessToken);

  const createdPlans = [];
  for (const definition of PLAN_DEFINITIONS) {
    const plan = await createPlan(config.baseUrl, accessToken, product.id, definition);
    createdPlans.push({
      ...definition,
      id: plan.id,
      status: plan.status ?? 'UNKNOWN',
    });
  }

  const planMap = Object.fromEntries(createdPlans.map((plan) => [plan.envKey, plan.id]));
  persistPlanIds(config.envPath, config.content, planMap);

  return {
    envPath: config.envPath,
    productId: product.id,
    plans: createdPlans,
  };
}

function formatResult(result) {
  const lines = [
    'PayPal sandbox plans created successfully.',
    `- productId: ${result.productId}`,
    `- env file updated: ${result.envPath}`,
    '',
    'Plans:',
  ];

  for (const plan of result.plans) {
    lines.push(`- ${plan.envKey}=${plan.id} (${plan.status})`);
  }

  return `${lines.join('\n')}\n`;
}

export async function runProvisionPayPalSandboxPlans(options = {}) {
  const result = await provisionPayPalSandboxPlans(options);
  if (options.stdout?.write) {
    options.stdout.write(formatResult(result));
  } else {
    process.stdout.write(formatResult(result));
  }
  return result;
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedFilePath && currentFilePath === invokedFilePath) {
  runProvisionPayPalSandboxPlans().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
