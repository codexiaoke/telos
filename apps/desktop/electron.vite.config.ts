import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      exclude: ['@telos/runtime-contracts', '@telos/runtime-dsh']
    })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({
      exclude: ['@telos/runtime-contracts']
    })]
  },
  renderer: {
    plugins: [react({}), tailwindcss({})]
  }
})
