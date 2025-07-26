import { loggerService } from '@logger'
import { artifactDetectionService } from '@renderer/services/ArtifactDetectionService'
import { systemPromptManager } from '@renderer/services/SystemPromptManager'
import { ConversationContext } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'

const logger = loggerService.withContext('ArtifactDetectionMiddleware')

export interface ArtifactDetectionMiddlewareConfig {
  enabled: boolean
  autoCreateArtifacts: boolean
  conversationId?: string
  messageId?: string
  context?: ConversationContext
}

export class ArtifactDetectionMiddleware {
  private config: ArtifactDetectionMiddlewareConfig

  constructor(config: ArtifactDetectionMiddlewareConfig) {
    this.config = config
  }

  /**
   * Process request to enhance system prompt with artifact capabilities
   */
  async processRequest(params: any): Promise<any> {
    if (!this.config.enabled) {
      return params
    }

    try {
      // Extract user message from params
      const userMessage = this.extractUserMessage(params)
      if (!userMessage) {
        return params
      }

      // Check if artifacts should be enabled for this message
      const shouldEnableArtifacts = artifactDetectionService.shouldDetectArtifacts(userMessage, this.config.context)

      if (shouldEnableArtifacts) {
        // Enhance system prompt with artifact capabilities
        const enhancedPrompt = systemPromptManager.generateFullPrompt(userMessage, this.config.context)

        // Update params with enhanced prompt
        const enhancedParams = this.updateSystemPrompt(params, enhancedPrompt)

        logger.info('Enhanced system prompt with artifact capabilities')
        return enhancedParams
      }

      return params
    } catch (error) {
      logger.error('Failed to process request for artifacts:', error as Error)
      return params
    }
  }

  /**
   * Process response to detect and create artifacts
   */
  async processResponse(chunk: any): Promise<any> {
    if (!this.config.enabled || !this.config.autoCreateArtifacts) {
      return chunk
    }

    try {
      // Only process final text chunks that might contain artifacts
      if ((chunk.type !== ChunkType.TEXT_DELTA && chunk.type !== ChunkType.TEXT_COMPLETE) || !chunk.text) {
        return chunk
      }

      // Check if this is a complete response or accumulated text
      const responseText = chunk.text

      // Parse artifacts from the response
      const artifacts = artifactDetectionService.parseArtifacts(responseText)

      if (artifacts.length > 0) {
        logger.info(`Detected ${artifacts.length} artifacts in response`)

        // Create artifacts if auto-creation is enabled
        if (this.config.conversationId && this.config.messageId) {
          await this.createArtifacts(artifacts)
        }

        // Add artifact metadata to chunk
        return {
          ...chunk,
          artifacts,
          hasArtifacts: true
        }
      }

      return chunk
    } catch (error) {
      logger.error('Failed to process response for artifacts:', error as Error)
      return chunk
    }
  }

  /**
   * Extract user message from request parameters
   */
  private extractUserMessage(params: any): string | null {
    // Handle different parameter structures based on AI provider
    if (params.messages && Array.isArray(params.messages)) {
      // OpenAI/Anthropic style messages
      const lastMessage = params.messages[params.messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        return typeof lastMessage.content === 'string' ? lastMessage.content : lastMessage.content?.[0]?.text || null
      }
    }

    if (params.prompt && typeof params.prompt === 'string') {
      // Simple prompt style
      return params.prompt
    }

    if (params.input && typeof params.input === 'string') {
      // Input style
      return params.input
    }

    return null
  }

  /**
   * Update system prompt in request parameters
   */
  private updateSystemPrompt(params: any, enhancedPrompt: string): any {
    const updatedParams = { ...params }

    if (params.messages && Array.isArray(params.messages)) {
      // Find and update system message
      const messages = [...params.messages]
      const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system')

      if (systemMessageIndex >= 0) {
        messages[systemMessageIndex] = {
          ...messages[systemMessageIndex],
          content: enhancedPrompt
        }
      } else {
        // Add system message at the beginning
        messages.unshift({
          role: 'system',
          content: enhancedPrompt
        })
      }

      updatedParams.messages = messages
    } else if (params.system) {
      // Update system parameter
      updatedParams.system = enhancedPrompt
    } else {
      // Add system parameter
      updatedParams.system = enhancedPrompt
    }

    return updatedParams
  }

  /**
   * Create artifacts from parsed data
   */
  private async createArtifacts(artifacts: any[]): Promise<void> {
    try {
      for (const artifact of artifacts) {
        await artifactDetectionService.processMessage(
          `\`\`\`artifact:react\n${JSON.stringify(artifact.metadata)}\n\`\`\`tsx\n${artifact.code}\n\`\`\``,
          this.config.conversationId!,
          this.config.messageId!
        )
      }

      logger.info(`Successfully created ${artifacts.length} artifacts`)
    } catch (error) {
      logger.error('Failed to create artifacts:', error as Error)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ArtifactDetectionMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Check if middleware is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }
}

/**
 * Factory function to create artifact detection middleware
 */
export function createArtifactDetectionMiddleware(config: ArtifactDetectionMiddlewareConfig) {
  return new ArtifactDetectionMiddleware(config)
}

/**
 * Default middleware configuration
 */
export const defaultArtifactDetectionConfig: ArtifactDetectionMiddlewareConfig = {
  enabled: true,
  autoCreateArtifacts: true
}

/**
 * Middleware integration function for the AI core pipeline
 */
export function integrateArtifactDetection(conversationId: string, messageId: string, context?: ConversationContext) {
  const config: ArtifactDetectionMiddlewareConfig = {
    ...defaultArtifactDetectionConfig,
    conversationId,
    messageId,
    context
  }

  const middleware = createArtifactDetectionMiddleware(config)

  return {
    // Request processor
    processRequest: (params: any) => middleware.processRequest(params),

    // Response processor
    processResponse: (chunk: any) => middleware.processResponse(chunk),

    // Configuration updater
    updateConfig: (newConfig: Partial<ArtifactDetectionMiddlewareConfig>) => middleware.updateConfig(newConfig),

    // Status checker
    isEnabled: () => middleware.isEnabled()
  }
}

export default ArtifactDetectionMiddleware
