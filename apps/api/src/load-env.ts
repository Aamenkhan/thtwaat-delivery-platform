import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
config({ path: path.join(rootDir, '.env') })
config({ path: path.join(rootDir, '.env.local') })
