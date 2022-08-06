export const CACHE_CONTROL =
  process.env.NODE_ENV === "production"
    ? {
        // revalidate every 1 min
        // use stale 1 day
        "cache-control": "public, s-max-age=60, stale-while-revalidate=86400",
      }
    : {
        "cache-control": "max-age=60",
      };
