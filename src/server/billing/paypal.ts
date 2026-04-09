import { Buffer } from 'node:buffer';

export type PayPalMode = 'sandbox' | 'live';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
  baseUrl: string;
  webhookId?: string | null;
}

export interface PayPalMoney {
  currency_code: 'USD';
  value: string;
}

export interface PayPalApprovalResult {
  id: string;
  approvalUrl: string;
  raw: PayPalApiResponse;
}

export interface PayPalOrderInput {
  customId: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  invoiceId?: string;
}

export interface PayPalSubscriptionInput {
  customId: string;
  planId: string;
  returnUrl: string;
  cancelUrl: string;
  subscriberEmail?: string;
  subscriberName?: string;
}

export interface PayPalWebhookVerificationInput {
  event: Record<string, unknown>;
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
}

export interface PayPalWebhookVerificationHeaders {
  transmissionId?: string | null;
  transmissionTime?: string | null;
  transmissionSig?: string | null;
  certUrl?: string | null;
  authAlgo?: string | null;
}

type PayPalApiResponse = Record<string, unknown> & {
  id?: string;
  links?: Array<Record<string, unknown>>;
};

const DEFAULT_PAYPAL_HTTP_TIMEOUT_MS = 15_000;

let accessTokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

export function resetPayPalAccessTokenCacheForTests() {
  accessTokenCache = null;
}

export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const mode = process.env.PAYPAL_MODE?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() || null;

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_NOT_CONFIGURED: missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  return {
    clientId,
    clientSecret,
    mode,
    baseUrl: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    webhookId,
  };
}

export function isPayPalEnabled(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

export async function createPayPalOrder(input: PayPalOrderInput): Promise<PayPalApprovalResult> {
  const config = getPayPalConfig();
  const response = await payPalRequest<PayPalApiResponse>(config, '/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.customId,
          custom_id: input.customId,
          invoice_id: input.invoiceId ?? input.customId,
          description: input.description,
          amount: formatPayPalAmount(input.amountCents),
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'NovelScript',
      },
    }),
  });

  const approvalUrl = findPayPalApprovalUrl(response);
  if (!response.id || !approvalUrl) {
    throw new Error('PAYPAL_ORDER_APPROVAL_URL_MISSING');
  }

  return {
    id: response.id,
    approvalUrl,
    raw: response,
  };
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalApiResponse> {
  const config = getPayPalConfig();
  return payPalRequest<PayPalApiResponse>(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createPayPalSubscription(input: PayPalSubscriptionInput): Promise<PayPalApprovalResult> {
  const config = getPayPalConfig();
  const response = await payPalRequest<PayPalApiResponse>(config, '/v1/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.customId,
      subscriber: input.subscriberEmail
        ? {
            email_address: input.subscriberEmail,
            name: input.subscriberName
              ? {
                  given_name: input.subscriberName,
                }
              : undefined,
          }
        : undefined,
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        brand_name: 'NovelScript',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
      },
    }),
  });

  const approvalUrl = findPayPalApprovalUrl(response);
  if (!response.id || !approvalUrl) {
    throw new Error('PAYPAL_SUBSCRIPTION_APPROVAL_URL_MISSING');
  }

  return {
    id: response.id,
    approvalUrl,
    raw: response,
  };
}

export async function verifyPayPalWebhookSignature(input: PayPalWebhookVerificationInput): Promise<boolean> {
  const config = getPayPalConfig();
  if (!config.webhookId) {
    throw new Error('PAYPAL_WEBHOOK_NOT_CONFIGURED: missing PAYPAL_WEBHOOK_ID');
  }

  const response = await payPalRequest<PayPalApiResponse>(config, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSig,
      transmission_time: input.transmissionTime,
      webhook_id: config.webhookId,
      webhook_event: input.event,
    }),
  });

  const status = String(response.verification_status ?? '').toUpperCase();
  return status === 'SUCCESS';
}

export function resolvePayPalWebhookHeaders(headers: Headers): PayPalWebhookVerificationHeaders {
  return {
    transmissionId: readHeader(headers, ['paypal-transmission-id', 'transmission-id']),
    transmissionTime: readHeader(headers, ['paypal-transmission-time', 'transmission-time']),
    transmissionSig: readHeader(headers, ['paypal-transmission-sig', 'transmission-sig']),
    certUrl: readHeader(headers, ['paypal-cert-url', 'cert-url']),
    authAlgo: readHeader(headers, ['paypal-auth-algo', 'auth-algo']),
  };
}

function readHeader(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function formatPayPalAmount(amountCents: number): PayPalMoney {
  return {
    currency_code: 'USD',
    value: (amountCents / 100).toFixed(2),
  };
}

function findPayPalApprovalUrl(response: PayPalApiResponse): string | null {
  const links = Array.isArray(response.links) ? response.links : [];
  const approvalLink = links.find((link) => {
    const rel = String(link.rel ?? link.relationship ?? '').toLowerCase();
    return rel === 'approve' || rel === 'payer-action';
  });

  const href = approvalLink?.href;
  return typeof href === 'string' ? href : null;
}

async function getPayPalAccessToken(config: PayPalConfig): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 30_000) {
    return accessTokenCache.token;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${config.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`PAYPAL_TOKEN_TIMEOUT: ${resolvePayPalHttpTimeoutMs()}ms`);
    }
    throw new Error(`PAYPAL_TOKEN_NETWORK_FAILED: ${resolveErrorMessage(error)}`);
  }

  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(buildPayPalApiError('TOKEN', response.status, payload));
  }

  const token = typeof payload.access_token === 'string' ? payload.access_token : null;
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 300;
  if (!token) {
    throw new Error('PAYPAL_ACCESS_TOKEN_MISSING');
  }

  accessTokenCache = {
    token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };

  return token;
}

async function payPalRequest<T extends PayPalApiResponse>(
  config: PayPalConfig,
  path: string,
  init: RequestInit
): Promise<T> {
  const token = await getPayPalAccessToken(config);
  let response: Response;
  const context = normalizePayPalErrorContext(path);
  try {
    response = await fetchWithTimeout(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`PAYPAL_${context}_TIMEOUT: ${resolvePayPalHttpTimeoutMs()}ms`);
    }
    throw new Error(`PAYPAL_${context}_NETWORK_FAILED: ${resolveErrorMessage(error)}`);
  }

  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(buildPayPalApiError(context, response.status, payload));
  }

  return payload as T;
}

async function parseJsonOrText(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {
      message: text.slice(0, 500),
    };
  }

  return {
    message: text.slice(0, 500),
  };
}

function buildPayPalApiError(context: string, status: number, payload: Record<string, unknown>): string {
  const message = typeof payload.message === 'string'
    ? payload.message
    : typeof payload.error_description === 'string'
      ? payload.error_description
      : typeof payload.name === 'string'
        ? payload.name
        : 'PAYPAL_API_ERROR';

  return `PAYPAL_${context}_FAILED: ${status} ${message}`;
}

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'PAYPAL_NETWORK_ERROR';
}

function normalizePayPalErrorContext(path: string): string {
  return path
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'REQUEST';
}

function resolvePayPalHttpTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.PAYPAL_HTTP_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAYPAL_HTTP_TIMEOUT_MS;
  }
  return parsed;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolvePayPalHttpTimeoutMs());

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = Reflect.get(error, 'name');
  return name === 'AbortError';
}
