import React from "react";

// https://github.com/remix-run/remix/issues/180

export function NoSSR(
  props: React.PropsWithChildren<{ fallback?: React.ReactNode }>
) {
  const hydrated = useHydrated();
  return hydrated ? <>{props.children}</> : <>{props.fallback}</>;
}

let _hydrated = false;

export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(_hydrated);
  React.useEffect(() => setHydrated((_hydrated = true)), []);
  return hydrated;
}
