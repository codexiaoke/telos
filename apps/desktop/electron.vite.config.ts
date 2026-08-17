import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      exclude: ['@telos/runtime-contracts', '@telos/runtime-dsh', '@petwhale/electron-host']
    })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({
      exclude: ['@telos/runtime-contracts']
    })]
  },
  renderer: {
    plugins: [react({}), tailwindcss({})],
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html',
          pet: 'src/renderer/pet.html'
        }
      }
    }
  }
})
