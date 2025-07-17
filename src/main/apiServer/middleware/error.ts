import Logger from 'electron-log'
import { ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err, c) => {
  Logger.error('API Server Error:', err)

  // Don't expose internal errors in production
  const isDev = process.env.NODE_ENV === 'development'

  return c.json(
    {
      error: {
        message: isDev ? err.message : 'Internal server error',
        type: 'server_error',
        ...(isDev && { stack: err.stack })
      }
    },
    500
  )
}
