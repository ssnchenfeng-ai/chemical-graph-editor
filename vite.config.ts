import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
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

interface NetworkProjectMetadata {
  id: string
  name: string
  drawingNo: string
  createdAt: string
  updatedAt: string
  version: number
}

const networkProjectsRoot = path.resolve(__dirname, 'network-projects')

const safeNetworkProjectId = (input: string) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(input)) throw new Error('Invalid network project id')
  return input
}

const networkProjectDir = (projectId: string) => path.resolve(networkProjectsRoot, safeNetworkProjectId(projectId))
const networkProjectFile = (projectId: string) => path.join(networkProjectDir(projectId), 'project.pid-project.json')
const networkProjectMetaFile = (projectId: string) => path.join(networkProjectDir(projectId), 'metadata.json')

const safeTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-')

const readJsonFile = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T

const writeJsonFile = (filePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

const validatePidProject = (project: unknown) => {
  if (!project || typeof project !== 'object') throw new Error('Invalid project payload')
  const typedProject = project as { version?: string; project?: { name?: string; drawingNo?: string } }
  if (typedProject.version !== 'pid-layered-semantic/v1') throw new Error('Unsupported project version')
  if (!typedProject.project || typeof typedProject.project !== 'object') throw new Error('Invalid project metadata')
  return typedProject
}

const metadataFromProject = (id: string, project: unknown, previous?: NetworkProjectMetadata): NetworkProjectMetadata => {
  const typedProject = validatePidProject(project)
  const now = new Date().toISOString()
  return {
    id,
    name: typedProject.project?.name || previous?.name || id,
    drawingNo: typedProject.project?.drawingNo || previous?.drawingNo || '',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    version: previous ? previous.version + 1 : 1,
  }
}

const writeNetworkProject = (projectId: string, project: unknown, previous?: NetworkProjectMetadata) => {
  const meta = metadataFromProject(projectId, project, previous)
  const projectDir = networkProjectDir(projectId)
  const versionFile = path.join(projectDir, 'versions', `v${String(meta.version).padStart(4, '0')}-${safeTimestamp()}.pid-project.json`)
  writeJsonFile(networkProjectFile(projectId), project)
  writeJsonFile(networkProjectMetaFile(projectId), meta)
  writeJsonFile(versionFile, project)
  return meta
}

const listNetworkProjects = () => {
  fs.mkdirSync(networkProjectsRoot, { recursive: true })
  return fs.readdirSync(networkProjectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const metaPath = networkProjectMetaFile(entry.name)
      if (!fs.existsSync(metaPath)) return []
      try {
        return [readJsonFile<NetworkProjectMetadata>(metaPath)]
      } catch {
        return []
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
    server.middlewares.use('/_api/network-projects', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      try {
        const urlPath = (req.url || '/').split('?')[0]
        const parts = urlPath.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
        const projectId = parts[0]

        if (req.method === 'GET' && !projectId) {
          jsonResponse(res, 200, { success: true, projects: listNetworkProjects() })
          return
        }

        if (req.method === 'POST' && !projectId) {
          const body = await readJsonBody(req) as { project?: unknown }
          if (!body.project) throw new Error('Missing project payload')
          const id = randomUUID()
          const metadata = writeNetworkProject(id, body.project)
          console.log(`[Vite] Created network project: network-projects/${id}`)
          jsonResponse(res, 200, { success: true, metadata, project: body.project })
          return
        }

        if (req.method === 'GET' && projectId && parts.length === 1) {
          const projectFile = networkProjectFile(projectId)
          const metaFile = networkProjectMetaFile(projectId)
          if (!fs.existsSync(projectFile) || !fs.existsSync(metaFile)) {
            jsonResponse(res, 404, { success: false, message: 'Network project not found' })
            return
          }
          jsonResponse(res, 200, {
            success: true,
            metadata: readJsonFile<NetworkProjectMetadata>(metaFile),
            project: readJsonFile(projectFile),
          })
          return
        }

        if (req.method === 'PUT' && projectId && parts.length === 1) {
          const body = await readJsonBody(req) as { project?: unknown; expectedVersion?: number }
          if (!body.project) throw new Error('Missing project payload')
          const metaFile = networkProjectMetaFile(projectId)
          if (!fs.existsSync(metaFile)) {
            jsonResponse(res, 404, { success: false, message: 'Network project not found' })
            return
          }
          const previous = readJsonFile<NetworkProjectMetadata>(metaFile)
          if (typeof body.expectedVersion === 'number' && body.expectedVersion !== previous.version) {
            jsonResponse(res, 409, {
              success: false,
              message: `NETWORK_PROJECT_WRITE_CONFLICT: expected v${body.expectedVersion}, got v${previous.version}`,
              metadata: previous,
            })
            return
          }
          const metadata = writeNetworkProject(projectId, body.project, previous)
          console.log(`[Vite] Saved network project: network-projects/${projectId} v${metadata.version}`)
          jsonResponse(res, 200, { success: true, metadata, project: body.project })
          return
        }

        next()
      } catch (error) {
        console.error('[Vite] Network project error:', error)
        jsonResponse(res, 500, { success: false, message: (error as Error).message })
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
