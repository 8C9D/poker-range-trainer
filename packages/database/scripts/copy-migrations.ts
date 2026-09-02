import { cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const sourceDirectory = fileURLToPath(new URL('../src/migrations/', import.meta.url))
const destinationDirectory = fileURLToPath(new URL('../dist/migrations/', import.meta.url))

await rm(destinationDirectory, { recursive: true, force: true })
await cp(sourceDirectory, destinationDirectory, { recursive: true })
