import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'

const readJsonBody = (req: IncomingMessage) => new Promise<unknown>((resolve, reject) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString()))
    } catch (error) {
      reject(error)
    }
  })
  req.on('error', reject)
})

const jsonResponse = (res: ServerResponse, statusCode: number, body: Record<string, unknown>) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const safePackageName = (input: string) => {
  const normalized = input.trim().replace(/[\\/:*?"<>|\s]+/g, '_')
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) throw new Error('Invalid package directory')
  return normalized || 'pid-agent-package'
}

const resolvePackageFilePath = (packageRoot: string, filePath: string) => {
  if (path.isAbsolute(filePath) || filePath.includes('\\')) throw new Error(`Invalid file path: ${filePath}`)
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) throw new Error(`Invalid file path: ${filePath}`)
  const resolved = path.resolve(packageRoot, ...parts)
  if (!resolved.startsWith(`${packageRoot}${path.sep}`) && resolved !== packageRoot) throw new Error(`Invalid file path: ${filePath}`)
  return resolved
}

// 自定义中间件：处理文件保存请求
const saveFilePlugin = () => ({
  name: 'vite-plugin-save-shape',
  configureServer(server: ViteDevServer) {
    // 注册一个 API 路由 /_api/save-shape
    server.middlewares.use('/_api/save-shape', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString())
            const { filename, svgContent, jsonContent } = body
            if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
              throw new Error('Invalid filename')
            }
            
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
    server.middlewares.use('/_api/publish-agent-package', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      try {
        const body = await readJsonBody(req) as {
          directoryName?: string
          files?: Record<string, string>
          agentPackage?: unknown
        }
        const directoryName = safePackageName(body.directoryName || 'pid-agent-package')
        const files = body.files || {}
        if (typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid files payload')

        const packageRoot = path.resolve(__dirname, 'agent-packages', directoryName)
        fs.mkdirSync(packageRoot, { recursive: true })

        for (const [filePath, content] of Object.entries(files)) {
          if (typeof content !== 'string') throw new Error(`Invalid file content: ${filePath}`)
          const targetPath = resolvePackageFilePath(packageRoot, filePath)
          fs.mkdirSync(path.dirname(targetPath), { recursive: true })
          fs.writeFileSync(targetPath, content, 'utf-8')
        }

        if (body.agentPackage) {
          fs.writeFileSync(
            path.join(packageRoot, 'agent-package.json'),
            JSON.stringify(body.agentPackage, null, 2),
            'utf-8',
          )
        }

        console.log(`[Vite] Published agent package: agent-packages/${directoryName}`)
        jsonResponse(res, 200, {
          success: true,
          directory: `agent-packages/${directoryName}`,
          files: Object.keys(files).length + (body.agentPackage ? 1 : 0),
        })
      } catch (error) {
        console.error('[Vite] Publish agent package error:', error)
        jsonResponse(res, 500, { success: false, message: (error as Error).message })
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
