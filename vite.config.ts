
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env to prevent 'process is not defined' errors
    // if any dependencies or code still reference it
    'process.env': {} 
  }
})
