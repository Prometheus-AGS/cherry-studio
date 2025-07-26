import { loggerService } from '@logger'

import type { ReactArtifact } from '../types'
import { ArtifactTestRunner } from './__tests__/ArtifactTestRunner'
import { ArtifactSecurityValidator, type SecurityViolation } from './ArtifactSecurityValidator'
import { ArtifactStorage } from './ArtifactStorage'
import { ComponentCompiler } from './ComponentCompiler'
import { DependencyManager } from './DependencyManager'

interface DebugSession {
  id: string
  artifactId: string
  startTime: number
  logs: DebugLog[]
  metrics: DebugMetrics
  status: 'active' | 'completed' | 'error'
}

interface DebugLog {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
  stackTrace?: string
}

interface DebugMetrics {
  compilationTime: number
  securityValidationTime: number
  testExecutionTime: number
  memoryUsage: number
  errorCount: number
  warningCount: number
}

interface DiagnosticResult {
  artifactId: string
  status: 'healthy' | 'warning' | 'error'
  issues: DiagnosticIssue[]
  recommendations: string[]
  metrics: DebugMetrics
  timestamp: number
}

interface DiagnosticIssue {
  type: 'compilation' | 'security' | 'performance' | 'dependency'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  location?: {
    line: number
    column: number
    file?: string
  }
  suggestion?: string
}

interface PerformanceProfile {
  artifactId: string
  phases: {
    parsing: number
    compilation: number
    validation: number
    rendering: number
    total: number
  }
  memoryPeaks: number[]
  bottlenecks: string[]
  optimizations: string[]
}

/**
 * Comprehensive debugging and diagnostic service for React artifacts
 * Provides detailed analysis, performance profiling, and troubleshooting tools
 */
export class ArtifactDebugger {
  private static instance: ArtifactDebugger
  private logger = loggerService.withContext('ArtifactDebugger')
  private sessions = new Map<string, DebugSession>()
  private storage = ArtifactStorage.getInstance()
  private securityValidator = ArtifactSecurityValidator.getInstance()
  private testRunner = ArtifactTestRunner.getInstance()
  private compiler = ComponentCompiler.getInstance()
  private dependencyManager = DependencyManager.getInstance()

  private constructor() {
    this.logger.info('ArtifactDebugger initialized')
  }

  public static getInstance(): ArtifactDebugger {
    if (!ArtifactDebugger.instance) {
      ArtifactDebugger.instance = new ArtifactDebugger()
    }
    return ArtifactDebugger.instance
  }

  /**
   * Start a new debugging session for an artifact
   */
  public async startDebugSession(artifactId: string): Promise<string> {
    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    const session: DebugSession = {
      id: sessionId,
      artifactId,
      startTime: Date.now(),
      logs: [],
      metrics: {
        compilationTime: 0,
        securityValidationTime: 0,
        testExecutionTime: 0,
        memoryUsage: 0,
        errorCount: 0,
        warningCount: 0
      },
      status: 'active'
    }

    this.sessions.set(sessionId, session)
    this.addLog(sessionId, 'info', `Debug session started for artifact ${artifactId}`)

    this.logger.info('Debug session started', { sessionId, artifactId })
    return sessionId
  }

  /**
   * Add a log entry to a debug session
   */
  public addLog(
    sessionId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.logger.warn('Attempted to log to non-existent session', { sessionId })
      return
    }

    const log: DebugLog = {
      timestamp: Date.now(),
      level,
      message,
      context,
      stackTrace: error?.stack
    }

    session.logs.push(log)

    if (level === 'error') {
      session.metrics.errorCount++
    } else if (level === 'warn') {
      session.metrics.warningCount++
    }

    this.logger[level](message, { sessionId, context, error })
  }

  /**
   * Perform comprehensive diagnostic analysis of an artifact
   */
  public async performDiagnostics(artifactId: string): Promise<DiagnosticResult> {
    const sessionId = await this.startDebugSession(artifactId)

    try {
      this.addLog(sessionId, 'info', 'Starting comprehensive diagnostics')

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        throw new Error(`Artifact ${artifactId} not found`)
      }

      const issues: DiagnosticIssue[] = []
      const recommendations: string[] = []

      // 1. Compilation Analysis
      this.addLog(sessionId, 'info', 'Analyzing compilation')
      const compilationStart = Date.now()

      try {
        const compilationResult = await this.compiler.compileArtifact(artifact)
        const compilationTime = Date.now() - compilationStart
        this.updateMetrics(sessionId, { compilationTime })

        if (!compilationResult.success) {
          compilationResult.errors.forEach((errorMessage) => {
            issues.push({
              type: 'compilation',
              severity: 'high',
              message: errorMessage,
              suggestion: this.getCompilationSuggestion(errorMessage)
            })
          })
          recommendations.push('Fix compilation errors before proceeding')
        }
      } catch (error) {
        this.addLog(sessionId, 'error', 'Compilation analysis failed', {}, error as Error)
        issues.push({
          type: 'compilation',
          severity: 'critical',
          message: `Compilation failed: ${(error as Error).message}`,
          suggestion: 'Check code syntax and dependencies'
        })
      }

      // 2. Security Analysis
      this.addLog(sessionId, 'info', 'Analyzing security')
      const securityStart = Date.now()

      try {
        const securityResult = await this.securityValidator.validateArtifact(artifact)
        const securityTime = Date.now() - securityStart
        this.updateMetrics(sessionId, { securityValidationTime: securityTime })

        if (!securityResult.isSecure) {
          securityResult.violations.forEach((violation) => {
            issues.push({
              type: 'security',
              severity: violation.severity as 'low' | 'medium' | 'high' | 'critical',
              message: violation.message,
              location:
                violation.line && violation.column
                  ? {
                      line: violation.line,
                      column: violation.column
                    }
                  : undefined,
              suggestion: this.getSecuritySuggestion(violation)
            })
          })
          recommendations.push('Address security violations before deployment')
        }

        if (securityResult.score < 80) {
          recommendations.push('Consider improving security score above 80%')
        }
      } catch (error) {
        this.addLog(sessionId, 'error', 'Security analysis failed', {}, error as Error)
        issues.push({
          type: 'security',
          severity: 'critical',
          message: `Security validation failed: ${(error as Error).message}`,
          suggestion: 'Review code for security issues'
        })
      }

      // 3. Dependency Analysis
      this.addLog(sessionId, 'info', 'Analyzing dependencies')

      try {
        const dependencyIssues = await this.analyzeDependencies(artifact)
        issues.push(...dependencyIssues)

        if (dependencyIssues.length > 0) {
          recommendations.push('Review and update dependencies')
        }
      } catch (error) {
        this.addLog(sessionId, 'error', 'Dependency analysis failed', {}, error as Error)
        issues.push({
          type: 'dependency',
          severity: 'medium',
          message: `Dependency analysis failed: ${(error as Error).message}`,
          suggestion: 'Check dependency configuration'
        })
      }

      // 4. Performance Analysis
      this.addLog(sessionId, 'info', 'Analyzing performance')
      const performanceIssues = this.analyzePerformance(artifact)
      issues.push(...performanceIssues)

      if (performanceIssues.length > 0) {
        recommendations.push('Optimize component performance')
      }

      // Determine overall status
      const criticalIssues = issues.filter((i) => i.severity === 'critical')
      const highIssues = issues.filter((i) => i.severity === 'high')

      let status: 'healthy' | 'warning' | 'error'
      if (criticalIssues.length > 0) {
        status = 'error'
      } else if (highIssues.length > 0 || issues.length > 5) {
        status = 'warning'
      } else {
        status = 'healthy'
      }

      const session = this.sessions.get(sessionId)!
      const result: DiagnosticResult = {
        artifactId,
        status,
        issues,
        recommendations,
        metrics: session.metrics,
        timestamp: Date.now()
      }

      this.addLog(sessionId, 'info', `Diagnostics completed with status: ${status}`)
      await this.endDebugSession(sessionId)

      return result
    } catch (error) {
      this.addLog(sessionId, 'error', 'Diagnostics failed', {}, error as Error)
      await this.endDebugSession(sessionId, 'error')
      throw error
    }
  }

  /**
   * Profile performance of artifact processing
   */
  public async profilePerformance(artifactId: string): Promise<PerformanceProfile> {
    const sessionId = await this.startDebugSession(artifactId)

    try {
      this.addLog(sessionId, 'info', 'Starting performance profiling')

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        throw new Error(`Artifact ${artifactId} not found`)
      }

      const phases = {
        parsing: 0,
        compilation: 0,
        validation: 0,
        rendering: 0,
        total: 0
      }

      const memoryPeaks: number[] = []
      const bottlenecks: string[] = []
      const optimizations: string[] = []

      const totalStart = performance.now()

      // Parsing phase
      const parseStart = performance.now()
      // Simulate parsing (in real implementation, this would parse the AST)
      await new Promise((resolve) => setTimeout(resolve, 10))
      phases.parsing = performance.now() - parseStart
      memoryPeaks.push(this.getMemoryUsage())

      // Compilation phase
      const compileStart = performance.now()
      try {
        await this.compiler.compileArtifact(artifact)
        phases.compilation = performance.now() - compileStart
        memoryPeaks.push(this.getMemoryUsage())

        if (phases.compilation > 1000) {
          bottlenecks.push('Slow compilation detected')
          optimizations.push('Consider simplifying component structure')
        }
      } catch (error) {
        phases.compilation = performance.now() - compileStart
        bottlenecks.push('Compilation failed')
      }

      // Validation phase
      const validateStart = performance.now()
      try {
        await this.securityValidator.validateArtifact(artifact)
        phases.validation = performance.now() - validateStart
        memoryPeaks.push(this.getMemoryUsage())

        if (phases.validation > 500) {
          bottlenecks.push('Slow security validation')
          optimizations.push('Reduce code complexity for faster validation')
        }
      } catch (error) {
        phases.validation = performance.now() - validateStart
        bottlenecks.push('Validation failed')
      }

      // Rendering phase (simulated)
      const renderStart = performance.now()
      await new Promise((resolve) => setTimeout(resolve, 50)) // Simulate rendering
      phases.rendering = performance.now() - renderStart
      memoryPeaks.push(this.getMemoryUsage())

      phases.total = performance.now() - totalStart

      // Analyze for optimizations
      if (artifact.code.length > 10000) {
        optimizations.push('Consider breaking down large component into smaller ones')
      }

      if (artifact.metadata.dependencies.length > 3) {
        optimizations.push('Review dependency usage - fewer dependencies improve performance')
      }

      const profile: PerformanceProfile = {
        artifactId,
        phases,
        memoryPeaks,
        bottlenecks,
        optimizations
      }

      this.addLog(sessionId, 'info', 'Performance profiling completed', { profile })
      await this.endDebugSession(sessionId)

      return profile
    } catch (error) {
      this.addLog(sessionId, 'error', 'Performance profiling failed', {}, error as Error)
      await this.endDebugSession(sessionId, 'error')
      throw error
    }
  }

  /**
   * Get debug session information
   */
  public getDebugSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all active debug sessions
   */
  public getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active')
  }

  /**
   * Export debug logs for external analysis
   */
  public exportDebugLogs(sessionId: string): string {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Debug session ${sessionId} not found`)
    }

    const logData = {
      sessionId: session.id,
      artifactId: session.artifactId,
      startTime: new Date(session.startTime).toISOString(),
      duration: Date.now() - session.startTime,
      status: session.status,
      metrics: session.metrics,
      logs: session.logs.map((log) => ({
        timestamp: new Date(log.timestamp).toISOString(),
        level: log.level,
        message: log.message,
        context: log.context,
        stackTrace: log.stackTrace
      }))
    }

    return JSON.stringify(logData, null, 2)
  }

  /**
   * Clear old debug sessions
   */
  public clearOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < cutoff) {
        this.sessions.delete(sessionId)
      }
    }

    this.logger.info('Cleared old debug sessions', {
      remaining: this.sessions.size
    })
  }

  /**
   * End a debug session
   */
  private async endDebugSession(sessionId: string, status: 'completed' | 'error' = 'completed'): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.status = status
      this.addLog(sessionId, 'info', `Debug session ended with status: ${status}`)
    }
  }

  /**
   * Update session metrics
   */
  private updateMetrics(sessionId: string, updates: Partial<DebugMetrics>): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      Object.assign(session.metrics, updates)
    }
  }

  /**
   * Analyze dependencies for issues
   */
  private async analyzeDependencies(artifact: ReactArtifact): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []

    try {
      const allowedDeps = ['react', 'react-dom', 'styled-components', 'lodash', 'dayjs', 'uuid']
      const artifactDeps = artifact.metadata.dependencies

      // Check for disallowed dependencies
      const disallowed = artifactDeps.filter((dep) => !allowedDeps.includes(dep))
      disallowed.forEach((dep) => {
        issues.push({
          type: 'dependency',
          severity: 'high',
          message: `Disallowed dependency: ${dep}`,
          suggestion: `Remove ${dep} or use an allowed alternative`
        })
      })

      // Check for unused dependencies
      const usedDeps = this.extractUsedDependencies(artifact.code)
      const unused = artifactDeps.filter((dep) => !usedDeps.includes(dep))
      unused.forEach((dep) => {
        issues.push({
          type: 'dependency',
          severity: 'low',
          message: `Unused dependency: ${dep}`,
          suggestion: `Remove ${dep} from dependencies if not needed`
        })
      })

      // Check for missing dependencies
      const missing = usedDeps.filter((dep) => !artifactDeps.includes(dep))
      missing.forEach((dep) => {
        issues.push({
          type: 'dependency',
          severity: 'medium',
          message: `Missing dependency: ${dep}`,
          suggestion: `Add ${dep} to dependencies`
        })
      })
    } catch (error) {
      issues.push({
        type: 'dependency',
        severity: 'medium',
        message: `Dependency analysis error: ${(error as Error).message}`,
        suggestion: 'Review dependency configuration'
      })
    }

    return issues
  }

  /**
   * Analyze performance characteristics
   */
  private analyzePerformance(artifact: ReactArtifact): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = []
    const code = artifact.code

    // Check for performance anti-patterns
    if (code.includes('useEffect(() => {') && !code.includes('}, [')) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'useEffect without dependency array detected',
        suggestion: 'Add dependency array to useEffect to prevent unnecessary re-renders'
      })
    }

    const mapMatches = code.match(/\.map\(/g)
    if (mapMatches && mapMatches.length > 3) {
      issues.push({
        type: 'performance',
        severity: 'low',
        message: 'Multiple map operations detected',
        suggestion: 'Consider combining map operations or using useMemo for expensive calculations'
      })
    }

    if (code.includes('new Date()') && !code.includes('useMemo')) {
      issues.push({
        type: 'performance',
        severity: 'low',
        message: 'Date creation in render detected',
        suggestion: 'Use useMemo for date calculations to avoid recreation on every render'
      })
    }

    if (code.length > 15000) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'Large component detected',
        suggestion: 'Consider breaking down into smaller components for better performance'
      })
    }

    return issues
  }

  /**
   * Extract dependencies used in code
   */
  private extractUsedDependencies(code: string): string[] {
    const deps: string[] = []

    // Extract from import statements
    const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g)
    if (importMatches) {
      importMatches.forEach((match) => {
        const depMatch = match.match(/from\s+['"]([^'"]+)['"]/)
        if (depMatch) {
          const dep = depMatch[1]
          if (!dep.startsWith('.') && !dep.startsWith('/')) {
            deps.push(dep)
          }
        }
      })
    }

    return [...new Set(deps)]
  }

  /**
   * Get compilation suggestion based on error message
   */
  private getCompilationSuggestion(errorMessage: string): string {
    if (errorMessage.includes('Cannot find module')) {
      return 'Check if the module is installed and properly imported'
    }
    if (errorMessage.includes('Type')) {
      return 'Check TypeScript type definitions and interfaces'
    }
    if (errorMessage.includes('Syntax error')) {
      return 'Check code syntax for missing brackets, semicolons, or quotes'
    }
    return 'Review the error message and fix the compilation issue'
  }

  /**
   * Get security suggestion based on violation
   */
  private getSecuritySuggestion(violation: SecurityViolation): string {
    const violationType = violation.type.toString()

    if (violationType.includes('dangerous_function')) {
      return 'Remove or replace dangerous functions with safe alternatives'
    }
    if (violationType.includes('eval_usage')) {
      return 'Replace eval() with safe JSON parsing or other alternatives'
    }
    if (violationType.includes('unsafe_html')) {
      return 'Use safe rendering methods instead of dangerouslySetInnerHTML'
    }
    if (violationType.includes('network_request')) {
      return 'Remove network requests - they are not allowed in artifacts'
    }
    if (violationType.includes('xss_vector')) {
      return 'Sanitize user inputs and avoid direct HTML injection'
    }
    return 'Review and fix the security issue'
  }

  /**
   * Get current memory usage (simplified)
   */
  private getMemoryUsage(): number {
    // In a real implementation, this would use performance.memory or similar
    return Math.random() * 100 // Simulated memory usage in MB
  }
}
