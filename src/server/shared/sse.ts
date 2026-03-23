export type SSESender<TEvent extends object> = (event: TEvent) => void;

export interface CreateSSEStreamResponseOptions<TEvent extends object> {
  onError?: (error: unknown) => TEvent | null;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

export function createSSEStreamResponse<TEvent extends object>(
  producer: (send: SSESender<TEvent>) => Promise<void>,
  { onError }: CreateSSEStreamResponseOptions<TEvent> = {}
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send: SSESender<TEvent> = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await producer(send);
      } catch (error) {
        const errorEvent = onError?.(error);
        if (errorEvent) {
          send(errorEvent);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
