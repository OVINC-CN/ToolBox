import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

export function mount(app: ReactNode) {
  const element = document.getElementById('root');
  if (!element) {
    throw new Error('Missing page root');
  }
  createRoot(element).render(app);
}
