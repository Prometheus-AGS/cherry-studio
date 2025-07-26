import { loggerService } from '@logger'
import { nanoid } from '@reduxjs/toolkit'
import { ArtifactMetadata, ConversationContext, ParsedArtifact, ProcessedMessage } from '@renderer/types'

import { reactArtifactManager } from './ReactArtifactManager'

const logger = loggerService.withContext('ArtifactDetectionService')

export class ArtifactDetectionService {
  private static instance: ArtifactDetectionService

  public static getInstance(): ArtifactDetectionService {
    if (!ArtifactDetectionService.instance) {
      ArtifactDetectionService.instance = new ArtifactDetectionService()
    }
    return ArtifactDetectionService.instance
  }

  /**
   * Parse LLM response for React artifacts
   */
  parseArtifacts(response: string): ParsedArtifact[] {
    const artifacts: ParsedArtifact[] = []

    // Updated regex pattern to match the artifact format from our specification
    const artifactPattern = /```artifact:react\n([\s\S]*?)\n```tsx\n([\s\S]*?)\n```/g
    let match

    while ((match = artifactPattern.exec(response)) !== null) {
      try {
        const metadataJson = match[1].trim()
        const code = match[2].trim()

        // Parse metadata JSON
        let metadata: ArtifactMetadata
        try {
          const parsedMetadata = JSON.parse(metadataJson)
          metadata = this.validateAndNormalizeMetadata(parsedMetadata)
        } catch (error) {
          logger.warn('Failed to parse artifact metadata, using defaults:', error as Error)
          metadata = this.createDefaultMetadata(code)
        }

        // Validate code
        const validation = reactArtifactManager.validateArtifactCode(code)
        if (!validation.isValid) {
          logger.warn('Artifact code validation failed:', validation.errors)
          continue
        }

        // Extract additional metadata from code
        const extractedMetadata = reactArtifactManager.extractMetadataFromCode(code)
        metadata = { ...metadata, ...extractedMetadata }

        const artifact: ParsedArtifact = {
          id: this.generateArtifactId(),
          metadata,
          code,
          createdAt: new Date().toISOString()
        }

        artifacts.push(artifact)
        logger.info(`Parsed React artifact: ${artifact.metadata.title}`)
      } catch (error) {
        logger.error('Failed to parse artifact:', error as Error)
      }
    }

    return artifacts
  }

  /**
   * Process a message and extract artifacts
   */
  async processMessage(message: string, conversationId: string, messageId: string): Promise<ProcessedMessage> {
    try {
      // Parse artifacts from the message
      const artifacts = this.parseArtifacts(message)

      // Create artifact MinApps for each parsed artifact
      const createdArtifacts: ParsedArtifact[] = []
      for (const artifact of artifacts) {
        try {
          await reactArtifactManager.createArtifactMinApp(artifact, conversationId, messageId)
          createdArtifacts.push(artifact)
        } catch (error) {
          logger.error('Failed to create artifact MinApp:', error as Error)
        }
      }

      return {
        response: message,
        artifacts: createdArtifacts,
        hasArtifacts: createdArtifacts.length > 0
      }
    } catch (error) {
      logger.error('Failed to process message for artifacts:', error as Error)
      return {
        response: message,
        artifacts: [],
        hasArtifacts: false
      }
    }
  }

  /**
   * Check if a message should trigger artifact detection
   */
  shouldDetectArtifacts(message: string, context?: ConversationContext): boolean {
    // Check for artifact markers
    if (message.includes('```artifact:react')) {
      return true
    }

    // Check context for existing artifacts
    if (context?.hasArtifacts || context?.lastMessageContainedArtifact) {
      return true
    }

    // Check for artifact trigger phrases
    const artifactTriggers = [
      /create.*component/i,
      /build.*interface/i,
      /make.*interactive/i,
      /show.*example/i,
      /demo/i,
      /calculator/i,
      /form/i,
      /widget/i,
      /tool/i,
      /visualize/i,
      /chart/i,
      /graph/i,
      /react.*component/i,
      /tsx.*component/i
    ]

    return artifactTriggers.some((trigger) => trigger.test(message))
  }

  /**
   * Validate and normalize artifact metadata
   */
  private validateAndNormalizeMetadata(metadata: any): ArtifactMetadata {
    const now = new Date().toISOString()

    return {
      title: metadata.title || 'Untitled Component',
      description: metadata.description || 'A React component',
      props: metadata.props || {},
      dependencies: Array.isArray(metadata.dependencies)
        ? metadata.dependencies.filter((dep: any) => typeof dep === 'string')
        : ['react', 'react-dom'],
      tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag: any) => typeof tag === 'string') : [],
      author: metadata.author || 'AI Assistant',
      createdAt: now,
      updatedAt: now
    }
  }

  /**
   * Create default metadata when parsing fails
   */
  private createDefaultMetadata(code: string): ArtifactMetadata {
    const now = new Date().toISOString()

    // Try to extract component name from code
    const componentMatch = code.match(/(?:function|const)\s+(\w+)|export\s+default\s+(\w+)/)
    const componentName = componentMatch?.[1] || componentMatch?.[2] || 'Component'

    return {
      title: componentName,
      description: `A React ${componentName.toLowerCase()} component`,
      props: {},
      dependencies: ['react', 'react-dom'],
      tags: ['react', 'component'],
      author: 'AI Assistant',
      createdAt: now,
      updatedAt: now
    }
  }

  /**
   * Generate unique artifact ID
   */
  private generateArtifactId(): string {
    return `artifact_${nanoid()}`
  }

  /**
   * Extract React component from various code formats
   */
  extractReactComponent(code: string): string | null {
    // Remove markdown code blocks if present
    const codeBlockMatch = code.match(/```(?:tsx?|jsx?|javascript|typescript)?\n?([\s\S]*?)\n?```/)
    const cleanCode = codeBlockMatch ? codeBlockMatch[1] : code

    // Check if it's a React component
    if (this.isReactComponent(cleanCode)) {
      return cleanCode.trim()
    }

    return null
  }

  /**
   * Check if code is a React component
   */
  private isReactComponent(code: string): boolean {
    // Check for React imports
    const hasReactImport =
      /import\s+.*?React.*?from\s+['"]react['"]/.test(code) ||
      /import\s+.*?\{.*?useState.*?\}.*?from\s+['"]react['"]/.test(code) ||
      /import\s+.*?\{.*?useEffect.*?\}.*?from\s+['"]react['"]/.test(code)

    // Check for JSX syntax
    const hasJSX = /<[A-Z][a-zA-Z0-9]*/.test(code) || /<[a-z]+/.test(code)

    // Check for component export
    const hasExport = /export\s+default/.test(code) || /export\s+\{/.test(code)

    // Check for function component pattern
    const isFunctionComponent =
      /(?:function|const)\s+[A-Z]\w*.*?=>.*?{/.test(code) || /(?:function|const)\s+[A-Z]\w*.*?\(.*?\).*?{/.test(code)

    return (hasReactImport || hasJSX) && hasExport && isFunctionComponent
  }

  /**
   * Auto-fix common React component issues
   */
  autoFixReactComponent(code: string): string {
    let fixedCode = code

    // Add React import if missing
    if (!fixedCode.includes('import React') && !fixedCode.includes('import { ')) {
      fixedCode = `import React from 'react';\n${fixedCode}`
    }

    // Add export default if missing
    if (!fixedCode.includes('export default')) {
      const componentMatch = fixedCode.match(/(?:function|const)\s+([A-Z]\w*)/)
      if (componentMatch) {
        const componentName = componentMatch[1]
        if (!fixedCode.includes(`export default ${componentName}`)) {
          fixedCode += `\n\nexport default ${componentName};`
        }
      }
    }

    // Fix common JSX issues
    fixedCode = fixedCode.replace(/class=/g, 'className=').replace(/for=/g, 'htmlFor=')

    return fixedCode
  }

  /**
   * Create conversation context
   */
  createConversationContext(
    hasArtifacts: boolean = false,
    lastMessageContainedArtifact: boolean = false,
    artifactCount: number = 0
  ): ConversationContext {
    return {
      hasArtifacts,
      lastMessageContainedArtifact,
      artifactCount
    }
  }

  /**
   * Update conversation context after processing
   */
  updateConversationContext(context: ConversationContext, processedMessage: ProcessedMessage): ConversationContext {
    return {
      hasArtifacts: context.hasArtifacts || processedMessage.hasArtifacts,
      lastMessageContainedArtifact: processedMessage.hasArtifacts,
      artifactCount: context.artifactCount + processedMessage.artifacts.length
    }
  }
}

// Export singleton instance
export const artifactDetectionService = ArtifactDetectionService.getInstance()
