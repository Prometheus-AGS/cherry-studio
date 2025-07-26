import { loggerService } from '@logger'
import { ArtifactVersionManager } from '@renderer/services/ArtifactVersionManager'
import { ArtifactHistory, ArtifactVersion, ReactArtifactMinApp } from '@renderer/types'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('VersionHistoryPanel')

const HistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background);
  border-left: 1px solid var(--border);
`

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
`

const HistoryTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
`

const HistoryControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ControlButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: ${(props) => {
    switch (props.variant) {
      case 'primary':
        return 'var(--primary)'
      case 'danger':
        return '#ff6b6b'
      default:
        return 'var(--background)'
    }
  }};
  color: ${(props) => {
    switch (props.variant) {
      case 'primary':
      case 'danger':
        return 'white'
      default:
        return 'var(--foreground)'
    }
  }};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => {
      switch (props.variant) {
        case 'primary':
          return 'var(--primary-hover)'
        case 'danger':
          return '#ff5252'
        default:
          return 'var(--background-hover)'
      }
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const VersionList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`

const VersionItem = styled.div<{ isSelected?: boolean; isCurrent?: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid ${(props) => (props.isSelected ? 'var(--primary)' : 'var(--border)')};
  border-radius: 6px;
  background: ${(props) => {
    if (props.isCurrent) return 'var(--primary-background)'
    if (props.isSelected) return 'var(--primary-background-hover)'
    return 'var(--background)'
  }};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--background-hover);
    border-color: var(--primary);
  }
`

const VersionCheckbox = styled.input`
  margin-right: 12px;
  cursor: pointer;
`

const VersionInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const VersionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`

const VersionNumber = styled.span<{ isCurrent?: boolean }>`
  font-weight: 600;
  font-size: 13px;
  color: ${(props) => (props.isCurrent ? 'var(--primary)' : 'var(--foreground)')};
`

const VersionBadge = styled.span<{ type: 'current' | 'user' | 'llm' }>`
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  background: ${(props) => {
    switch (props.type) {
      case 'current':
        return 'var(--primary)'
      case 'user':
        return '#4caf50'
      case 'llm':
        return '#ff9800'
      default:
        return 'var(--border)'
    }
  }};
  color: white;
`

const VersionDate = styled.div`
  font-size: 11px;
  color: var(--foreground-secondary);
  margin-bottom: 2px;
`

const VersionDescription = styled.div`
  font-size: 12px;
  color: var(--foreground);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const VersionStats = styled.div`
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--foreground-secondary);
`

const StatItem = styled.span<{ type: 'added' | 'removed' | 'modified' }>`
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
`

const VersionActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 8px;
`

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: ${(props) => {
    switch (props.variant) {
      case 'primary':
        return 'var(--primary)'
      case 'danger':
        return '#ff6b6b'
      default:
        return 'var(--background)'
    }
  }};
  color: ${(props) => {
    switch (props.variant) {
      case 'primary':
      case 'danger':
        return 'white'
      default:
        return 'var(--foreground)'
    }
  }};
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${(props) => {
      switch (props.variant) {
        case 'primary':
          return 'var(--primary-hover)'
        case 'danger':
          return '#ff5252'
        default:
          return 'var(--background-hover)'
      }
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--foreground-secondary);
  text-align: center;
`

interface VersionHistoryPanelProps {
  artifact: ReactArtifactMinApp
  onVersionSelect?: (version: ArtifactVersion) => void
  onVersionCompare?: (version1: number, version2: number) => void
  onVersionRollback?: (version: number) => void
  onClose?: () => void
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  artifact,
  onVersionSelect,
  onVersionCompare,
  onVersionRollback,
  onClose
}) => {
  const [history, setHistory] = useState<ArtifactHistory | null>(null)
  const [selectedVersions, setSelectedVersions] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const versionManager = ArtifactVersionManager.getInstance()

  // Load version history
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const artifactHistory = await versionManager.getHistory(artifact.artifact.id)
      setHistory(artifactHistory)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load version history'
      setError(errorMessage)
      logger.error('Failed to load version history:', err as Error)
    } finally {
      setLoading(false)
    }
  }, [artifact.artifact.id, versionManager])

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Handle version selection for comparison
  const handleVersionSelect = useCallback((versionNumber: number, checked: boolean) => {
    setSelectedVersions((prev) => {
      if (checked) {
        // Limit to 2 selections for comparison
        const newSelection = [...prev, versionNumber].slice(-2)
        return newSelection
      } else {
        return prev.filter((v) => v !== versionNumber)
      }
    })
  }, [])

  // Handle version click (view version)
  const handleVersionClick = useCallback(
    (version: ArtifactVersion) => {
      onVersionSelect?.(version)
    },
    [onVersionSelect]
  )

  // Handle version comparison
  const handleCompareVersions = useCallback(() => {
    if (selectedVersions.length === 2) {
      onVersionCompare?.(selectedVersions[0], selectedVersions[1])
    }
  }, [selectedVersions, onVersionCompare])

  // Handle version rollback
  const handleRollback = useCallback(
    async (versionNumber: number) => {
      try {
        await versionManager.rollbackToVersion(artifact.artifact.id, versionNumber)
        onVersionRollback?.(versionNumber)
        await loadHistory() // Reload history after rollback
      } catch (err) {
        logger.error('Failed to rollback version:', err as Error)
        setError(err instanceof Error ? err.message : 'Failed to rollback version')
      }
    },
    [artifact.artifact.id, versionManager, onVersionRollback, loadHistory]
  )

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  if (loading) {
    return (
      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>Version History</HistoryTitle>
          {onClose && (
            <ControlButton onClick={onClose} title="Close history panel">
              ✕
            </ControlButton>
          )}
        </HistoryHeader>
        <EmptyState>Loading version history...</EmptyState>
      </HistoryContainer>
    )
  }

  if (error) {
    return (
      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>Version History</HistoryTitle>
          {onClose && (
            <ControlButton onClick={onClose} title="Close history panel">
              ✕
            </ControlButton>
          )}
        </HistoryHeader>
        <EmptyState>
          <div>Error: {error}</div>
          <ControlButton onClick={loadHistory} style={{ marginTop: '8px' }}>
            Retry
          </ControlButton>
        </EmptyState>
      </HistoryContainer>
    )
  }

  if (!history || history.versions.length === 0) {
    return (
      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>Version History</HistoryTitle>
          {onClose && (
            <ControlButton onClick={onClose} title="Close history panel">
              ✕
            </ControlButton>
          )}
        </HistoryHeader>
        <EmptyState>No version history available</EmptyState>
      </HistoryContainer>
    )
  }

  // Sort versions by version number (newest first)
  const sortedVersions = [...history.versions].sort((a, b) => b.version - a.version)

  return (
    <HistoryContainer>
      <HistoryHeader>
        <HistoryTitle>Version History ({history.versions.length})</HistoryTitle>
        <HistoryControls>
          <ControlButton
            variant="primary"
            onClick={handleCompareVersions}
            disabled={selectedVersions.length !== 2}
            title="Compare selected versions">
            Compare
          </ControlButton>
          {onClose && (
            <ControlButton onClick={onClose} title="Close history panel">
              ✕
            </ControlButton>
          )}
        </HistoryControls>
      </HistoryHeader>

      <VersionList>
        {sortedVersions.map((version) => {
          const isCurrent = version.version === history.currentVersion
          const isSelected = selectedVersions.includes(version.version)

          return (
            <VersionItem
              key={version.id}
              isSelected={isSelected}
              isCurrent={isCurrent}
              onClick={() => handleVersionClick(version)}>
              <VersionCheckbox
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation()
                  handleVersionSelect(version.version, e.target.checked)
                }}
                onClick={(e) => e.stopPropagation()}
              />

              <VersionInfo>
                <VersionHeader>
                  <VersionNumber isCurrent={isCurrent}>v{version.version}</VersionNumber>
                  {isCurrent && <VersionBadge type="current">CURRENT</VersionBadge>}
                  <VersionBadge type={version.createdBy}>{version.createdBy.toUpperCase()}</VersionBadge>
                </VersionHeader>

                <VersionDate>{formatDate(version.createdAt)}</VersionDate>
                <VersionDescription title={version.changeDescription}>{version.changeDescription}</VersionDescription>

                <VersionStats>
                  {version.diffSummary.linesAdded > 0 && (
                    <StatItem type="added">+{version.diffSummary.linesAdded}</StatItem>
                  )}
                  {version.diffSummary.linesRemoved > 0 && (
                    <StatItem type="removed">-{version.diffSummary.linesRemoved}</StatItem>
                  )}
                  {version.diffSummary.linesModified > 0 && (
                    <StatItem type="modified">~{version.diffSummary.linesModified}</StatItem>
                  )}
                </VersionStats>
              </VersionInfo>

              <VersionActions onClick={(e) => e.stopPropagation()}>
                <ActionButton onClick={() => handleVersionClick(version)} title="View this version">
                  View
                </ActionButton>
                {!isCurrent && (
                  <ActionButton
                    variant="danger"
                    onClick={() => handleRollback(version.version)}
                    title="Rollback to this version">
                    Rollback
                  </ActionButton>
                )}
              </VersionActions>
            </VersionItem>
          )
        })}
      </VersionList>
    </HistoryContainer>
  )
}

export default VersionHistoryPanel
