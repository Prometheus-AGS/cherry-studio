import { loggerService } from '@logger'
import { ComponentSandbox } from '@renderer/services/ComponentSandbox'
import { ReactArtifactMinApp } from '@renderer/types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('ArtifactPreviewPanel')

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background);
`

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
  font-size: 12px;
  color: var(--foreground-secondary);
`

const PreviewControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ControlButton = styled.button<{ active?: boolean }>`
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: ${(props) => (props.active ? 'var(--primary)' : 'var(--background)')};
  color: ${(props) => (props.active ? 'white' : 'var(--foreground)')};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.active ? 'var(--primary-hover)' : 'var(--background-hover)')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const PreviewContent = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  background: white;
`

const PreviewFrame = styled.iframe<{ deviceWidth: string }>`
  width: ${(props) => props.deviceWidth};
  height: 100%;
  border: none;
  background: white;
  transition: width 0.3s ease;
  margin: 0 auto;
  display: block;
`

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
`

const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--background);
  color: var(--foreground);
  padding: 20px;
  text-align: center;
  z-index: 10;
`

const ErrorTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #ff6b6b;
  font-size: 16px;
`

const ErrorMessage = styled.pre`
  margin: 0;
  padding: 12px;
  background: var(--background-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: var(--foreground-secondary);
  white-space: pre-wrap;
  max-width: 100%;
  overflow: auto;
`

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  border-top: 1px solid var(--border);
  background: var(--background-secondary);
  font-size: 11px;
  color: var(--foreground-secondary);
`

const StatusIndicator = styled.div<{ status: 'loading' | 'ready' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${(props) => {
      switch (props.status) {
        case 'loading':
          return '#ffa500'
        case 'ready':
          return '#4caf50'
        case 'error':
          return '#ff6b6b'
        default:
          return 'var(--border)'
      }
    }};
  }
`

type DevicePreset = {
  name: string
  width: string
  description: string
}

const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'Desktop', width: '100%', description: 'Full width' },
  { name: 'Tablet', width: '768px', description: '768px' },
  { name: 'Mobile', width: '375px', description: '375px' },
  { name: 'Mobile S', width: '320px', description: '320px' }
]

interface ArtifactPreviewPanelProps {
  artifact: ReactArtifactMinApp
  code: string
  onError?: (error: string) => void
  onReady?: () => void
}

export const ArtifactPreviewPanel: React.FC<ArtifactPreviewPanelProps> = ({ artifact, code, onError, onReady }) => {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const sandboxRef = useRef<ComponentSandbox | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  // Initialize sandbox
  useEffect(() => {
    if (!frameRef.current) return

    const sandbox = ComponentSandbox.getInstance()
    sandboxRef.current = sandbox

    return () => {
      // Cleanup handled by singleton
    }
  }, [])

  // Handle code changes and re-render
  const renderComponent = useCallback(async () => {
    if (!sandboxRef.current || !frameRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      const iframe = await sandboxRef.current.createSandbox(artifact.artifact.id, { ...artifact.artifact, code })

      // Replace the current iframe with the new one
      if (frameRef.current && frameRef.current.parentNode) {
        frameRef.current.parentNode.replaceChild(iframe, frameRef.current)
        frameRef.current = iframe
      }

      setIsLoading(false)
      onReady?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setIsLoading(false)
      onError?.(errorMessage)
    }
  }, [artifact, code, onError, onReady])

  // Re-render when code changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      renderComponent()
    }, 300) // Debounce re-renders

    return () => clearTimeout(timeoutId)
  }, [renderComponent])

  // Handle device preset changes
  const handleDeviceChange = useCallback((index: number) => {
    setSelectedDevice(index)
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
    renderComponent()
  }, [renderComponent])

  // Handle zoom (future enhancement)
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    // TODO: Implement zoom functionality
    logger.debug('Zoom action triggered', { direction })
  }, [])

  // Get current status
  const getStatus = useCallback(() => {
    if (isLoading) return 'loading'
    if (error) return 'error'
    return 'ready'
  }, [isLoading, error])

  const currentDevice = DEVICE_PRESETS[selectedDevice]
  const status = getStatus()

  return (
    <PreviewContainer>
      <PreviewHeader>
        <span>Preview • {artifact.artifact.metadata.title}</span>
        <PreviewControls>
          {DEVICE_PRESETS.map((device, index) => (
            <ControlButton
              key={device.name}
              active={selectedDevice === index}
              onClick={() => handleDeviceChange(index)}
              title={device.description}>
              {device.name}
            </ControlButton>
          ))}
          <ControlButton onClick={handleRefresh} title="Refresh preview">
            ↻
          </ControlButton>
          <ControlButton onClick={() => handleZoom('out')} title="Zoom out" disabled>
            −
          </ControlButton>
          <ControlButton onClick={() => handleZoom('in')} title="Zoom in" disabled>
            +
          </ControlButton>
        </PreviewControls>
      </PreviewHeader>

      <PreviewContent>
        <PreviewFrame
          ref={frameRef}
          key={refreshKey}
          deviceWidth={currentDevice.width}
          title="Component Preview"
          sandbox="allow-scripts allow-same-origin"
        />

        {isLoading && (
          <LoadingOverlay>
            <div>Loading preview...</div>
          </LoadingOverlay>
        )}

        {error && (
          <ErrorOverlay>
            <ErrorTitle>Preview Error</ErrorTitle>
            <ErrorMessage>{error}</ErrorMessage>
            <ControlButton onClick={handleRefresh} style={{ marginTop: '12px' }}>
              Try Again
            </ControlButton>
          </ErrorOverlay>
        )}
      </PreviewContent>

      <StatusBar>
        <StatusIndicator status={status}>
          {status === 'loading' && 'Rendering...'}
          {status === 'ready' && 'Ready'}
          {status === 'error' && 'Error'}
        </StatusIndicator>
        <span>
          {currentDevice.name} • {currentDevice.description}
        </span>
      </StatusBar>
    </PreviewContainer>
  )
}

export default ArtifactPreviewPanel
