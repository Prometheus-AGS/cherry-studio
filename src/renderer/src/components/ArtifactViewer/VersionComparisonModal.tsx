import { loggerService } from '@logger'
import { ArtifactVersionManager, VersionComparison } from '@renderer/services/ArtifactVersionManager'
import { ReactArtifactMinApp } from '@renderer/types'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('VersionComparisonModal')

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const ModalContainer = styled.div`
  width: 90vw;
  height: 80vh;
  max-width: 1200px;
  background: var(--background);
  border-radius: 8px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
`

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--foreground);
`

const CloseButton = styled.button`
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--foreground);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: var(--background-hover);
  }
`

const ComparisonContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ComparisonHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
`

const VersionInfo = styled.div`
  display: flex;
  gap: 20px;
`

const VersionCard = styled.div`
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
`

const VersionNumber = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--primary);
  margin-bottom: 4px;
`

const VersionMeta = styled.div`
  font-size: 11px;
  color: var(--foreground-secondary);
`

const DiffStats = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
`

const StatItem = styled.div<{ type: 'added' | 'removed' | 'modified' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${(props) => {
    switch (props.type) {
      case 'added':
        return '#4caf50'
      case 'removed':
        return '#f44336'
      case 'modified':
        return '#ff9800'
      default:
        return 'var(--foreground-secondary)'
    }
  }};

  &::before {
    content: ${(props) => {
      switch (props.type) {
        case 'added':
          return '"+"'
        case 'removed':
          return '"-"'
        case 'modified':
          return '"~"'
        default:
          return '""'
      }
    }};
    font-weight: bold;
  }
`

const DiffContainer = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`

const DiffPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const DiffHeader = styled.div<{ type: 'additions' | 'deletions' | 'modifications' }>`
  padding: 8px 12px;
  background: ${(props) => {
    switch (props.type) {
      case 'additions':
        return '#e8f5e8'
      case 'deletions':
        return '#ffeaea'
      case 'modifications':
        return '#fff3e0'
      default:
        return 'var(--background-secondary)'
    }
  }};
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => {
    switch (props.type) {
      case 'additions':
        return '#2e7d32'
      case 'deletions':
        return '#c62828'
      case 'modifications':
        return '#ef6c00'
      default:
        return 'var(--foreground)'
    }
  }};
`

const DiffContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
`

const DiffLine = styled.div<{ type: 'added' | 'removed' | 'modified' | 'context' }>`
  padding: 2px 8px;
  margin: 1px 0;
  border-radius: 2px;
  background: ${(props) => {
    switch (props.type) {
      case 'added':
        return '#e8f5e8'
      case 'removed':
        return '#ffeaea'
      case 'modified':
        return '#fff3e0'
      default:
        return 'transparent'
    }
  }};
  color: ${(props) => {
    switch (props.type) {
      case 'added':
        return '#2e7d32'
      case 'removed':
        return '#c62828'
      case 'modified':
        return '#ef6c00'
      default:
        return 'var(--foreground)'
    }
  }};
  white-space: pre-wrap;
  word-break: break-all;
`

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--foreground-secondary);
`

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--foreground-secondary);
  text-align: center;
`

interface VersionComparisonModalProps {
  artifact: ReactArtifactMinApp
  version1: number
  version2: number
  onClose: () => void
}

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  artifact,
  version1,
  version2,
  onClose
}) => {
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const versionManager = ArtifactVersionManager.getInstance()

  // Load comparison data
  const loadComparison = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const comparisonData = await versionManager.compareVersions(artifact.artifact.id, version1, version2)
      setComparison(comparisonData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compare versions'
      setError(errorMessage)
      logger.error('Failed to compare versions:', err as Error)
    } finally {
      setLoading(false)
    }
  }, [artifact.artifact.id, version1, version2, versionManager])

  // Load comparison on mount
  useEffect(() => {
    loadComparison()
  }, [loadComparison])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>Version Comparison</ModalTitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </ModalHeader>

        <ComparisonContent>
          {loading && <LoadingState>Loading comparison...</LoadingState>}

          {error && (
            <ErrorState>
              <div>Error: {error}</div>
              <button type="button" onClick={loadComparison} style={{ marginTop: '8px' }}>
                Retry
              </button>
            </ErrorState>
          )}

          {comparison && (
            <>
              <ComparisonHeader>
                <VersionInfo>
                  <VersionCard>
                    <VersionNumber>Version {comparison.version1.version}</VersionNumber>
                    <VersionMeta>
                      {formatDate(comparison.version1.createdAt)} • {comparison.version1.createdBy}
                    </VersionMeta>
                    <VersionMeta>{comparison.version1.changeDescription}</VersionMeta>
                  </VersionCard>

                  <div style={{ alignSelf: 'center', color: 'var(--foreground-secondary)' }}>vs</div>

                  <VersionCard>
                    <VersionNumber>Version {comparison.version2.version}</VersionNumber>
                    <VersionMeta>
                      {formatDate(comparison.version2.createdAt)} • {comparison.version2.createdBy}
                    </VersionMeta>
                    <VersionMeta>{comparison.version2.changeDescription}</VersionMeta>
                  </VersionCard>
                </VersionInfo>

                <DiffStats>
                  {comparison.summary.linesAdded > 0 && (
                    <StatItem type="added">{comparison.summary.linesAdded} added</StatItem>
                  )}
                  {comparison.summary.linesRemoved > 0 && (
                    <StatItem type="removed">{comparison.summary.linesRemoved} removed</StatItem>
                  )}
                  {comparison.summary.linesModified > 0 && (
                    <StatItem type="modified">{comparison.summary.linesModified} modified</StatItem>
                  )}
                </DiffStats>
              </ComparisonHeader>

              <DiffContainer>
                {comparison.diff.additions.length > 0 && (
                  <DiffPanel>
                    <DiffHeader type="additions">Additions ({comparison.diff.additions.length})</DiffHeader>
                    <DiffContent>
                      {comparison.diff.additions.map((line, index) => (
                        <DiffLine key={index} type="added">
                          {line}
                        </DiffLine>
                      ))}
                    </DiffContent>
                  </DiffPanel>
                )}

                {comparison.diff.deletions.length > 0 && (
                  <DiffPanel>
                    <DiffHeader type="deletions">Deletions ({comparison.diff.deletions.length})</DiffHeader>
                    <DiffContent>
                      {comparison.diff.deletions.map((line, index) => (
                        <DiffLine key={index} type="removed">
                          {line}
                        </DiffLine>
                      ))}
                    </DiffContent>
                  </DiffPanel>
                )}

                {comparison.diff.modifications.length > 0 && (
                  <DiffPanel>
                    <DiffHeader type="modifications">Modifications ({comparison.diff.modifications.length})</DiffHeader>
                    <DiffContent>
                      {comparison.diff.modifications.map((line, index) => (
                        <DiffLine key={index} type="modified">
                          {line}
                        </DiffLine>
                      ))}
                    </DiffContent>
                  </DiffPanel>
                )}

                {comparison.diff.additions.length === 0 &&
                  comparison.diff.deletions.length === 0 &&
                  comparison.diff.modifications.length === 0 && (
                    <DiffPanel>
                      <DiffContent>
                        <div style={{ textAlign: 'center', color: 'var(--foreground-secondary)', padding: '40px' }}>
                          No differences found between these versions
                        </div>
                      </DiffContent>
                    </DiffPanel>
                  )}
              </DiffContainer>
            </>
          )}
        </ComparisonContent>
      </ModalContainer>
    </ModalOverlay>
  )
}

export default VersionComparisonModal
