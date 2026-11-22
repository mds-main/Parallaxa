import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('parallaxa');

/** Wraps an async step in a span. Attributes never include user text or identifiers. */
export async function withSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>, after?: (result: T) => Attributes): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      if (after) span.setAttributes(after(result));
      return result;
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message.slice(0, 200) });
      throw e;
    } finally {
      span.end();
    }
  });
}
