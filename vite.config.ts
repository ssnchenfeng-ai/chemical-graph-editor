import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 自定义中间件：处理文件保存请求
const saveFilePlugin = () => ({
  name: 'vite-plugin-save-shape',
  configureServer(server) {
    // 注册一个 API 路由 /_api/save-shape
    server.middlewares.use('/_api/save-shape', async (req, res, next) => {
      if (req.method === 'POST') {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString())
            const { filename, svgContent, jsonContent } = body
            
            // 1. 确定保存路径 (基于项目根目录)
            // 注意：这里假设你的代码结构是 src/graph/cells/svgs 和 src/graph/cells/data
            const svgPath = path.resolve(__dirname, 'src/graph/cells/svgs', `${filename}.svg`)
            const jsonPath = path.resolve(__dirname, 'src/graph/cells/data', `${filename}.json`)

            // 2. 确保 data 目录存在 (svgs 目录通常已存在，但 data 目录可能是新的)
            const jsonDir = path.dirname(jsonPath)
            if (!fs.existsSync(jsonDir)) {
              fs.mkdirSync(jsonDir, { recursive: true })
            }

            // 3. 写入文件
            fs.writeFileSync(svgPath, svgContent, 'utf-8')
            fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8')

            console.log(`[Vite] Saved shape: ${filename}`)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, message: 'Saved successfully' }))
          } catch (e) {
            console.error('[Vite] Save error:', e)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, message: (e as Error).message }))
          }
        })
      } else {
        next()
      }
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    saveFilePlugin() // 启用插件
  ],
})