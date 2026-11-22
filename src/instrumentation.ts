import { registerOTel } from '@vercel/otel';

/** OpenTelemetry (TODO 25.1): traces exported through Vercel Observability or any OTLP collector. */
export function register() {
  registerOTel({ serviceName: 'parallaxa' });
}
