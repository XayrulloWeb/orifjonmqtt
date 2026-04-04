import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- Добавляем импорт

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), // <-- Добавляем плагин
    react()
  ],
})