import { Alert, Button, Card, List, Progress, Statistic, Tooltip } from 'antd'
import {
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import React, { useEffect, useState } from 'react'

import {
  ArtifactPerformanceMonitor,
  type PerformanceMetrics,
  type PerformanceReport
} from '../../services/ArtifactPerformanceMonitor'

interface PerformancePanelProps {
  artifactId: string
  isVisible: boolean
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({ artifactId, isVisible }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const performanceMonitor = ArtifactPerformanceMonitor.getInstance()

  useEffect(() => {
    if (isVisible && artifactId) {
      startMonitoring()
      const interval = setInterval(updateMetrics, 1000)
      return () => {
        clearInterval(interval)
        stopMonitoring()
      }
    }
  }, [isVisible, artifactId])

  const startMonitoring = () => {
    performanceMonitor.startMonitoring(artifactId)
    setIsMonitoring(true)
    updateMetrics()
  }

  const stopMonitoring = () => {
    performanceMonitor.stopMonitoring(artifactId)
    setIsMonitoring(false)
  }

  const updateMetrics = () => {
    const currentMetrics = performanceMonitor.getMetrics(artifactId)
    const currentReport = performanceMonitor.generateReport(artifactId)

    setMetrics(currentMetrics)
    setReport(currentReport)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#52c41a'
    if (score >= 60) return '#faad14'
    return '#ff4d4f'
  }

  const getAlertIcon = (type: 'warning' | 'error') => {
    return type === 'error' ? <BugOutlined /> : <WarningOutlined />
  }

  if (!isVisible || !metrics) {
    return null
  }

  return (
    <div className="performance-panel" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Performance Monitor</h3>
        <div>
          <Tooltip title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}>
            <Button
              type={isMonitoring ? 'primary' : 'default'}
              icon={<ReloadOutlined spin={isMonitoring} />}
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              size="small">
              {isMonitoring ? 'Stop' : 'Start'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {report && (
        <Card size="small" style={{ marginBottom: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={report.score}
              format={(percent) => `${percent}`}
              strokeColor={getScoreColor(report.score)}
              size={80}
            />
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>Performance Score</div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <Card size="small">
          <Statistic
            title="Render Time"
            value={metrics.renderTime.toFixed(2)}
            suffix="ms"
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: metrics.renderTime > 16 ? '#ff4d4f' : '#52c41a' }}
          />
        </Card>

        <Card size="small">
          <Statistic
            title="Memory Usage"
            value={formatBytes(metrics.memoryUsage)}
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: metrics.memoryUsage > 50 * 1024 * 1024 ? '#ff4d4f' : '#52c41a' }}
          />
        </Card>

        <Card size="small">
          <Statistic
            title="Re-renders"
            value={metrics.reRenderCount}
            valueStyle={{ color: metrics.reRenderCount > 10 ? '#faad14' : '#52c41a' }}
          />
        </Card>

        <Card size="small">
          <Statistic
            title="Errors"
            value={metrics.errorCount}
            prefix={<BugOutlined />}
            valueStyle={{ color: metrics.errorCount > 0 ? '#ff4d4f' : '#52c41a' }}
          />
        </Card>
      </div>

      {metrics.bundleSize && (
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Statistic
            title="Bundle Size"
            value={formatBytes(metrics.bundleSize)}
            valueStyle={{ color: metrics.bundleSize > 1024 * 1024 ? '#faad14' : '#52c41a' }}
          />
        </Card>
      )}

      {metrics.loadTime && (
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Statistic
            title="Load Time"
            value={metrics.loadTime.toFixed(2)}
            suffix="ms"
            valueStyle={{ color: metrics.loadTime > 1000 ? '#faad14' : '#52c41a' }}
          />
        </Card>
      )}

      {report && report.alerts.length > 0 && (
        <Card title="Performance Alerts" size="small" style={{ marginBottom: '16px' }}>
          <List
            size="small"
            dataSource={report.alerts}
            renderItem={(alert) => (
              <List.Item>
                <Alert
                  message={alert.message}
                  type={alert.type === 'error' ? 'error' : 'warning'}
                  icon={getAlertIcon(alert.type)}
                  showIcon
                  style={{ width: '100%' }}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {report && report.recommendations.length > 0 && (
        <Card title="Recommendations" size="small">
          <List
            size="small"
            dataSource={report.recommendations}
            renderItem={(recommendation) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                  <span>{recommendation}</span>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
        Last updated: {new Date(metrics.lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  )
}
