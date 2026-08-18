import type { FilingUIConfigData } from './ui-config.types';

declare module '@/lib/ui-config/config-validator' {
  interface ValidationError {
    path?: string;
  }
}
