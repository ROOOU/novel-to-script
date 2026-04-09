'use client';

import { useEffect, useRef } from 'react';

const PAYPAL_CLIENT_TIMEOUT_MS = 20_000;

interface PayPalCreateOrderData {
  orderID?: string;
}

interface PayPalOnApproveData {
  orderID?: string;
}

interface PayPalButtonsInstance {
  render: (selector: HTMLElement) => Promise<void>;
  close?: () => Promise<void> | void;
}

interface PayPalButtonsActions {
  order?: {
    create: (_input: unknown) => Promise<string>;
    capture: () => Promise<unknown>;
  };
}

interface PayPalNamespace {
  Buttons: (options: {
    style?: Record<string, unknown>;
    createOrder?: (
      data: PayPalCreateOrderData,
      actions: PayPalButtonsActions
    ) => Promise<string>;
    onApprove?: (
      data: PayPalOnApproveData,
      actions: PayPalButtonsActions
    ) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export function PayPalCreditPackButtons(props: {
  creditPackKey: string;
  sdkReady: boolean;
  onRequireLogin: () => void;
  onError: (message: string) => void;
  onSuccess: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paymentOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!props.sdkReady || !containerRef.current || !window.paypal) {
      return;
    }

    let active = true;
    const container = containerRef.current;
    container.innerHTML = '';

    const postJsonWithTimeout = async (url: string, body: Record<string, unknown>) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PAYPAL_CLIENT_TIMEOUT_MS);

      try {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`PAYPAL_REQUEST_TIMEOUT_${PAYPAL_CLIENT_TIMEOUT_MS}MS`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    };

    const buttons = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        label: 'paypal',
      },
      createOrder: async () => {
        const response = await postJsonWithTimeout('/api/billing/paypal/create-order', {
          creditPackKey: props.creditPackKey,
          requestedCurrency: 'USD',
        });
        const payload = await response.json();

        if (response.status === 401) {
          props.onRequireLogin();
          throw new Error('AUTH_REQUIRED');
        }

        if (!response.ok || !payload.ok || !payload.providerOrderId) {
          throw new Error(payload.error ?? 'PAYPAL_CREATE_ORDER_FAILED');
        }

        paymentOrderIdRef.current = payload.paymentOrderId ?? null;
        return payload.providerOrderId;
      },
      onApprove: async (data) => {
        const response = await postJsonWithTimeout(
          '/api/billing/paypal/capture-order',
          paymentOrderIdRef.current
            ? { paymentOrderId: paymentOrderIdRef.current, providerOrderId: data.orderID }
            : { providerOrderId: data.orderID }
        );
        const payload = await response.json();

        if (response.status === 401) {
          props.onRequireLogin();
          throw new Error('AUTH_REQUIRED');
        }

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? 'PAYPAL_CAPTURE_FAILED');
        }

        props.onSuccess();
      },
      onCancel: () => {
        props.onError('PAYPAL_CHECKOUT_CANCELLED');
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'PAYPAL_BUTTONS_FAILED';
        if (message !== 'AUTH_REQUIRED') {
          props.onError(message);
        }
      },
    });

    void buttons.render(container).catch((error) => {
      if (!active) {
        return;
      }
      const message = error instanceof Error ? error.message : 'PAYPAL_BUTTONS_RENDER_FAILED';
      if (message !== 'AUTH_REQUIRED') {
        props.onError(message);
      }
    });

    return () => {
      active = false;
      container.innerHTML = '';
      void buttons.close?.();
    };
  }, [props.creditPackKey, props.onError, props.onRequireLogin, props.onSuccess, props.sdkReady]);

  return <div ref={containerRef} />;
}
