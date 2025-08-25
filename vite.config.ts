import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  
  return {
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    preview: {
      port: 8080,
      strictPort: true,
    },
    plugins: [
      react(),
      !isProd && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
    },
  };
});
