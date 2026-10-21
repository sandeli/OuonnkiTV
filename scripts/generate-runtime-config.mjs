import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PUBLIC_ENV_KEYS = [
  'TGYS_INITIAL_VIDEO_SOURCES',
  'TGYS_TMDB_API_TOKEN',
  'TGYS_TMDB_API_BASE_URL',
  'TGYS_TMDB_IMAGE_BASE_URL',
  'TGYS_ACCESS_PASSWORD',
  'TGYS_DISABLE_ANALYTICS',
  'TGYS_INITIAL_CONFIG',
  'TGYS_ANNOUNCEMENT',
]

export function collectRuntimeConfig(environment = process.env) {
  const entries = []
  for (const key of PUBLIC_ENV_KEYS) {
    // 兼容改名前的变量名：TGYS_* 未设置时回退读取 OKI_*
    const legacyKey = key.replace(/^TGYS_/, 'OKI_')
    const value =
      typeof environment[key] === 'string' ? environment[key] : environment[legacyKey]
    if (typeof value === 'string') entries.push([key, value])
  }
  return Object.fromEntries(entries)
}

export function serializeRuntimeConfig(config) {
  const json = JSON.stringify(config)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  return `globalThis.__TGYS_RUNTIME_CONFIG__ = Object.freeze(${json});\n`
}

export async function writeRuntimeConfig(outputPath, environment = process.env) {
  const resolvedOutput = resolve(outputPath)
  const temporaryOutput = `${resolvedOutput}.${process.pid}.tmp`
  await mkdir(dirname(resolvedOutput), { recursive: true })
  await writeFile(
    temporaryOutput,
    serializeRuntimeConfig(collectRuntimeConfig(environment)),
    'utf8',
  )
  await rename(temporaryOutput, resolvedOutput)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const outputPath = process.argv[2]
  if (!outputPath) {
    console.error('Usage: node scripts/generate-runtime-config.mjs <output-path>')
    process.exitCode = 1
  } else {
    await writeRuntimeConfig(outputPath)
  }
}
