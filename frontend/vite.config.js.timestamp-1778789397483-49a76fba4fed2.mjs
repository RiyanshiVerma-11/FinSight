// vite.config.js
import { defineConfig } from "file:///D:/Riyanshi/01_coding/projects/25%20FinSight/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Riyanshi/01_coding/projects/25%20FinSight/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    port: 3e3,
    host: true,
    watch: {
      usePolling: true
    }
  },
  test: {
    // Vitest configuration
    environment: "jsdom",
    globals: true,
    // vite.config.js
    // vitest.config.js
    setupFiles: ["./tests/setup.jsx"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxSaXlhbnNoaVxcXFwwMV9jb2RpbmdcXFxccHJvamVjdHNcXFxcMjUgRmluU2lnaHRcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFJpeWFuc2hpXFxcXDAxX2NvZGluZ1xcXFxwcm9qZWN0c1xcXFwyNSBGaW5TaWdodFxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUml5YW5zaGkvMDFfY29kaW5nL3Byb2plY3RzLzI1JTIwRmluU2lnaHQvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuXG4gIGJ1aWxkOiB7XG4gICAgY29tbW9uanNPcHRpb25zOiB7XG4gICAgICBpbmNsdWRlOiBbL25vZGVfbW9kdWxlcy9dLFxuICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWVcbiAgICB9XG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgaG9zdDogdHJ1ZSxcbiAgICB3YXRjaDoge1xuICAgICAgdXNlUG9sbGluZzogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgdGVzdDoge1xuICAgIC8vIFZpdGVzdCBjb25maWd1cmF0aW9uXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICAvLyB2aXRlLmNvbmZpZy5qc1xuICAgIC8vIHZpdGVzdC5jb25maWcuanNcbiAgICBzZXR1cEZpbGVzOiBbJy4vdGVzdHMvc2V0dXAuanN4J10sXG4gICAgY3NzOiB0cnVlLFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnanNvbicsICdodG1sJ10sXG4gICAgICBpbmNsdWRlOiBbJ3NyYy8qKi8qLntqcyxqc3h9J10sXG4gICAgICBleGNsdWRlOiBbJ3NyYy9tYWluLmpzeCddLFxuICAgICAgdGhyZXNob2xkczoge1xuICAgICAgICBsaW5lczogNjAsXG4gICAgICAgIGZ1bmN0aW9uczogNjAsXG4gICAgICAgIGJyYW5jaGVzOiA1MCxcbiAgICAgICAgc3RhdGVtZW50czogNjBcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlWLFNBQVMsb0JBQW9CO0FBQ3RYLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFFakIsT0FBTztBQUFBLElBQ0wsaUJBQWlCO0FBQUEsTUFDZixTQUFTLENBQUMsY0FBYztBQUFBLE1BQ3hCLHlCQUF5QjtBQUFBLElBQzNCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUE7QUFBQSxJQUVKLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQTtBQUFBO0FBQUEsSUFHVCxZQUFZLENBQUMsbUJBQW1CO0FBQUEsSUFDaEMsS0FBSztBQUFBLElBQ0wsVUFBVTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsVUFBVSxDQUFDLFFBQVEsUUFBUSxNQUFNO0FBQUEsTUFDakMsU0FBUyxDQUFDLG1CQUFtQjtBQUFBLE1BQzdCLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIsWUFBWTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsV0FBVztBQUFBLFFBQ1gsVUFBVTtBQUFBLFFBQ1YsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
