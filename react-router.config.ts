import type { Config } from "@react-router/dev/config";

export default {
  // Static site: every route is pre-rendered to HTML at build time and nginx
  // serves build/client/ as plain files. All live data is fetched in the browser.
  ssr: false,
  prerender: true,
} satisfies Config;
