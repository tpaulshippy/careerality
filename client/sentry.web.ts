export function initSentry(): void {}

import type { ComponentType } from 'react';

export function wrapApp<P extends Record<string, unknown>>(app: ComponentType<P>): ComponentType<P> {
  return app;
}
