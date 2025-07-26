import { loggerService } from '@logger'
import { reactArtifactManager } from '@renderer/services/ReactArtifactManager'
import { ParsedArtifact, ReactArtifactMinApp } from '@renderer/types'
import { useCallback, useEffect, useState } from 'react'

import { useMinappPopup } from './useMinappPopup'

const logger = loggerService.withContext('useReactArtifacts')

export const useReactArtifacts = () => {
  const [artifacts, setArtifacts] = useState<ReactArtifactMinApp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { openMinapp, openMinappKeepAlive } = useMinappPopup()

  /**
   * Load all React artifacts
   */
  const loadArtifacts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const loadedArtifacts = await reactArtifactManager.getAllArtifactMinApps()
      setArtifacts(loadedArtifacts)
      logger.info(`Loaded ${loadedArtifacts.length} React artifacts`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load artifacts'
      setError(errorMessage)
      logger.error('Failed to load React artifacts:', err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a new React artifact from parsed data
   */
  const createArtifact = useCallback(
    async (parsed: ParsedArtifact, conversationId?: string, messageId?: string): Promise<ReactArtifactMinApp> => {
      try {
        setError(null)
        const newArtifact = await reactArtifactManager.createArtifactMinApp(parsed, conversationId, messageId)
        setArtifacts((prev) => [...prev, newArtifact])
        logger.info(`Created new React artifact: ${newArtifact.id}`)
        return newArtifact
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create artifact'
        setError(errorMessage)
        logger.error('Failed to create React artifact:', err as Error)
        throw err
      }
    },
    []
  )

  /**
   * Update an existing React artifact
   */
  const updateArtifact = useCallback(
    async (artifactId: string, newCode: string, changeDescription: string): Promise<ReactArtifactMinApp> => {
      try {
        setError(null)
        const existingArtifact = artifacts.find((a) => a.artifactId === artifactId)
        if (!existingArtifact) {
          throw new Error(`Artifact not found: ${artifactId}`)
        }

        const updatedArtifact = await reactArtifactManager.updateArtifactMinApp(
          existingArtifact,
          newCode,
          changeDescription
        )

        setArtifacts((prev) => prev.map((a) => (a.artifactId === artifactId ? updatedArtifact : a)))
        logger.info(`Updated React artifact: ${artifactId}`)
        return updatedArtifact
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update artifact'
        setError(errorMessage)
        logger.error('Failed to update React artifact:', err as Error)
        throw err
      }
    },
    [artifacts]
  )

  /**
   * Delete a React artifact
   */
  const deleteArtifact = useCallback(async (artifactId: string): Promise<void> => {
    try {
      setError(null)
      await reactArtifactManager.deleteArtifactMinApp(artifactId)
      setArtifacts((prev) => prev.filter((a) => a.artifactId !== artifactId))
      logger.info(`Deleted React artifact: ${artifactId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete artifact'
      setError(errorMessage)
      logger.error('Failed to delete React artifact:', err as Error)
      throw err
    }
  }, [])

  /**
   * Get artifacts by conversation ID
   */
  const getArtifactsByConversation = useCallback(async (conversationId: string): Promise<ReactArtifactMinApp[]> => {
    try {
      setError(null)
      const conversationArtifacts = await reactArtifactManager.getArtifactMinAppsByConversation(conversationId)
      logger.info(`Found ${conversationArtifacts.length} artifacts for conversation: ${conversationId}`)
      return conversationArtifacts
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get artifacts by conversation'
      setError(errorMessage)
      logger.error('Failed to get artifacts by conversation:', err as Error)
      return []
    }
  }, [])

  /**
   * Search artifacts
   */
  const searchArtifacts = useCallback(async (query: string): Promise<ReactArtifactMinApp[]> => {
    try {
      setError(null)
      const searchResults = await reactArtifactManager.searchArtifactMinApps(query)
      logger.info(`Found ${searchResults.length} artifacts matching query: ${query}`)
      return searchResults
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search artifacts'
      setError(errorMessage)
      logger.error('Failed to search artifacts:', err as Error)
      return []
    }
  }, [])

  /**
   * Open an artifact in the MinApp popup
   */
  const openArtifact = useCallback(
    (artifact: ReactArtifactMinApp, keepAlive: boolean = false) => {
      try {
        const minAppType = reactArtifactManager.toMinAppType(artifact)
        if (keepAlive) {
          openMinappKeepAlive(minAppType)
        } else {
          openMinapp(minAppType, false)
        }
        logger.info(`Opened React artifact: ${artifact.id}`)
      } catch (err) {
        logger.error('Failed to open React artifact:', err as Error)
        setError(err instanceof Error ? err.message : 'Failed to open artifact')
      }
    },
    [openMinapp, openMinappKeepAlive]
  )

  /**
   * Get artifact by ID
   */
  const getArtifactById = useCallback(
    (artifactId: string): ReactArtifactMinApp | undefined => {
      return artifacts.find((a) => a.artifactId === artifactId)
    },
    [artifacts]
  )

  /**
   * Validate artifact code
   */
  const validateArtifactCode = useCallback((code: string) => {
    return reactArtifactManager.validateArtifactCode(code)
  }, [])

  /**
   * Extract metadata from code
   */
  const extractMetadataFromCode = useCallback((code: string) => {
    return reactArtifactManager.extractMetadataFromCode(code)
  }, [])

  /**
   * Generate unique artifact ID
   */
  const generateArtifactId = useCallback(() => {
    return reactArtifactManager.generateArtifactId()
  }, [])

  /**
   * Refresh artifacts list
   */
  const refreshArtifacts = useCallback(async () => {
    await loadArtifacts()
  }, [loadArtifacts])

  // Load artifacts on mount
  useEffect(() => {
    loadArtifacts()
  }, [loadArtifacts])

  return {
    // State
    artifacts,
    loading,
    error,

    // Actions
    createArtifact,
    updateArtifact,
    deleteArtifact,
    openArtifact,
    refreshArtifacts,

    // Queries
    getArtifactById,
    getArtifactsByConversation,
    searchArtifacts,

    // Utilities
    validateArtifactCode,
    extractMetadataFromCode,
    generateArtifactId
  }
}

export default useReactArtifacts
