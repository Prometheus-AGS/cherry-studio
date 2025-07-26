import { loggerService } from '@logger'
import { ArtifactHistory, ArtifactVersion, VersionDiff } from '@renderer/types'

import { ArtifactStorage } from './ArtifactStorage'

const logger = loggerService.withContext('ArtifactVersionManager')

export interface DiffSummary {
  linesAdded: number
  linesRemoved: number
  linesModified: number
}

export interface VersionComparison {
  version1: ArtifactVersion
  version2: ArtifactVersion
  diff: VersionDiff
  summary: DiffSummary
}

export class ArtifactVersionManager {
  private static instance: ArtifactVersionManager
  private storage: ArtifactStorage

  private constructor() {
    this.storage = ArtifactStorage.getInstance()
  }

  public static getInstance(): ArtifactVersionManager {
    if (!ArtifactVersionManager.instance) {
      ArtifactVersionManager.instance = new ArtifactVersionManager()
    }
    return ArtifactVersionManager.instance
  }

  /**
   * Create a new version of an artifact
   */
  async createVersion(
    artifactId: string,
    newCode: string,
    changeDescription: string,
    createdBy: 'user' | 'llm' = 'user'
  ): Promise<ArtifactVersion> {
    try {
      logger.info(`Creating new version for artifact: ${artifactId}`)

      const currentHistory = await this.getHistory(artifactId)
      const newVersionNumber = currentHistory.currentVersion + 1

      // Get the previous version for diff calculation
      const previousVersion = currentHistory.versions.find((v) => v.version === currentHistory.currentVersion)
      const previousCode = previousVersion?.code || ''

      // Calculate diff summary
      const diffSummary = this.calculateDiffSummary(previousCode, newCode)

      // Extract metadata from the new code
      const metadata = this.extractMetadata(newCode)

      const version: ArtifactVersion = {
        id: this.generateVersionId(),
        artifactId,
        version: newVersionNumber,
        code: newCode,
        metadata,
        parentVersion: currentHistory.currentVersion > 0 ? currentHistory.currentVersion : undefined,
        createdAt: new Date().toISOString(),
        createdBy,
        changeDescription,
        diffSummary
      }

      // Save the version
      await this.storage.saveVersion(version)

      logger.info(`Created version ${newVersionNumber} for artifact: ${artifactId}`)
      return version
    } catch (error) {
      logger.error('Failed to create version:', error as Error)
      throw error
    }
  }

  /**
   * Get the complete history of an artifact
   */
  async getHistory(artifactId: string): Promise<ArtifactHistory> {
    try {
      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`)
      }

      return artifact.history
    } catch (error) {
      logger.error('Failed to get history:', error as Error)
      throw error
    }
  }

  /**
   * Get a specific version of an artifact
   */
  async getVersion(artifactId: string, versionNumber: number): Promise<ArtifactVersion | null> {
    try {
      const history = await this.getHistory(artifactId)
      return history.versions.find((v) => v.version === versionNumber) || null
    } catch (error) {
      logger.error('Failed to get version:', error as Error)
      throw error
    }
  }

  /**
   * Rollback to a specific version (creates a new version with the old code)
   */
  async rollbackToVersion(artifactId: string, targetVersion: number): Promise<ArtifactVersion> {
    try {
      logger.info(`Rolling back artifact ${artifactId} to version ${targetVersion}`)

      const history = await this.getHistory(artifactId)
      const targetVersionData = history.versions.find((v) => v.version === targetVersion)

      if (!targetVersionData) {
        throw new Error(`Version ${targetVersion} not found for artifact ${artifactId}`)
      }

      // Create a new version based on the target version
      const newVersion = await this.createVersion(
        artifactId,
        targetVersionData.code,
        `Rollback to version ${targetVersion}`,
        'user'
      )

      logger.info(`Successfully rolled back to version ${targetVersion}`)
      return newVersion
    } catch (error) {
      logger.error('Failed to rollback version:', error as Error)
      throw error
    }
  }

  /**
   * Compare two versions and generate a diff
   */
  async compareVersions(artifactId: string, version1: number, version2: number): Promise<VersionComparison> {
    try {
      const history = await this.getHistory(artifactId)
      const v1 = history.versions.find((v) => v.version === version1)
      const v2 = history.versions.find((v) => v.version === version2)

      if (!v1 || !v2) {
        throw new Error('One or both versions not found')
      }

      const diff = this.generateDiff(v1.code, v2.code)
      const summary = this.calculateDiffSummary(v1.code, v2.code)

      return {
        version1: v1,
        version2: v2,
        diff,
        summary
      }
    } catch (error) {
      logger.error('Failed to compare versions:', error as Error)
      throw error
    }
  }

  /**
   * Delete a specific version (if not current)
   */
  async deleteVersion(artifactId: string, versionNumber: number): Promise<void> {
    try {
      const history = await this.getHistory(artifactId)

      if (versionNumber === history.currentVersion) {
        throw new Error('Cannot delete the current version')
      }

      if (versionNumber === 1) {
        throw new Error('Cannot delete the initial version')
      }

      await this.storage.deleteVersion(artifactId, versionNumber)
      logger.info(`Deleted version ${versionNumber} for artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to delete version:', error as Error)
      throw error
    }
  }

  /**
   * Get version statistics
   */
  async getVersionStats(artifactId: string): Promise<{
    totalVersions: number
    totalChanges: DiffSummary
    lastModified: string
    createdBy: Record<string, number>
  }> {
    try {
      const history = await this.getHistory(artifactId)

      const totalChanges = history.versions.reduce(
        (acc, version) => ({
          linesAdded: acc.linesAdded + version.diffSummary.linesAdded,
          linesRemoved: acc.linesRemoved + version.diffSummary.linesRemoved,
          linesModified: acc.linesModified + version.diffSummary.linesModified
        }),
        { linesAdded: 0, linesRemoved: 0, linesModified: 0 }
      )

      const createdBy = history.versions.reduce(
        (acc, version) => {
          acc[version.createdBy] = (acc[version.createdBy] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      const lastVersion = history.versions[history.versions.length - 1]

      return {
        totalVersions: history.versions.length,
        totalChanges,
        lastModified: lastVersion?.createdAt || '',
        createdBy
      }
    } catch (error) {
      logger.error('Failed to get version stats:', error as Error)
      throw error
    }
  }

  /**
   * Calculate diff summary between two code strings
   */
  private calculateDiffSummary(oldCode: string, newCode: string): DiffSummary {
    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')

    // Simple line-based diff calculation
    let linesAdded = 0
    let linesRemoved = 0
    let linesModified = 0

    // Count added lines
    if (newLines.length > oldLines.length) {
      linesAdded = newLines.length - oldLines.length
    }

    // Count removed lines
    if (oldLines.length > newLines.length) {
      linesRemoved = oldLines.length - newLines.length
    }

    // Count modified lines
    const minLines = Math.min(oldLines.length, newLines.length)
    for (let i = 0; i < minLines; i++) {
      if (oldLines[i] !== newLines[i]) {
        linesModified++
      }
    }

    return { linesAdded, linesRemoved, linesModified }
  }

  /**
   * Generate a detailed diff between two code strings
   */
  private generateDiff(oldCode: string, newCode: string): VersionDiff {
    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')

    const additions: string[] = []
    const deletions: string[] = []
    const modifications: string[] = []

    // Simple diff implementation
    const maxLines = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === undefined) {
        // Line was added
        additions.push(`+${i + 1}: ${newLine}`)
      } else if (newLine === undefined) {
        // Line was removed
        deletions.push(`-${i + 1}: ${oldLine}`)
      } else if (oldLine !== newLine) {
        // Line was modified
        modifications.push(`~${i + 1}: ${oldLine} → ${newLine}`)
      }
    }

    return {
      additions,
      deletions,
      modifications,
      summary: this.calculateDiffSummary(oldCode, newCode)
    }
  }

  /**
   * Extract metadata from code
   */
  private extractMetadata(code: string) {
    // Extract component name from code
    const componentMatch = code.match(/(?:export\s+(?:default\s+)?(?:const|function)\s+|const\s+)(\w+)/)
    const title = componentMatch?.[1] || 'Untitled Component'

    // Extract dependencies from imports
    const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || []
    const dependencies = importMatches
      .map((match) => {
        const depMatch = match.match(/from\s+['"]([^'"]+)['"]/)
        return depMatch?.[1]
      })
      .filter(Boolean) as string[]

    // Extract props interface if exists
    const propsMatch = code.match(/interface\s+\w*Props\s*{([^}]*)}/s)
    const props: Record<string, string> = {}

    if (propsMatch) {
      const propsContent = propsMatch[1]
      const propMatches = propsContent.match(/(\w+):\s*([^;]+)/g) || []
      propMatches.forEach((prop) => {
        const [name, type] = prop.split(':').map((s) => s.trim())
        if (name && type) {
          props[name] = type.replace(/[;,]$/, '')
        }
      })
    }

    return {
      title,
      description: `React component: ${title}`,
      props,
      dependencies,
      author: 'Cherry Studio',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default ArtifactVersionManager
