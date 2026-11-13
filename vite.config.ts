import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { content } from './plugins/content/plugin.ts'

// The content folder defaults to ./content. Point CONTENT_DIR at another folder to keep it elsewhere.
export default defineConfig({
  plugins: [react(), content(process.env.CONTENT_DIR ?? 'content')],
})
