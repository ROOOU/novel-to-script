export function getPayPalRouteErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('_TIMEOUT')) {
    return 504;
  }

  if (message.includes('_NETWORK_FAILED')) {
    return 502;
  }

  return 400;
}

export function logPayPalRouteError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : '';

  if (!message.includes('_TIMEOUT') && !message.includes('_NETWORK_FAILED')) {
    return;
  }

  console.error(`[paypal/${scope}] upstream request failed`, error);
}
