import { useReactArtifacts } from '@renderer/hooks/useReactArtifacts'
import { ReactArtifactMinApp, Assistant, EditResponse } from '@renderer/types'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import { ArtifactCodeEditor } from './ArtifactCodeEditor'
import { ArtifactEditDialog, EditResultToast } from './ArtifactEditDialog'
import ArtifactPreviewPanel from './ArtifactPreviewPanel'
import { ArtifactToolbar } from './ArtifactToolbar'

const ViewerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--background);
  color: var(--foreground);
`

const ViewerContent = styled.div<{ layout: 'horizontal' | 'vertical' }>`
  display: flex;
  flex: 1;
  flex-direction: ${(props) => (props.layout === 'horizontal' ? 'row' : 'column')};
  overflow: hidden;
`

const EditorPanel = styled.div<{ width: number }>`
  flex: 0 0 ${(props) => props.width}%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  min-width: 300px;
`

const PreviewPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 300px;
`

const ResizeHandle = styled.div<{ layout: 'horizontal' | 'vertical' }>`
  ${(props) =>
    props.layout === 'horizontal'
      ? `
    width: 4px;
    cursor: col-resize;
    background: var(--border);
    &:hover {
      background: var(--primary);
    }
  `
      : `
    height: 4px;
    cursor: row-resize;
    background: var(--border);
    &:hover {
      background: var(--primary);
    }
  `}
`

const ErrorBoundary = styled.div`
  padding: 20px;
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  background: #ffe0e0;
  color: #d63031;
  margin: 20px;
`

interface ArtifactViewerProps {
  artifact: ReactArtifactMinApp
  onClose?: () => void
  onSave?: (code: string, description: string) => void
  readOnly?: boolean
  assistant?: Assistant
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  artifact,
  onClose,
  onSave,
  readOnly = false,
  assistant
}) => {
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
  const [editorWidth, setEditorWidth] = useState(50)
  const [code, setCode] = useState(artifact.artifact.code)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editResult, setEditResult] = useState<EditResponse | null>(null)

  const { validateArtifactCode, updateArtifact } = useReactArtifacts()

  // Handle code changes
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode)
      setHasUnsavedChanges(newCode !== artifact.artifact.code)
      setError(null)

      // Validate code in real-time
      const validation = validateArtifactCode(newCode)
      if (!validation.isValid) {
        setError(validation.errors.join(', '))
      }
    },
    [artifact.artifact.code, validateArtifactCode]
  )

  // Handle save
  const handleSave = useCallback(
    async (description: string) => {
      if (!hasUnsavedChanges) return

      try {
        if (onSave) {
          onSave(code, description)
        } else {
          await updateArtifact(artifact.artifactId, code, description)
        }
        setHasUnsavedChanges(false)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save artifact')
      }
    },
    [code, hasUnsavedChanges, onSave, updateArtifact, artifact.artifactId]
  )


  // Handle edit dialog
  const handleEditClick = useCallback(() => {
    if (!assistant) {
      setError('No assistant available for editing')
      return
    }
    setIsEditDialogOpen(true)
  }, [assistant])

  const handleEditComplete = useCallback((response: EditResponse) => {
    setEditResult(response)

    if (response.success && response.newCode) {
      // Apply the new code
      setCode(response.newCode)
      setHasUnsavedChanges(true)
      setError(null)

      // Auto-save if successful
      handleSave('LLM Edit: ' + response.explanation)
    } else if (response.errors && response.errors.length > 0) {
      setError(response.errors.join(', '))
    }

    // Auto-close toast after 5 seconds
    setTimeout(() => {
      setEditResult(null)
    }, 5000)
  }, [])

  const handleCloseEditResult = useCallback(() => {
    setEditResult(null)
  }, [])

  // Handle resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const handleMouseMove = (e: MouseEvent) => {
        if (layout === 'horizontal') {
          const containerWidth = window.innerWidth
          const newWidth = (e.clientX / containerWidth) * 100
          setEditorWidth(Math.max(20, Math.min(80, newWidth)))
        } else {
          const containerHeight = window.innerHeight
          const newHeight = (e.clientY / containerHeight) * 100
          setEditorWidth(Math.max(20, Math.min(80, newHeight)))
        }
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [layout]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            if (hasUnsavedChanges && !readOnly) {
              handleSave('Quick save')
            }
            break
          case 'w':
            e.preventDefault()
            if (onClose) {
              onClose()
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges, readOnly, handleSave, onClose])

  // Handle layout changes based on window size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setLayout('vertical')
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Check initial size

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <ViewerContainer>
      <ArtifactToolbar
        artifact={artifact}
        layout={layout}
        onLayoutChange={setLayout}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={() => handleSave('Manual save')}
        onEdit={handleEditClick}
        onClose={onClose}
        readOnly={readOnly}
        error={error}
      />

      <ViewerContent layout={layout}>
        <EditorPanel width={editorWidth}>
          <ArtifactCodeEditor
            code={code}
            language="tsx"
            onChange={handleCodeChange}
            readOnly={readOnly}
            artifact={artifact}
            error={error}
          />
        </EditorPanel>

        <ResizeHandle layout={layout} onMouseDown={handleMouseDown} />

        <PreviewPanel>
          {error ? (
            <ErrorBoundary>
              <h3>Code Error</h3>
              <p>{error}</p>
            </ErrorBoundary>
          ) : (
            <ArtifactPreviewPanel
              artifact={artifact}
              code={code}
              onError={setError}
            />
          )}
        </PreviewPanel>
      </ViewerContent>

      {/* Edit Dialog */}
      {assistant && (
        <ArtifactEditDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          artifactId={artifact.artifactId}
          currentVersion={artifact.artifact.version}
          assistant={assistant}
          onEditComplete={handleEditComplete}
        />
      )}

      {/* Edit Result Toast */}
      {editResult && (
        <EditResultToast
          response={editResult}
          onClose={handleCloseEditResult}
        />
      )}
    </ViewerContainer>
  )
}

export default ArtifactViewer
