import { useQuery } from "@tanstack/react-query";

export function usePromise<T>(f: () => Promise<T>) {
  return useQuery({
    queryKey: [usePromise.name, f.toString()],
    queryFn: f,
    staleTime: Infinity,
    cacheTime: Infinity,
  });
}
