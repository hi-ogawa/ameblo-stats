import { usePromise } from "../utils/hooks";

export function LazyComponent<P = {}, T = React.ComponentType<P>>(props: {
  importer: () => Promise<T>;
  render: (Component: T) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const query = usePromise(props.importer);
  return <>{query.isSuccess ? props.render(query.data) : props.fallback}</>;
}
