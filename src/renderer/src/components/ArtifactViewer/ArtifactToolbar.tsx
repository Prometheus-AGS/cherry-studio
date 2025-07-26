import { ReactArtifactMinApp } from '@renderer/types'
import React, { useCallback } from 'react'
import styled from 'styled-components'

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
  min-height: 48px;
`

const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ToolbarButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
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
  font-size: 12px;
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

const ToolbarSeparator = styled.div`
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 4px;
`

const ArtifactTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
`

const ArtifactMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--foreground-secondary);
`

const StatusIndicator = styled.div<{ status: 'saved' | 'modified' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${(props) => {
      switch (props.status) {
        case 'saved':
          return '#4caf50'
        case 'modified':
          return '#ffa500'
        case 'error':
          return '#ff6b6b'
        default:
          return 'var(--border)'
      }
    }};
  }
`

const LayoutToggle = styled.div`
  display: flex;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
`

const LayoutButton = styled.button<{ active: boolean }>`
  padding: 4px 8px;
  border: none;
  background: ${(props) => (props.active ? 'var(--primary)' : 'var(--background)')};
  color: ${(props) => (props.active ? 'white' : 'var(--foreground)')};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.active ? 'var(--primary-hover)' : 'var(--background-hover)')};
  }
`

interface ArtifactToolbarProps {
  artifact: ReactArtifactMinApp
  layout: 'horizontal' | 'vertical'
  onLayoutChange: (layout: 'horizontal' | 'vertical') => void
  onSave?: () => void
  onClose?: () => void
  onExport?: () => void
  onShare?: () => void
  onHistory?: () => void
  onEdit?: () => void
  onSettings?: () => void
  readOnly?: boolean
  hasUnsavedChanges?: boolean
  saveStatus?: 'saved' | 'saving' | 'error'
  error?: string | null
}

export const ArtifactToolbar: React.FC<ArtifactToolbarProps> = ({
  artifact,
  layout,
  onLayoutChange,
  onSave,
  onClose,
  onExport,
  onShare,
  onHistory,
  onEdit,
  onSettings,
  readOnly = false,
  hasUnsavedChanges = false,
  saveStatus = 'saved',
  error
}) => {
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            if (!readOnly && onSave) {
              onSave()
            }
            break
          case 'w':
            e.preventDefault()
            if (onClose) {
              onClose()
            }
            break
          case 'e':
            e.preventDefault()
            if (onExport) {
              onExport()
            }
            break
          case 'h':
            e.preventDefault()
            if (onHistory) {
              onHistory()
            }
            break
          case 'i':
            e.preventDefault()
            if (onEdit) {
              onEdit()
            }
            break
        }
      }
    },
    [onSave, onClose, onExport, onHistory, onEdit, readOnly]
  )

  // Get status display
  const getStatusDisplay = useCallback(() => {
    if (error) return { status: 'error' as const, text: 'Error' }
    if (saveStatus === 'saving') return { status: 'modified' as const, text: 'Saving...' }
    if (hasUnsavedChanges) return { status: 'modified' as const, text: 'Modified' }
    return { status: 'saved' as const, text: 'Saved' }
  }, [error, saveStatus, hasUnsavedChanges])

  const statusDisplay = getStatusDisplay()

  return (
    <ToolbarContainer onKeyDown={handleKeyDown} tabIndex={-1}>
      <ToolbarSection>
        <div>
          <ArtifactTitle>{artifact.artifact.metadata.title}</ArtifactTitle>
          <ArtifactMeta>
            <span>React Component</span>
            <span>•</span>
            <span>Latest</span>
            <span>•</span>
            <StatusIndicator status={statusDisplay.status}>{statusDisplay.text}</StatusIndicator>
          </ArtifactMeta>
        </div>
      </ToolbarSection>

      <ToolbarSection>
        <LayoutToggle>
          <LayoutButton
            active={layout === 'horizontal'}
            onClick={() => onLayoutChange('horizontal')}
            title="Horizontal split (Cmd+1)">
            ⬌
          </LayoutButton>
          <LayoutButton
            active={layout === 'vertical'}
            onClick={() => onLayoutChange('vertical')}
            title="Vertical split (Cmd+2)">
            ⬍
          </LayoutButton>
        </LayoutToggle>

        <ToolbarSeparator />

        {!readOnly && (
          <>
            <ToolbarButton
              variant="primary"
              onClick={onSave}
              disabled={!hasUnsavedChanges || saveStatus === 'saving'}
              title="Save changes (Cmd+S)">
              💾 Save
            </ToolbarButton>
            <ToolbarSeparator />
          </>
        )}

        <ToolbarButton onClick={onEdit} title="Edit with AI (Cmd+I)">
          🪄 Edit
        </ToolbarButton>

        <ToolbarButton onClick={onHistory} title="View history (Cmd+H)">
          📜 History
        </ToolbarButton>

        <ToolbarButton onClick={onExport} title="Export component (Cmd+E)">
          📤 Export
        </ToolbarButton>

        <ToolbarButton onClick={onShare} title="Share component">
          🔗 Share
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton onClick={onSettings} title="Settings">
          ⚙️
        </ToolbarButton>

        <ToolbarButton onClick={onClose} title="Close viewer (Cmd+W)">
          ✕
        </ToolbarButton>
      </ToolbarSection>
    </ToolbarContainer>
  )
}

export default ArtifactToolbar
