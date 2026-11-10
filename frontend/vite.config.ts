import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Явный адрес IPv4: если порт занят другим проектом, Vite это заметит и возьмёт следующий.
    host: "127.0.0.1",
    // Интерфейс ходит в API по относительным адресам; в разработке их принимает Vite.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
