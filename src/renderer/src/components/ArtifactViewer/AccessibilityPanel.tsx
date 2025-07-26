import { Alert, Button, Card, List, Progress, Tag, Tooltip } from 'antd'
import {
  BugOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import React, { useEffect, useState } from 'react'

import {
  ArtifactAccessibilityValidator,
  type AccessibilityReport,
  type AccessibilityViolation
} from '../../services/ArtifactAccessibilityValidator'

interface AccessibilityPanelProps {
  artifactId: string
  isVisible: boolean
  previewContainer?: HTMLElement | null
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ artifactId, isVisible, previewContainer }) => {
  const [report, setReport] = useState<AccessibilityReport | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const validator = ArtifactAccessibilityValidator.getInstance()

  useEffect(() => {
    if (isVisible && previewContainer) {
      validateAccessibility()
    }
  }, [isVisible, previewContainer, artifactId])

  const validateAccessibility = async () => {
    if (!previewContainer) return

    setIsValidating(true)
    try {
      const accessibilityReport = await validator.validateArtifact(artifactId, previewContainer)
      setReport(accessibilityReport)
    } catch (error) {
      console.error('Accessibility validation failed:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#52c41a'
    if (score >= 60) return '#faad14'
    return '#ff4d4f'
  }

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <BugOutlined style={{ color: '#ff4d4f' }} />
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />
    }
  }


  const getLevelColor = (level: 'A' | 'AA' | 'AAA'): string => {
    switch (level) {
      case 'A':
        return '#52c41a'
      case 'AA':
        return '#faad14'
      case 'AAA':
        return '#722ed1'
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="accessibility-panel" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Accessibility Validator</h3>
        <Tooltip title="Run accessibility validation">
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isValidating} />}
            onClick={validateAccessibility}
            loading={isValidating}
            size="small">
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
        </Tooltip>
      </div>

      {!previewContainer && (
        <Alert
          message="Preview Required"
          description="Accessibility validation requires a rendered preview. Please ensure the preview panel is active."
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {report && (
        <>
          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={report.score}
                format={(percent) => `${percent}`}
                strokeColor={getScoreColor(report.score)}
                size={80}
              />
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>Accessibility Score</div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  {report.summary.passedRules}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Passed Rules</div>
              </div>
            </Card>

            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                  {report.summary.violations}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Violations</div>
              </div>
            </Card>

            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>{report.summary.errors}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Errors</div>
              </div>
            </Card>

            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>{report.summary.warnings}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Warnings</div>
              </div>
            </Card>
          </div>

          {report.violations.length > 0 && (
            <Card title="Accessibility Issues" size="small" style={{ marginBottom: '16px' }}>
              <List
                size="small"
                dataSource={report.violations}
                renderItem={(violation: AccessibilityViolation) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        {getSeverityIcon(violation.severity)}
                        <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>{violation.rule.name}</span>
                        <Tag color={getLevelColor(violation.rule.level)} style={{ marginLeft: 'auto' }}>
                          WCAG {violation.rule.level}
                        </Tag>
                      </div>
                      <div style={{ marginBottom: '4px', color: '#666' }}>{violation.message}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        Element: {violation.element}
                        {violation.selector && ` (${violation.selector})`}
                      </div>
                      {violation.fix && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f6ffed',
                            border: '1px solid #b7eb8f',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                          <strong>Fix:</strong> {violation.fix}
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {report.passedRules.length > 0 && (
            <Card title="Passed Rules" size="small" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {report.passedRules.map((rule) => (
                  <Tooltip key={rule.id} title={rule.description}>
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      {rule.name}
                    </Tag>
                  </Tooltip>
                ))}
              </div>
            </Card>
          )}

          {report.recommendations.length > 0 && (
            <Card title="Recommendations" size="small">
              <List
                size="small"
                dataSource={report.recommendations}
                renderItem={(recommendation) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <ExclamationCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                      <span>{recommendation}</span>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <div style={{ marginTop: '16px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
            Last validated: {new Date(report.timestamp).toLocaleString()}
          </div>
        </>
      )}

      {!report && !isValidating && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <ExclamationCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
          <div>No accessibility report available</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>Click "Validate" to run accessibility checks</div>
        </div>
      )}
    </div>
  )
}
