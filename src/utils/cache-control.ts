export const CACHE_CONTROL = import.meta.env.PROD
  ? {
      // revalidate every 1 min
      // use stale 1 day
      "cache-control": "public, s-max-age=60, stale-while-revalidate=86400",
    }
  : {};
