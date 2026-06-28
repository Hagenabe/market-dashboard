import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_URL はGitHub Actionsで '/market-dashboard/' などに設定する
// ローカル開発時は '/' のまま
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL ?? '/',
})
