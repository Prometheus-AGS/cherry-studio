import Logger from 'electron-log'
import { Hono } from 'hono'

import { chatCompletionService } from '../services/ChatCompletionService'

const app = new Hono()

app.get('/', async (c) => {
  try {
    Logger.info('Models list request received')

    const models = await chatCompletionService.getModels()

    if (models.length === 0) {
      Logger.warn('No models available from providers')
    }

    Logger.info(`Returning ${models.length} models`)
    return c.json({
      object: 'list',
      data: models
    })
  } catch (error) {
    Logger.error('Error fetching models:', error)
    return c.json(
      {
        error: {
          message: 'Failed to retrieve models',
          type: 'service_unavailable',
          code: 'models_unavailable'
        }
      },
      503
    )
  }
})

export { app as modelsRoutes }
