import Logger from 'electron-log'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import OpenAI from 'openai'
import { ChatCompletionCreateParams } from 'openai/resources'

import { chatCompletionService } from './ChatCompletionService'
import { getProviderByModel } from './utils'

export const setupChatRoutes = (app: Hono) => {
  // This shoule be a hono API server that proxy request to provider that support OpenAI format
  app.post('/api/chat/completions', async (c) => {
    let request: ChatCompletionCreateParams | undefined
    try {
      request = await c.req.json()

      if (!request) {
        return c.json(
          {
            error: {
              message: 'Request body is required',
              type: 'invalid_request_error',
              code: 'missing_body'
            }
          },
          400 as any
        )
      }

      Logger.info('Chat completion request:', {
        model: request.model,
        messageCount: request.messages?.length || 0,
        stream: request.stream
      })

      // Comprehensive request validation
      const validation = chatCompletionService.validateRequest(request)
      if (!validation.isValid) {
        return c.json(
          {
            error: {
              message: validation.errors.join('; '),
              type: 'invalid_request_error',
              code: 'validation_failed'
            }
          },
          400
        )
      }

      // Validate model format (should be provider_id:model_id)
      const provider = getProviderByModel(request.model)
      if (!provider) {
        return c.json(
          {
            error: {
              message: `Model "${request.model}" not found`,
              type: 'invalid_request_error',
              code: 'model_not_found'
            }
          },
          400
        )
      }

      // Check if the model supports OpenAI-compatible endpoints
      const modelId = request.model.split(':')[1]
      const model = provider.models?.find((m) => m.id === modelId)
      if (!model) {
        return c.json(
          {
            error: {
              message: `Model "${modelId}" not available in provider "${provider.id}"`,
              type: 'invalid_request_error',
              code: 'model_not_available'
            }
          },
          400
        )
      }

      const supportsOpenAI =
        model.endpoint_type === 'openai' ||
        model.endpoint_type === 'openai-response' ||
        model.supported_endpoint_types?.includes('openai') ||
        model.supported_endpoint_types?.includes('openai-response')

      if (!supportsOpenAI) {
        return c.json(
          {
            error: {
              message: `Model "${request.model}" does not support OpenAI-compatible endpoints`,
              type: 'invalid_request_error',
              code: 'endpoint_not_supported'
            }
          },
          400
        )
      }

      const client = new OpenAI({
        baseURL: provider.apiHost,
        apiKey: provider.apiKey
      })
      request.model = modelId

      // Handle streaming vs non-streaming responses differently
      if (request.stream) {
        const streamResponse = await client.chat.completions.create(request!)

        // Set proper headers for Server-Sent Events
        c.header('Content-Type', 'text/plain; charset=utf-8')
        c.header('Cache-Control', 'no-cache')
        c.header('Connection', 'keep-alive')

        return stream(c, async (stream) => {
          try {
            for await (const chunk of streamResponse as any) {
              const data = `data: ${JSON.stringify(chunk)}\n\n`
              await stream.write(data)
            }
            await stream.write('data: [DONE]\n\n')
          } catch (streamError) {
            Logger.error('Error in streaming response:', {
              error: streamError,
              model: request?.model,
              provider: provider.id
            })
            const errorResponse = {
              error: {
                message: 'Stream processing error',
                type: 'server_error',
                code: 'stream_error'
              }
            }
            await stream.write(`data: ${JSON.stringify(errorResponse)}\n\n`)
          }
        })
      }

      // Return non-streaming response
      const response = await client.chat.completions.create(request!)
      return c.json(response)
    } catch (error) {
      Logger.error('Error in chat completions endpoint:', {
        error: error,
        model: request?.model,
        messageCount: request?.messages?.length,
        stream: request?.stream
      })

      // Determine error type and status code
      let statusCode = 500
      let errorType = 'server_error'
      let errorCode = 'internal_error'
      let errorMessage = 'Internal server error'

      if (error instanceof Error) {
        errorMessage = error.message

        // Handle specific error types
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          statusCode = 401
          errorType = 'authentication_error'
          errorCode = 'invalid_api_key'
        } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
          statusCode = 429
          errorType = 'rate_limit_error'
          errorCode = 'rate_limit_exceeded'
        } else if (error.message.includes('timeout') || error.message.includes('connection')) {
          statusCode = 502
          errorType = 'server_error'
          errorCode = 'upstream_error'
        }
      }

      return c.json(
        {
          error: {
            message: errorMessage,
            type: errorType,
            code: errorCode
          }
        },
        statusCode as any
      )
    }
  })
}
