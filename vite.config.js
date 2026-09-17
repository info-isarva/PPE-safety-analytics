import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vercel/web needs absolute base "/". Electron file:// needs relative "./".
const isElectron = process.env.ELECTRON === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isElectron ? "./" : "/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
