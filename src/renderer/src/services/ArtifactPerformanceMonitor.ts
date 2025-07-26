import { loggerService } from '@logger'

const logger = loggerService.withContext('ArtifactPerformanceMonitor')

export interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  componentCount: number
  reRenderCount: number
  errorCount: number
  lastUpdate: number
  bundleSize?: number
  loadTime?: number
}

export interface PerformanceThresholds {
  maxRenderTime: number
  maxMemoryUsage: number
  maxReRenderCount: number
  maxErrorCount: number
}

export interface PerformanceAlert {
  type: 'warning' | 'error'
  metric: keyof PerformanceMetrics
  value: number
  threshold: number
  message: string
  timestamp: number
}

export interface PerformanceReport {
  artifactId: string
  metrics: PerformanceMetrics
  alerts: PerformanceAlert[]
  recommendations: string[]
  score: number // 0-100
}

export interface PerformanceEntry {
  name: string
  entryType: string
  startTime: number
  duration: number
}

export class ArtifactPerformanceMonitor {
  private static instance: ArtifactPerformanceMonitor
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private observers: Map<string, PerformanceObserver> = new Map()
  private thresholds: PerformanceThresholds = {
    maxRenderTime: 16, // 60fps target
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxReRenderCount: 10,
    maxErrorCount: 3
  }

  private constructor() {
    // Initialize performance monitoring
    this.initializePerformanceAPI()
  }

  public static getInstance(): ArtifactPerformanceMonitor {
    if (!ArtifactPerformanceMonitor.instance) {
      ArtifactPerformanceMonitor.instance = new ArtifactPerformanceMonitor()
    }
    return ArtifactPerformanceMonitor.instance
  }

  /**
   * Start monitoring performance for an artifact
   */
  public startMonitoring(artifactId: string): void {
    logger.info(`Starting performance monitoring for artifact ${artifactId}`)

    // Initialize metrics
    this.metrics.set(artifactId, {
      renderTime: 0,
      memoryUsage: 0,
      componentCount: 0,
      reRenderCount: 0,
      errorCount: 0,
      lastUpdate: Date.now()
    })

    // Set up performance observer
    this.setupPerformanceObserver(artifactId)

    // Start memory monitoring
    this.startMemoryMonitoring(artifactId)
  }

  /**
   * Stop monitoring performance for an artifact
   */
  public stopMonitoring(artifactId: string): void {
    logger.info(`Stopping performance monitoring for artifact ${artifactId}`)

    const observer = this.observers.get(artifactId)
    if (observer) {
      observer.disconnect()
      this.observers.delete(artifactId)
    }

    // Keep metrics for reporting but stop active monitoring
  }

  /**
   * Record a render event
   */
  public recordRender(artifactId: string, renderTime: number): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    metrics.renderTime = renderTime
    metrics.reRenderCount++
    metrics.lastUpdate = Date.now()

    this.checkThresholds(artifactId, metrics)
  }

  /**
   * Record an error event
   */
  public recordError(artifactId: string, error: Error): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    metrics.errorCount++
    metrics.lastUpdate = Date.now()

    logger.warn(`Error recorded for artifact ${artifactId}:`, error)
    this.checkThresholds(artifactId, metrics)
  }

  /**
   * Update component count
   */
  public updateComponentCount(artifactId: string, count: number): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    metrics.componentCount = count
    metrics.lastUpdate = Date.now()
  }

  /**
   * Record bundle size
   */
  public recordBundleSize(artifactId: string, size: number): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    metrics.bundleSize = size
    metrics.lastUpdate = Date.now()
  }

  /**
   * Record load time
   */
  public recordLoadTime(artifactId: string, loadTime: number): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    metrics.loadTime = loadTime
    metrics.lastUpdate = Date.now()
  }

  /**
   * Get current metrics for an artifact
   */
  public getMetrics(artifactId: string): PerformanceMetrics | null {
    return this.metrics.get(artifactId) || null
  }

  /**
   * Generate performance report
   */
  public generateReport(artifactId: string): PerformanceReport | null {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return null

    const alerts = this.generateAlerts(artifactId, metrics)
    const recommendations = this.generateRecommendations(metrics, alerts)
    const score = this.calculatePerformanceScore(metrics, alerts)

    return {
      artifactId,
      metrics,
      alerts,
      recommendations,
      score
    }
  }

  /**
   * Get all monitored artifacts
   */
  public getMonitoredArtifacts(): string[] {
    return Array.from(this.metrics.keys())
  }

  /**
   * Clear metrics for an artifact
   */
  public clearMetrics(artifactId: string): void {
    this.metrics.delete(artifactId)
    this.stopMonitoring(artifactId)
  }

  /**
   * Update performance thresholds
   */
  public updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
    logger.info('Performance thresholds updated:', this.thresholds)
  }

  private initializePerformanceAPI(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Performance API is available
      logger.info('Performance API initialized')
    } else {
      logger.warn('Performance API not available')
    }
  }

  private setupPerformanceObserver(artifactId: string): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        this.processPerformanceEntries(artifactId, entries as PerformanceEntry[])
      })

      observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] })
      this.observers.set(artifactId, observer)
    } catch (error) {
      logger.warn('Failed to setup performance observer:', error as Error)
    }
  }

  private processPerformanceEntries(artifactId: string, entries: PerformanceEntry[]): void {
    const metrics = this.metrics.get(artifactId)
    if (!metrics) return

    entries.forEach((entry) => {
      if (entry.name.includes(artifactId)) {
        if (entry.entryType === 'measure') {
          metrics.renderTime = entry.duration
        } else if (entry.entryType === 'resource') {
          metrics.loadTime = entry.duration
        }
      }
    })

    metrics.lastUpdate = Date.now()
  }

  private startMemoryMonitoring(artifactId: string): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return
    }

    const checkMemory = () => {
      const metrics = this.metrics.get(artifactId)
      if (!metrics) return

      // Use performance.memory if available (Chrome)
      if ('memory' in performance) {
        const memory = (performance as any).memory
        metrics.memoryUsage = memory.usedJSHeapSize
      }

      metrics.lastUpdate = Date.now()
      this.checkThresholds(artifactId, metrics)
    }

    // Check memory every 5 seconds
    const interval = setInterval(checkMemory, 5000)

    // Store interval for cleanup
    setTimeout(() => clearInterval(interval), 300000) // Stop after 5 minutes
  }

  private checkThresholds(artifactId: string, metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = []

    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      alerts.push({
        type: 'warning',
        metric: 'renderTime',
        value: metrics.renderTime,
        threshold: this.thresholds.maxRenderTime,
        message: `Render time (${metrics.renderTime.toFixed(2)}ms) exceeds threshold`,
        timestamp: Date.now()
      })
    }

    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      alerts.push({
        type: 'error',
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: this.thresholds.maxMemoryUsage,
        message: `Memory usage (${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB) exceeds threshold`,
        timestamp: Date.now()
      })
    }

    if (metrics.reRenderCount > this.thresholds.maxReRenderCount) {
      alerts.push({
        type: 'warning',
        metric: 'reRenderCount',
        value: metrics.reRenderCount,
        threshold: this.thresholds.maxReRenderCount,
        message: `Re-render count (${metrics.reRenderCount}) exceeds threshold`,
        timestamp: Date.now()
      })
    }

    if (metrics.errorCount > this.thresholds.maxErrorCount) {
      alerts.push({
        type: 'error',
        metric: 'errorCount',
        value: metrics.errorCount,
        threshold: this.thresholds.maxErrorCount,
        message: `Error count (${metrics.errorCount}) exceeds threshold`,
        timestamp: Date.now()
      })
    }

    if (alerts.length > 0) {
      logger.warn(`Performance alerts for artifact ${artifactId}:`, alerts)
    }
  }

  private generateAlerts(artifactId: string, metrics: PerformanceMetrics): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = []

    // Check all thresholds and generate alerts
    Object.entries(this.thresholds).forEach(([key, threshold]) => {
      const metricKey = key.replace('max', '').toLowerCase() as keyof PerformanceMetrics
      const value = metrics[metricKey] as number

      if (value > threshold) {
        alerts.push({
          type: key.includes('error') || key.includes('memory') ? 'error' : 'warning',
          metric: metricKey,
          value,
          threshold,
          message: `${metricKey} (${value}) exceeds threshold (${threshold})`,
          timestamp: Date.now()
        })
      }
    })

    return alerts
  }

  private generateRecommendations(metrics: PerformanceMetrics, alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = []

    alerts.forEach((alert) => {
      switch (alert.metric) {
        case 'renderTime':
          recommendations.push('Consider optimizing component rendering with React.memo or useMemo')
          recommendations.push('Reduce the complexity of render logic')
          break
        case 'memoryUsage':
          recommendations.push('Check for memory leaks in event listeners or timers')
          recommendations.push('Optimize large data structures or images')
          break
        case 'reRenderCount':
          recommendations.push('Use React.memo to prevent unnecessary re-renders')
          recommendations.push('Optimize state management and prop passing')
          break
        case 'errorCount':
          recommendations.push('Add proper error boundaries and error handling')
          recommendations.push('Review component logic for potential issues')
          break
      }
    })

    // General recommendations
    if (metrics.bundleSize && metrics.bundleSize > 1024 * 1024) {
      recommendations.push('Consider code splitting to reduce bundle size')
    }

    if (metrics.componentCount > 50) {
      recommendations.push('Consider breaking down large components into smaller ones')
    }

    return [...new Set(recommendations)] // Remove duplicates
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics, alerts: PerformanceAlert[]): number {
    let score = 100

    // Deduct points for alerts
    alerts.forEach((alert) => {
      if (alert.type === 'error') {
        score -= 20
      } else {
        score -= 10
      }
    })

    // Deduct points for poor metrics
    if (metrics.renderTime > 8) score -= 5
    if (metrics.reRenderCount > 5) score -= 5
    if (metrics.errorCount > 0) score -= 10

    return Math.max(0, score)
  }
}
