import * as Sentry from '@sentry/react';
import type { ComponentType } from 'react';

let sentryEnabled = false;

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (dsn) {
    Sentry.init({ dsn });
    sentryEnabled = true;
  }
}

export function wrapApp<P extends Record<string, unknown>>(app: ComponentType<P>): ComponentType<P> {
  return sentryEnabled ? Sentry.withErrorBoundary(app, {}) : app;
}
