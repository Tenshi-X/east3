import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'android') {
    let origin;
    try { origin = new URL(process.env.VITE_API_URL || env.VITE_API_URL || ''); }
    catch { throw new Error('Isi VITE_API_URL Android dengan origin HTTPS server produksi'); }
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
      throw new Error('VITE_API_URL Android harus berupa origin HTTPS tanpa /api');
    }
  }
  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
