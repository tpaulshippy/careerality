import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (dsn) {
    Sentry.init({ dsn });
  }
}

export function wrapApp<P extends Record<string, unknown>>(app: ComponentType<P>): ComponentType<P> {
  return Sentry.wrap(app);
}
