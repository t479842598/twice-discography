import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      ADMIN_DEFAULT_PASSWORD: 'test-bootstrap-password-123',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      CORS_ORIGIN: '',
    },
    fileParallelism: false,
  },
})
