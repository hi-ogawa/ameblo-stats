import { LiveReload } from "@remix-run/react";
import { Outlet } from "@remix-run/react";
import { Scripts } from "@remix-run/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

export default function PageComponent() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>ameblo-stats</title>
        <meta
          name="viewport"
          content="width=device-width, height=device-height, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </head>
      <body>
        <Root />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

function Providers(props: React.PropsWithChildren) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 0,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}

function Root() {
  return (
    <Providers>
      <Outlet />
    </Providers>
  );
}
