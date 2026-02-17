import { useState, useEffect, useCallback } from "react";

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  endpoint: string,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const { immediate = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(endpoint);
      
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/api/auth/login";
        }
        throw new Error("Session expired. Redirecting to login...");
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result.data || result);
      onSuccess?.(result.data || result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [endpoint, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export async function apiCreate<T, P = Partial<T>>(
  endpoint: string,
  data: P
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/login";
    }
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  return result.data || result;
}

export async function apiUpdate<T, P = Partial<T>>(
  endpoint: string,
  id: string,
  data: P
): Promise<T> {
  const response = await fetch(`${endpoint}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/login";
    }
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  return result.data || result;
}

export async function apiDelete(
  endpoint: string,
  id: string
): Promise<void> {
  const response = await fetch(`${endpoint}/${id}`, {
    method: "DELETE",
  });
  
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/login";
    }
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}
