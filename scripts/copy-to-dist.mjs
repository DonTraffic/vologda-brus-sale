// Хостинг запускает `npm run build` и ищет готовую статику.
// Nuxt складывает её в .output/public, но панель хостинга может ожидать dist —
// поэтому дублируем результат, чтобы подошёл любой вариант настройки.
import { cp, rm, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, '.output/public')
const target = resolve(root, 'dist')

try {
  await access(source)
} catch {
  console.error(`[copy-to-dist] Нет папки ${source}. Сначала выполните сборку.`)
  process.exit(1)
}

await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
console.log('[copy-to-dist] Статика скопирована в dist/')
