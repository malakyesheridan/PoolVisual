// Feature flag for asset drop fix
// Default ON in development

export const ASSETS_DROP_FIX_ENABLED = import.meta.env.DEV || 
  import.meta.env.VITE_PV_ASSETS_DROP_FIX === 'true';

export function isAssetsDropFixEnabled(): boolean {
  return ASSETS_DROP_FIX_ENABLED;
}
