import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Serve /api/*.ts files as request handlers during `vite dev`, matching how
// Vercel runs them in production. Each handler receives a Web `Request` and
// must return a Web `Response`.
function devApiPlugin(): PluginOption {
  return {
    name: 'histora-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url
        if (!url || !url.startsWith('/api/')) {
          next()
          return
        }

        const nodeReq = req as IncomingMessage
        const nodeRes = res as ServerResponse

        const pathOnly = url.split('?')[0] ?? ''
        const fnName = pathOnly.replace(/^\/api\//, '').replace(/\/+$/, '')
        if (!fnName) {
          next()
          return
        }

        try {
          const mod = await server.ssrLoadModule(`/api/${fnName}.ts`)
          const handler = (mod as { default?: unknown }).default
          if (typeof handler !== 'function') {
            nodeRes.statusCode = 500
            nodeRes.setHeader('content-type', 'application/json')
            nodeRes.end(
              JSON.stringify({
                error: `No default export found in /api/${fnName}.ts`,
              }),
            )
            return
          }

          const host = nodeReq.headers.host ?? 'localhost'
          const fullUrl = `http://${host}${url}`
          const method = (nodeReq.method ?? 'GET').toUpperCase()

          const headers = new Headers()
          for (const [key, value] of Object.entries(nodeReq.headers)) {
            if (key === 'host' || key === 'connection') continue
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(', '))
          }

          let body: Uint8Array | undefined
          if (method !== 'GET' && method !== 'HEAD') {
            const buffer = await readBody(nodeReq)
            if (buffer.length > 0) {
              body = new Uint8Array(buffer)
            }
          }

          const request = new Request(fullUrl, { method, headers, body })
          const response = (await (
            handler as (request: Request) => Promise<Response> | Response
          )(request)) as Response

          nodeRes.statusCode = response.status
          response.headers.forEach((value, key) => {
            nodeRes.setHeader(key, value)
          })

          if (response.body) {
            const buffer = Buffer.from(await response.arrayBuffer())
            nodeRes.end(buffer)
          } else {
            nodeRes.end()
          }
        } catch (error) {
          console.error(`[dev-api] /api/${fnName} crashed:`, error)
          nodeRes.statusCode = 500
          nodeRes.setHeader('content-type', 'application/json')
          const detail =
            error instanceof Error
              ? error.message
              : 'Dev API plugin internal error'
          nodeRes.end(JSON.stringify({ error: detail }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load every env var from .env / .env.local (not just VITE_*) and surface
  // them on process.env so the /api functions can read OPENAI_API_KEY,
  // ELEVENLABS_API_KEY, etc. in dev exactly like they do on Vercel.
  const env = loadEnv(mode, process.cwd(), '')
  // Apply values from `.env` / `.env.local` even when the shell already defines
  // the same key (e.g. Windows user vars left as tutorial placeholders like
  // `your_female_voice_id`). Those placeholders must not override real IDs from
  // project env files — otherwise `/api/tts` silently uses the wrong voice_id.
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      process.env[key] = value
    }
  }

  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
  }
})
