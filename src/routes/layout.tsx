import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Head } from "rakkasjs";
import React from "react";
import "virtual:windi.css";

export default function Layout(props: React.PropsWithChildren) {
  return (
    <>
      <Head
        title="ameblo-stats"
        // TODO: overwritten by rakkas internally https://github.com/rakkasjs/rakkasjs/blob/114afc1842d3044940f7dc8cde11d696368bd6dc/packages/rakkasjs/src/features/pages/middleware.tsx#L480-L481
        // meta={[
        //   <meta charSet="utf-8" />,
        //   <meta
        //     name="viewport"
        //     content="width=device-width, height=device-height, initial-scale=1, maximum-scale=1, user-scalable=no"
        //   />,
        // ]}
      />
      {/* hack for https://github.com/rehooks/local-storage/blob/db301e64d3db82f75775bdb477ca42feb5e3e49b/src/local-storage-events.ts#L14 */}
      <script>{`window.global = window;`}</script>
      <Providers>
        {props.children}
        {import.meta.env.DEV && <ReactQueryDevtools />}
      </Providers>
    </>
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
