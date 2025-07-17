import Logger from 'electron-log'
import { Hono } from 'hono'

import { chatCompletionService, ModelData } from './ChatCompletionService'

// OpenAI compatible model response
interface ModelResponse {
  object: 'list'
  data: ModelData[]
}

interface ErrorResponse {
  error: {
    message: string
    type: string
    code?: string
  }
}

export const setupModelsRoutes = (app: Hono) => {
  app.get('/api/models', async (c) => {
    try {
      Logger.info('Models list request received')

      // Get real models from Cherry Studio providers
      const models = await chatCompletionService.getModels()

      if (models.length === 0) {
        Logger.warn('No models available from providers, using fallback models')
      }

      const response: ModelResponse = {
        object: 'list',
        data: models
      }

      Logger.info(`Successfully returning ${models.length} models`)
      return c.json(response)
    } catch (error) {
      Logger.error('Error in models endpoint:', error)

      try {
        // Try to get fallback models
        // No fallback models available, return empty list
        Logger.warn('Returning empty model list due to error')

        return c.json({
          object: 'list',
          data: []
        })
      } catch (fallbackError) {
        Logger.error('Failed to get fallback models:', fallbackError)

        const errorResponse: ErrorResponse = {
          error: {
            message: 'Failed to retrieve models',
            type: 'service_unavailable',
            code: 'models_unavailable'
          }
        }

        return c.json(errorResponse, 503)
      }
    }
  })
}
