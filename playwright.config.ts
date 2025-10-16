import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    '**/new_editor_upload.spec.ts',
    '**/new_editor_overlay.spec.ts',
    '**/multi_mask_materials.spec.ts',
    '**/mask_alignment.spec.ts',
    '**/material_library_integration.spec.ts',
    '**/real_material_library.spec.ts',
    '**/material_library_verification.spec.ts',
    '**/material_loading_verification.spec.ts'
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:once',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
  },
});
