import { loggerService } from '@logger'
import { nanoid } from '@reduxjs/toolkit'
import { MinAppType, ParsedArtifact, ReactArtifact, ReactArtifactMinApp } from '@renderer/types'

import { artifactStorage } from './ArtifactStorage'

const logger = loggerService.withContext('ReactArtifactManager')

export class ReactArtifactManager {
  private static instance: ReactArtifactManager

  public static getInstance(): ReactArtifactManager {
    if (!ReactArtifactManager.instance) {
      ReactArtifactManager.instance = new ReactArtifactManager()
    }
    return ReactArtifactManager.instance
  }

  /**
   * Create a React Artifact MinApp from a parsed artifact
   */
  async createArtifactMinApp(
    parsed: ParsedArtifact,
    conversationId?: string,
    messageId?: string
  ): Promise<ReactArtifactMinApp> {
    try {
      // Create and store the artifact
      const artifact = await artifactStorage.createArtifactFromParsed(parsed, conversationId, messageId)

      // Create the MinApp representation
      const minApp: ReactArtifactMinApp = {
        id: `artifact_${artifact.id}`,
        name: artifact.metadata.title,
        logo: this.getArtifactLogo(),
        url: this.generateArtifactUrl(artifact.id),
        type: 'ReactArtifact',
        artifactId: artifact.id,
        artifact,
        viewMode: 'preview',
        showProps: true,
        bodered: true,
        background: 'var(--background)',
        addTime: new Date().toISOString()
      }

      logger.info(`Created React Artifact MinApp: ${minApp.id}`)
      return minApp
    } catch (error) {
      logger.error('Failed to create React Artifact MinApp:', error as Error)
      throw error
    }
  }

  /**
   * Update an existing React Artifact MinApp
   */
  async updateArtifactMinApp(
    minApp: ReactArtifactMinApp,
    newCode: string,
    changeDescription: string
  ): Promise<ReactArtifactMinApp> {
    try {
      const currentArtifact = minApp.artifact
      const newVersion = currentArtifact.version + 1

      // Calculate diff
      const diffSummary = artifactStorage.calculateDiff(currentArtifact.code, newCode)

      // Create new version
      const newVersionData = {
        id: artifactStorage.generateId(),
        artifactId: currentArtifact.id,
        version: newVersion,
        code: newCode,
        metadata: {
          ...currentArtifact.metadata,
          updatedAt: new Date().toISOString()
        },
        parentVersion: currentArtifact.version,
        createdAt: new Date().toISOString(),
        createdBy: 'user' as const,
        changeDescription,
        diffSummary
      }

      // Save version
      await artifactStorage.saveVersion(newVersionData)
      await artifactStorage.updateCurrentVersion(currentArtifact.id, newVersion)

      // Update artifact
      const updatedArtifact: ReactArtifact = {
        ...currentArtifact,
        code: newCode,
        version: newVersion,
        metadata: {
          ...currentArtifact.metadata,
          updatedAt: new Date().toISOString()
        }
      }

      await artifactStorage.saveArtifact(updatedArtifact)

      // Update MinApp
      const updatedMinApp: ReactArtifactMinApp = {
        ...minApp,
        artifact: updatedArtifact
      }

      logger.info(`Updated React Artifact MinApp: ${minApp.id} to version ${newVersion}`)
      return updatedMinApp
    } catch (error) {
      logger.error('Failed to update React Artifact MinApp:', error as Error)
      throw error
    }
  }

  /**
   * Load a React Artifact MinApp by artifact ID
   */
  async loadArtifactMinApp(artifactId: string): Promise<ReactArtifactMinApp | null> {
    try {
      const artifact = await artifactStorage.getArtifact(artifactId)
      if (!artifact) {
        return null
      }

      const minApp: ReactArtifactMinApp = {
        id: `artifact_${artifact.id}`,
        name: artifact.metadata.title,
        logo: this.getArtifactLogo(),
        url: this.generateArtifactUrl(artifact.id),
        type: 'ReactArtifact',
        artifactId: artifact.id,
        artifact,
        viewMode: 'preview',
        showProps: true,
        bodered: true,
        background: 'var(--background)',
        addTime: artifact.metadata.createdAt
      }

      return minApp
    } catch (error) {
      logger.error('Failed to load React Artifact MinApp:', error as Error)
      return null
    }
  }

  /**
   * Convert React Artifact MinApp to regular MinApp for storage
   */
  toMinAppType(reactArtifactMinApp: ReactArtifactMinApp): MinAppType {
    return {
      id: reactArtifactMinApp.id,
      name: reactArtifactMinApp.name,
      logo: reactArtifactMinApp.logo,
      url: reactArtifactMinApp.url,
      type: 'ReactArtifact',
      bodered: reactArtifactMinApp.bodered,
      background: reactArtifactMinApp.background,
      style: reactArtifactMinApp.style,
      addTime: reactArtifactMinApp.addTime
    }
  }

  /**
   * Check if a MinApp is a React Artifact
   */
  isReactArtifactMinApp(minApp: MinAppType): minApp is ReactArtifactMinApp {
    return minApp.type === 'ReactArtifact'
  }

  /**
   * Get all React Artifact MinApps
   */
  async getAllArtifactMinApps(): Promise<ReactArtifactMinApp[]> {
    try {
      const artifacts = await artifactStorage.loadArtifacts()
      const minApps: ReactArtifactMinApp[] = []

      for (const artifact of artifacts) {
        const minApp = await this.loadArtifactMinApp(artifact.id)
        if (minApp) {
          minApps.push(minApp)
        }
      }

      return minApps
    } catch (error) {
      logger.error('Failed to get all React Artifact MinApps:', error as Error)
      return []
    }
  }

  /**
   * Delete a React Artifact MinApp
   */
  async deleteArtifactMinApp(artifactId: string): Promise<void> {
    try {
      await artifactStorage.deleteArtifact(artifactId)
      logger.info(`Deleted React Artifact MinApp: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to delete React Artifact MinApp:', error as Error)
      throw error
    }
  }

  /**
   * Get artifacts by conversation
   */
  async getArtifactMinAppsByConversation(conversationId: string): Promise<ReactArtifactMinApp[]> {
    try {
      const artifacts = await artifactStorage.getArtifactsByConversation(conversationId)
      const minApps: ReactArtifactMinApp[] = []

      for (const artifact of artifacts) {
        const minApp = await this.loadArtifactMinApp(artifact.id)
        if (minApp) {
          minApps.push(minApp)
        }
      }

      return minApps
    } catch (error) {
      logger.error('Failed to get React Artifact MinApps by conversation:', error as Error)
      return []
    }
  }

  /**
   * Search React Artifact MinApps
   */
  async searchArtifactMinApps(query: string): Promise<ReactArtifactMinApp[]> {
    try {
      const artifacts = await artifactStorage.searchArtifacts(query)
      const minApps: ReactArtifactMinApp[] = []

      for (const artifact of artifacts) {
        const minApp = await this.loadArtifactMinApp(artifact.id)
        if (minApp) {
          minApps.push(minApp)
        }
      }

      return minApps
    } catch (error) {
      logger.error('Failed to search React Artifact MinApps:', error as Error)
      return []
    }
  }

  /**
   * Generate artifact URL for iframe rendering
   */
  private generateArtifactUrl(artifactId: string): string {
    // This will be the URL that points to our artifact renderer
    return `cherry-studio://artifact/${artifactId}`
  }

  /**
   * Get appropriate logo for artifact based on its metadata
   */
  private getArtifactLogo(): string {
    // Default React logo - can be enhanced to detect component types
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xMS41IC0xMC4yMzE3NCAyMyAyMC40NjM0OCI+CiAgPHRpdGxlPlJlYWN0IExvZ288L3RpdGxlPgogIDxjaXJjbGUgY3g9IjAiIGN5PSIwIiByPSIyLjA1IiBmaWxsPSIjNjFkYWZiIi8+CiAgPGcgc3Ryb2tlPSIjNjFkYWZiIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiPgogICAgPGVsbGlwc2Ugcng9IjExIiByeT0iNC4yIi8+CiAgICA8ZWxsaXBzZSByeD0iMTEiIHJ5PSI0LjIiIHRyYW5zZm9ybT0icm90YXRlKDYwKSIvPgogICAgPGVsbGlwc2Ugcng9IjExIiByeT0iNC4yIiB0cmFuc2Zvcm09InJvdGF0ZSgxMjApIi8+CiAgPC9nPgo8L3N2Zz4K'
  }

  /**
   * Validate artifact code for security
   */
  validateArtifactCode(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Basic security checks
    if (code.includes('eval(')) {
      errors.push('eval() is not allowed for security reasons')
    }

    if (code.includes('Function(')) {
      errors.push('Function constructor is not allowed for security reasons')
    }

    if (code.includes('innerHTML')) {
      errors.push('innerHTML is not allowed for security reasons, use textContent or JSX instead')
    }

    if (code.includes('document.write')) {
      errors.push('document.write is not allowed for security reasons')
    }

    // Check for external script loading
    if (code.includes('<script') || code.includes('import(')) {
      errors.push('Dynamic script loading is not allowed for security reasons')
    }

    // Check for network requests (should use whitelisted APIs only)
    if (code.includes('fetch(') || code.includes('XMLHttpRequest') || code.includes('axios')) {
      errors.push('Network requests are not allowed in artifacts for security reasons')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Extract metadata from artifact code
   */
  extractMetadataFromCode(code: string): Partial<ReactArtifact['metadata']> {
    const metadata: Partial<ReactArtifact['metadata']> = {
      dependencies: ['react', 'react-dom']
    }

    // Extract imports to determine dependencies
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    let match
    const dependencies = new Set(['react', 'react-dom'])

    while ((match = importRegex.exec(code)) !== null) {
      const dep = match[1]
      if (dep.startsWith('styled-components')) {
        dependencies.add('styled-components')
      } else if (dep.startsWith('lodash')) {
        dependencies.add('lodash')
      } else if (dep.startsWith('dayjs')) {
        dependencies.add('dayjs')
      } else if (dep.startsWith('uuid')) {
        dependencies.add('uuid')
      }
    }

    metadata.dependencies = Array.from(dependencies)

    // Extract component name from export
    const exportMatch = code.match(/export\s+default\s+(\w+)/)
    if (exportMatch) {
      metadata.title = metadata.title || exportMatch[1]
    }

    return metadata
  }

  /**
   * Generate unique artifact ID
   */
  generateArtifactId(): string {
    return `artifact_${nanoid()}`
  }
}

// Export singleton instance
export const reactArtifactManager = ReactArtifactManager.getInstance()
