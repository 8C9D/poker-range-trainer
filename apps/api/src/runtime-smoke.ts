import { createApp } from './app.js'
import { loadConfig } from './config.js'

// This deliberately constructs the app only. Production startup remains plain Node,
// while the smoke test proves compiled ESM can load without opening a listener.
createApp({
  config: loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:5432/smoke',
    API_ORIGINS: 'http://localhost:5173',
  }),
  readiness: async () => undefined,
})
