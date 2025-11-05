/**
 * Enhancement Providers - Abstract AI providers
 */

export interface ProviderPayload {
  imageUrl: string;
  masks: any[];
  options: Record<string, any>;
  calibration?: number;
  model?: string;
}

export interface ProviderSubmitOptions {
  onProgress?: (percent: number) => void;
  timeout?: number;
}

export interface ProviderResult {
  providerJobId?: string;
  variants: Array<{ url: string }>;
  costMicros: number;
}

export interface EnhancementProvider {
  submit(payload: ProviderPayload, options: ProviderSubmitOptions): Promise<ProviderResult>;
  cancel?(jobId: string): Promise<void>;
}

// Mock provider for testing
class MockProvider implements EnhancementProvider {
  async submit(payload: ProviderPayload, options: ProviderSubmitOptions): Promise<ProviderResult> {
    const { onProgress, timeout = 60000 } = options;
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (onProgress) onProgress(i);
    }
    
    return {
      providerJobId: `mock_${Date.now()}`,
      variants: [{ url: payload.imageUrl }],
      costMicros: 100000 // $0.10
    };
  }
}

const mockProvider = new MockProvider();

export function getProvider(name: string): EnhancementProvider {
  // For now, return mock provider
  return mockProvider;
}
