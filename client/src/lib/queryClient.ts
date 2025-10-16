import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiClient } from "./http";
import { AppError, parseError } from "./errors";
import { toast } from "./toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Enhanced API request function with error handling
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const response = await apiClient.request(url, {
      method: method as any,
      body: data,
    });
    
    // Create a mock Response object for backward compatibility
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const appError = parseError(error);
    
    // Handle authentication errors
    if (appError.code === 'UNAUTHORIZED') {
      // Clear session-based auth state
      window.location.href = '/login';
      toast.sessionExpired();
    }
    
    // Create error response for compatibility
    throw new Response(JSON.stringify(appError.toApiResponse()), {
      status: appError.getStatusCode(),
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }): Promise<T> => {
    try {
      const data = await apiClient.get<T>(queryKey.join("/") as string);
      return data;
    } catch (error) {
      const appError = parseError(error);
      
      if (unauthorizedBehavior === "returnNull" && appError.code === 'UNAUTHORIZED') {
        return null as T;
      }
      
      throw appError;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        const appError = parseError(error);
        
        // Don't retry on client errors (4xx)
        if (appError.getStatusCode() >= 400 && appError.getStatusCode() < 500) {
          return false;
        }
        
        // Retry up to 2 times for server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        const appError = parseError(error);
        
        // Don't retry mutations on client errors
        if (appError.getStatusCode() >= 400 && appError.getStatusCode() < 500) {
          return false;
        }
        
        // Only retry once for server errors
        return failureCount < 1;
      },
      onError: (error) => {
        const appError = parseError(error);
        
        // Don't show toast for validation errors (let the form handle it)
        if (appError.code !== 'VALIDATION_ERROR') {
          toast.error(appError);
        }
      }
    },
  },
});