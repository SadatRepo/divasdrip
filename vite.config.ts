import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const localSpaFallback = (): Plugin => ({
  name: "local-spa-fallback",
  enforce: "pre",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.method === "GET" && request.headers.accept?.includes("text/html") && request.url && !request.url.startsWith("/api/")) request.url = "/";
      next();
    });
  },
});

export default defineConfig({
  appType: "spa",
  plugins: [localSpaFallback(), react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
