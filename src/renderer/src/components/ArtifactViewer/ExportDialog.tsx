import { Button, Card, Checkbox, Modal, Progress, Radio, Space, Typography, message } from 'antd'
import {
  CloudDownloadOutlined,
  CodeOutlined,
  FileZipOutlined,
  GlobalOutlined,
  Html5Outlined,
  LoadingOutlined
} from '@ant-design/icons'
import React, { useState } from 'react'

import { ArtifactExportService, type ExportOptions, type ExportResult } from '../../services/ArtifactExportService'

const { Title, Text } = Typography

interface ExportDialogProps {
  visible: boolean
  onClose: () => void
  artifactId: string
  artifactTitle?: string
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ visible, onClose, artifactId, artifactTitle }) => {
  const [exportType, setExportType] = useState<'html' | 'tsx' | 'package' | 'link'>('html')
  const [options, setOptions] = useState<ExportOptions>({
    includeSourceMap: false,
    minify: false,
    includeTypes: true,
    bundleDependencies: false,
    format: 'esm'
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const exportService = ArtifactExportService.getInstance()

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      let result: ExportResult

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      switch (exportType) {
        case 'html':
          result = await exportService.exportAsHTML(artifactId, options)
          break
        case 'tsx':
          result = await exportService.exportAsTSX(artifactId)
          break
        case 'package':
          result = await exportService.exportAsPackage(artifactId, options)
          break
        case 'link':
          result = await exportService.generateShareableLink(artifactId)
          break
        default:
          throw new Error('Invalid export type')
      }

      clearInterval(progressInterval)
      setExportProgress(100)

      if (result.success && result.data) {
        await handleExportSuccess(result)
        message.success(`${exportType.toUpperCase()} export completed successfully!`)
      } else {
        throw new Error(result.error || 'Export failed')
      }
    } catch (error) {
      message.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  const handleExportSuccess = async (result: ExportResult) => {
    if (!result.data) return

    switch (exportType) {
      case 'html':
      case 'tsx':
        // Download as file
        downloadFile(result.data as string, getFileName(), getContentType())
        break
      case 'package':
        // Download as ZIP
        downloadBlob(result.data as Buffer, `${artifactTitle || 'component'}-package.zip`, 'application/zip')
        break
      case 'link':
        // Copy to clipboard
        await navigator.clipboard.writeText(result.data as string)
        message.info('Shareable link copied to clipboard!')
        break
    }
  }

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType })
    downloadBlob(blob, filename, contentType)
  }

  const downloadBlob = (blob: Blob | Buffer, filename: string, contentType: string) => {
    const blobObj = blob instanceof Buffer ? new Blob([blob], { type: contentType }) : blob
    const url = URL.createObjectURL(blobObj)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getFileName = (): string => {
    const baseName = artifactTitle?.replace(/[^a-zA-Z0-9-_]/g, '-') || 'component'
    switch (exportType) {
      case 'html':
        return `${baseName}.html`
      case 'tsx':
        return `${baseName}.tsx`
      default:
        return baseName
    }
  }

  const getContentType = (): string => {
    switch (exportType) {
      case 'html':
        return 'text/html'
      case 'tsx':
        return 'text/typescript'
      default:
        return 'text/plain'
    }
  }

  const getExportIcon = () => {
    switch (exportType) {
      case 'html':
        return <Html5Outlined />
      case 'tsx':
        return <CodeOutlined />
      case 'package':
        return <FileZipOutlined />
      case 'link':
        return <GlobalOutlined />
    }
  }

  const getExportDescription = () => {
    switch (exportType) {
      case 'html':
        return 'Export as a standalone HTML file with embedded React and dependencies'
      case 'tsx':
        return 'Export as a TypeScript React component file'
      case 'package':
        return 'Export as a complete package with package.json, README, and example files'
      case 'link':
        return 'Generate a shareable link for this component'
    }
  }

  return (
    <Modal
      title="Export Component"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={isExporting ? <LoadingOutlined /> : <CloudDownloadOutlined />}
          onClick={handleExport}
          loading={isExporting}>
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      ]}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>Export Type</Title>
        <Radio.Group value={exportType} onChange={(e) => setExportType(e.target.value)} style={{ width: '100%' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small" style={{ cursor: 'pointer' }} onClick={() => setExportType('html')}>
              <Radio value="html">
                <Space>
                  <Html5Outlined style={{ fontSize: '18px', color: '#e34c26' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>HTML File</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Standalone HTML with embedded React
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Card>

            <Card size="small" style={{ cursor: 'pointer' }} onClick={() => setExportType('tsx')}>
              <Radio value="tsx">
                <Space>
                  <CodeOutlined style={{ fontSize: '18px', color: '#3178c6' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>TSX Component</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      TypeScript React component file
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Card>

            <Card size="small" style={{ cursor: 'pointer' }} onClick={() => setExportType('package')}>
              <Radio value="package">
                <Space>
                  <FileZipOutlined style={{ fontSize: '18px', color: '#f39c12' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Complete Package</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      ZIP with package.json, README, and examples
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Card>

            <Card size="small" style={{ cursor: 'pointer' }} onClick={() => setExportType('link')}>
              <Radio value="link">
                <Space>
                  <GlobalOutlined style={{ fontSize: '18px', color: '#52c41a' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Shareable Link</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Generate a link to share this component
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Card>
          </Space>
        </Radio.Group>
      </div>

      {(exportType === 'html' || exportType === 'package') && (
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>Export Options</Title>
          <Space direction="vertical">
            <Checkbox checked={options.minify}
              onChange={(e) => setOptions({ ...options, minify: e.target.checked })}>
              Minify code for production
            </Checkbox>
            <Checkbox
              checked={options.includeSourceMap}
              onChange={(e) => setOptions({ ...options, includeSourceMap: e.target.checked })}>
              Include source maps
            </Checkbox>
            {exportType === 'package' && (
              <>
                <Checkbox
                  checked={options.includeTypes}
                  onChange={(e) => setOptions({ ...options, includeTypes: e.target.checked })}>
                  Include TypeScript definitions
                </Checkbox>
                <Checkbox
                  checked={options.bundleDependencies}
                  onChange={(e) => setOptions({ ...options, bundleDependencies: e.target.checked })}>
                  Bundle dependencies
                </Checkbox>
              </>
            )}
          </Space>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
            {getExportIcon()}
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {exportType.charAt(0).toUpperCase() + exportType.slice(1)} Export
              </div>
              <Text style={{ fontSize: '12px' }}>{getExportDescription()}</Text>
            </div>
          </Space>
        </Card>
      </div>

      {isExporting && (
        <div style={{ marginBottom: '16px' }}>
          <Progress percent={exportProgress} status="active" />
          <Text style={{ fontSize: '12px', color: '#666' }}>Preparing export...</Text>
        </div>
      )}
    </Modal>
  )
}
