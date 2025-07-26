import { loggerService } from '@logger'
import { ArtifactHistory, ArtifactVersion, ParsedArtifact, ReactArtifact, VersionDiff } from '@renderer/types'

const logger = loggerService.withContext('ArtifactStorage')

export class ArtifactStorage {
  private static instance: ArtifactStorage
  private readonly ARTIFACTS_FILE = 'react-artifacts.json'
  private readonly ARTIFACT_HISTORY_FILE = 'artifact-history.json'

  public static getInstance(): ArtifactStorage {
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = new ArtifactStorage()
    }
    return ArtifactStorage.instance
  }

  /**
   * Load all React artifacts from storage
   */
  async loadArtifacts(): Promise<ReactArtifact[]> {
    try {
      let content: string
      try {
        content = await window.api.file.read(this.ARTIFACTS_FILE)
      } catch (error) {
        // If file doesn't exist, create empty array
        content = '[]'
        await window.api.file.writeWithId(this.ARTIFACTS_FILE, content)
      }

      const artifacts = JSON.parse(content)
      return artifacts.map((artifact: any) => ({
        ...artifact,
        metadata: {
          ...artifact.metadata,
          createdAt: artifact.metadata.createdAt || new Date().toISOString(),
          updatedAt: artifact.metadata.updatedAt || new Date().toISOString()
        }
      }))
    } catch (error) {
      logger.error('Failed to load React artifacts:', error as Error)
      return []
    }
  }

  /**
   * Save a React artifact to storage
   */
  async saveArtifact(artifact: ReactArtifact): Promise<void> {
    try {
      const artifacts = await this.loadArtifacts()
      const existingIndex = artifacts.findIndex((a) => a.id === artifact.id)

      const now = new Date().toISOString()
      const updatedArtifact = {
        ...artifact,
        metadata: {
          ...artifact.metadata,
          updatedAt: now,
          createdAt: artifact.metadata.createdAt || now
        }
      }

      if (existingIndex >= 0) {
        artifacts[existingIndex] = updatedArtifact
      } else {
        artifacts.push(updatedArtifact)
      }

      await window.api.file.writeWithId(this.ARTIFACTS_FILE, JSON.stringify(artifacts, null, 2))
      logger.info(`Saved artifact: ${artifact.id}`)
    } catch (error) {
      logger.error('Failed to save React artifact:', error as Error)
      throw error
    }
  }

  /**
   * Delete a React artifact from storage
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    try {
      const artifacts = await this.loadArtifacts()
      const filteredArtifacts = artifacts.filter((a) => a.id !== artifactId)

      await window.api.file.writeWithId(this.ARTIFACTS_FILE, JSON.stringify(filteredArtifacts, null, 2))

      // Also delete artifact history
      await this.deleteArtifactHistory(artifactId)

      logger.info(`Deleted artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to delete React artifact:', error as Error)
      throw error
    }
  }

  /**
   * Get a specific artifact by ID
   */
  async getArtifact(artifactId: string): Promise<ReactArtifact | null> {
    try {
      const artifacts = await this.loadArtifacts()
      return artifacts.find((a) => a.id === artifactId) || null
    } catch (error) {
      logger.error('Failed to get React artifact:', error as Error)
      return null
    }
  }

  /**
   * Load artifact history from storage
   */
  async loadArtifactHistory(): Promise<Record<string, ArtifactHistory>> {
    try {
      let content: string
      try {
        content = await window.api.file.read(this.ARTIFACT_HISTORY_FILE)
      } catch (error) {
        // If file doesn't exist, create empty object
        content = '{}'
        await window.api.file.writeWithId(this.ARTIFACT_HISTORY_FILE, content)
      }

      return JSON.parse(content)
    } catch (error) {
      logger.error('Failed to load artifact history:', error as Error)
      return {}
    }
  }

  /**
   * Get history for a specific artifact
   */
  async getHistory(artifactId: string): Promise<ArtifactHistory> {
    try {
      const allHistory = await this.loadArtifactHistory()
      return (
        allHistory[artifactId] || {
          artifactId,
          currentVersion: 0,
          versions: []
        }
      )
    } catch (error) {
      logger.error('Failed to get artifact history:', error as Error)
      return {
        artifactId,
        currentVersion: 0,
        versions: []
      }
    }
  }

  /**
   * Save a new version of an artifact
   */
  async saveVersion(version: ArtifactVersion): Promise<void> {
    try {
      const allHistory = await this.loadArtifactHistory()

      if (!allHistory[version.artifactId]) {
        allHistory[version.artifactId] = {
          artifactId: version.artifactId,
          currentVersion: 0,
          versions: []
        }
      }

      const history = allHistory[version.artifactId]
      history.versions.push(version)

      await window.api.file.writeWithId(this.ARTIFACT_HISTORY_FILE, JSON.stringify(allHistory, null, 2))
      logger.info(`Saved version ${version.version} for artifact: ${version.artifactId}`)
    } catch (error) {
      logger.error('Failed to save artifact version:', error as Error)
      throw error
    }
  }

  /**
   * Update the current version pointer for an artifact
   */
  async updateCurrentVersion(artifactId: string, version: number): Promise<void> {
    try {
      const allHistory = await this.loadArtifactHistory()

      if (!allHistory[artifactId]) {
        throw new Error(`Artifact history not found: ${artifactId}`)
      }

      allHistory[artifactId].currentVersion = version

      await window.api.file.writeWithId(this.ARTIFACT_HISTORY_FILE, JSON.stringify(allHistory, null, 2))
      logger.info(`Updated current version to ${version} for artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to update current version:', error as Error)
      throw error
    }
  }

  /**
   * Get a specific version of an artifact
   */
  async getVersion(artifactId: string, version: number): Promise<ArtifactVersion | null> {
    try {
      const history = await this.getHistory(artifactId)
      return history.versions.find((v) => v.version === version) || null
    } catch (error) {
      logger.error('Failed to get artifact version:', error as Error)
      return null
    }
  }

  /**
   * Delete artifact history
   */
  async deleteArtifactHistory(artifactId: string): Promise<void> {
    try {
      const allHistory = await this.loadArtifactHistory()
      delete allHistory[artifactId]

      await window.api.file.writeWithId(this.ARTIFACT_HISTORY_FILE, JSON.stringify(allHistory, null, 2))
      logger.info(`Deleted history for artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to delete artifact history:', error as Error)
      throw error
    }
  }

  /**
   * Calculate diff between two code strings
   */
  calculateDiff(oldCode: string, newCode: string): VersionDiff['summary'] {
    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')

    let linesAdded = 0
    let linesRemoved = 0
    let linesModified = 0

    // Simple diff calculation - can be enhanced with proper diff algorithm
    const maxLines = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === undefined) {
        linesAdded++
      } else if (newLine === undefined) {
        linesRemoved++
      } else if (oldLine !== newLine) {
        linesModified++
      }
    }

    return {
      linesAdded,
      linesRemoved,
      linesModified
    }
  }

  /**
   * Generate a unique ID for artifacts
   */
  generateId(): string {
    return `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create artifact from parsed data
   */
  async createArtifactFromParsed(
    parsed: ParsedArtifact,
    conversationId?: string,
    messageId?: string
  ): Promise<ReactArtifact> {
    const artifact: ReactArtifact = {
      id: parsed.id,
      code: parsed.code,
      metadata: parsed.metadata,
      conversationId,
      messageId,
      version: 1,
      history: {
        artifactId: parsed.id,
        currentVersion: 1,
        versions: []
      }
    }

    await this.saveArtifact(artifact)

    // Create initial version
    const initialVersion: ArtifactVersion = {
      id: this.generateId(),
      artifactId: artifact.id,
      version: 1,
      code: artifact.code,
      metadata: artifact.metadata,
      createdAt: new Date().toISOString(),
      createdBy: 'llm',
      changeDescription: 'Initial creation',
      diffSummary: {
        linesAdded: artifact.code.split('\n').length,
        linesRemoved: 0,
        linesModified: 0
      }
    }

    await this.saveVersion(initialVersion)
    await this.updateCurrentVersion(artifact.id, 1)

    // Add history to artifact
    artifact.history = {
      artifactId: artifact.id,
      currentVersion: 1,
      versions: [initialVersion]
    }

    return artifact
  }

  /**
   * Get artifacts by conversation ID
   */
  async getArtifactsByConversation(conversationId: string): Promise<ReactArtifact[]> {
    try {
      const artifacts = await this.loadArtifacts()
      return artifacts.filter((a) => a.conversationId === conversationId)
    } catch (error) {
      logger.error('Failed to get artifacts by conversation:', error as Error)
      return []
    }
  }

  /**
   * Search artifacts by metadata
   */
  async searchArtifacts(query: string): Promise<ReactArtifact[]> {
    try {
      const artifacts = await this.loadArtifacts()
      const lowerQuery = query.toLowerCase()

      return artifacts.filter(
        (artifact) =>
          artifact.metadata.title.toLowerCase().includes(lowerQuery) ||
          artifact.metadata.description.toLowerCase().includes(lowerQuery) ||
          artifact.metadata.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
          artifact.code.toLowerCase().includes(lowerQuery)
      )
    } catch (error) {
      logger.error('Failed to search artifacts:', error as Error)
      return []
    }
  }

  /**
   * Delete a specific version from history
   */
  async deleteVersion(artifactId: string, versionNumber: number): Promise<void> {
    try {
      const allHistory = await this.loadArtifactHistory()
      const history = allHistory[artifactId]

      if (!history) {
        throw new Error(`No history found for artifact: ${artifactId}`)
      }

      // Remove the version from the versions array
      history.versions = history.versions.filter((v) => v.version !== versionNumber)

      // Update the history
      allHistory[artifactId] = history
      await window.api.file.writeWithId(this.ARTIFACT_HISTORY_FILE, JSON.stringify(allHistory, null, 2))

      logger.info(`Deleted version ${versionNumber} for artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to delete version:', error as Error)
      throw error
    }
  }
}

// Export singleton instance
export const artifactStorage = ArtifactStorage.getInstance()
