import { registerOTel } from '@vercel/otel';
import type { Instrumentation } from 'next';

/** OpenTelemetry (TODO 25.1): traces exported through Vercel Observability or any OTLP collector. */
export function register() {
  registerOTel({ serviceName: 'parallaxa' });
}

/**
 * Every error a page, route handler, server action or proxy throws without handling it: one line with the route,
 * Vercel's request id and the error digest (the reference shown to the reader on the error page).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log, requestId } = await import('./lib/log');
  const e = error as Error & { digest?: string };
  log.error('request.failed', {
    method: request.method,
    path: request.path.split('?')[0],
    route: context.routePath,
    kind: context.routeType,
    render: context.renderSource,
    req: requestId(request.headers),
    digest: e.digest,
    error: e,
  });
};
