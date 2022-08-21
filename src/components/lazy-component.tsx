import { usePromise } from "../utils/hooks";

export function LazyComponent<T>(props: {
  importer: () => Promise<T>;
  render: (data: T) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const query = usePromise(props.importer);
  return <>{query.isSuccess ? props.render(query.data) : props.fallback}</>;
}
