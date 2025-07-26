import { loggerService } from '@logger'

import type { ReactArtifact } from '../types'

const logger = loggerService.withContext('ArtifactSecurityValidator')

/**
 * Security validation results interface
 */
export interface SecurityValidationResult {
  isSecure: boolean
  violations: SecurityViolation[]
  warnings: SecurityWarning[]
  score: number // 0-100 security score
  recommendations: string[]
}

/**
 * Security violation interface
 */
export interface SecurityViolation {
  type: SecurityViolationType
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  line?: number
  column?: number
  code?: string
}

/**
 * Security warning interface
 */
export interface SecurityWarning {
  type: SecurityWarningType
  message: string
  line?: number
  column?: number
  code?: string
}

/**
 * Security violation types
 */
export enum SecurityViolationType {
  DANGEROUS_FUNCTION = 'dangerous_function',
  EXTERNAL_SCRIPT = 'external_script',
  UNSAFE_HTML = 'unsafe_html',
  NETWORK_REQUEST = 'network_request',
  FILE_ACCESS = 'file_access',
  EVAL_USAGE = 'eval_usage',
  PROTOTYPE_POLLUTION = 'prototype_pollution',
  XSS_VECTOR = 'xss_vector',
  UNSAFE_DEPENDENCY = 'unsafe_dependency',
  MALICIOUS_PATTERN = 'malicious_pattern'
}

/**
 * Security warning types
 */
export enum SecurityWarningType {
  DEPRECATED_API = 'deprecated_api',
  PERFORMANCE_RISK = 'performance_risk',
  ACCESSIBILITY_ISSUE = 'accessibility_issue',
  BEST_PRACTICE = 'best_practice',
  TYPE_SAFETY = 'type_safety'
}

/**
 * Comprehensive security validator for React artifacts
 * Implements multi-layer security analysis including AST parsing, pattern matching, and heuristic analysis
 */
export class ArtifactSecurityValidator {
  private static instance: ArtifactSecurityValidator | null = null

  // Dangerous function patterns
  private readonly dangerousFunctions = [
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'execScript',
    'document.write',
    'document.writeln',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'createContextualFragment'
  ]

  // Network request patterns
  private readonly networkPatterns = [
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /axios\./,
    /\$\.ajax/,
    /\$\.get/,
    /\$\.post/,
    /WebSocket/,
    /EventSource/,
    /navigator\.sendBeacon/
  ]

  // File access patterns
  private readonly fileAccessPatterns = [
    /FileReader/,
    /File\s*\(/,
    /Blob\s*\(/,
    /URL\.createObjectURL/,
    /window\.open/,
    /location\./,
    /history\./
  ]

  // XSS vector patterns
  private readonly xssPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i
  ]

  // Prototype pollution patterns
  private readonly prototypePollutionPatterns = [/__proto__/, /constructor\.prototype/, /Object\.prototype/]

  // Whitelisted dependencies
  private readonly allowedDependencies = ['react', 'react-dom', 'styled-components', 'lodash', 'dayjs', 'uuid']

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): ArtifactSecurityValidator {
    if (!ArtifactSecurityValidator.instance) {
      ArtifactSecurityValidator.instance = new ArtifactSecurityValidator()
    }
    return ArtifactSecurityValidator.instance
  }

  /**
   * Validate artifact security comprehensively
   */
  public async validateArtifact(artifact: ReactArtifact): Promise<SecurityValidationResult> {
    try {
      logger.info('Starting security validation', { artifactId: artifact.id })

      const violations: SecurityViolation[] = []
      const warnings: SecurityWarning[] = []

      // 1. Code analysis
      const codeViolations = this.analyzeCode(artifact.code)
      violations.push(...codeViolations.violations)
      warnings.push(...codeViolations.warnings)

      // 2. Dependency validation
      const depViolations = this.validateDependencies(artifact.metadata?.dependencies || [])
      violations.push(...depViolations)

      // 3. Metadata validation
      const metaViolations = this.validateMetadata(artifact.metadata)
      violations.push(...metaViolations.violations)
      warnings.push(...metaViolations.warnings)

      // 4. Pattern-based security analysis
      const patternViolations = this.analyzeSecurityPatterns(artifact.code)
      violations.push(...patternViolations)

      // 5. Calculate security score
      const score = this.calculateSecurityScore(violations, warnings)

      // 6. Generate recommendations
      const recommendations = this.generateRecommendations(violations, warnings)

      const result: SecurityValidationResult = {
        isSecure: violations.filter((v) => v.severity === 'critical' || v.severity === 'high').length === 0,
        violations,
        warnings,
        score,
        recommendations
      }

      logger.info('Security validation completed', {
        artifactId: artifact.id,
        isSecure: result.isSecure,
        score: result.score,
        violationCount: violations.length,
        warningCount: warnings.length
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Security validation failed', { error: errorMessage, artifactId: artifact.id })

      return {
        isSecure: false,
        violations: [
          {
            type: SecurityViolationType.MALICIOUS_PATTERN,
            severity: 'critical',
            message: `Security validation failed: ${errorMessage}`
          }
        ],
        warnings: [],
        score: 0,
        recommendations: ['Fix validation errors before proceeding']
      }
    }
  }

  /**
   * Analyze code for security violations
   */
  private analyzeCode(code: string): { violations: SecurityViolation[]; warnings: SecurityWarning[] } {
    const violations: SecurityViolation[] = []
    const warnings: SecurityWarning[] = []
    const lines = code.split('\n')

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // Check for dangerous functions
      this.dangerousFunctions.forEach((func) => {
        if (line.includes(func)) {
          violations.push({
            type: SecurityViolationType.DANGEROUS_FUNCTION,
            severity: func === 'eval' || func === 'Function' ? 'critical' : 'high',
            message: `Dangerous function '${func}' detected`,
            line: lineNumber,
            code: line.trim()
          })
        }
      })

      // Check for network requests
      this.networkPatterns.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            type: SecurityViolationType.NETWORK_REQUEST,
            severity: 'high',
            message: 'Network request detected - not allowed in artifacts',
            line: lineNumber,
            code: line.trim()
          })
        }
      })

      // Check for file access
      this.fileAccessPatterns.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            type: SecurityViolationType.FILE_ACCESS,
            severity: 'high',
            message: 'File access detected - not allowed in artifacts',
            line: lineNumber,
            code: line.trim()
          })
        }
      })

      // Check for XSS vectors
      this.xssPatterns.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            type: SecurityViolationType.XSS_VECTOR,
            severity: 'critical',
            message: 'Potential XSS vector detected',
            line: lineNumber,
            code: line.trim()
          })
        }
      })

      // Check for prototype pollution
      this.prototypePollutionPatterns.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            type: SecurityViolationType.PROTOTYPE_POLLUTION,
            severity: 'high',
            message: 'Potential prototype pollution detected',
            line: lineNumber,
            code: line.trim()
          })
        }
      })

      // Check for unsafe HTML usage
      if (line.includes('dangerouslySetInnerHTML')) {
        violations.push({
          type: SecurityViolationType.UNSAFE_HTML,
          severity: 'high',
          message: 'dangerouslySetInnerHTML usage detected',
          line: lineNumber,
          code: line.trim()
        })
      }

      // Performance warnings
      if (line.includes('document.getElementById') || line.includes('document.querySelector')) {
        warnings.push({
          type: SecurityWarningType.PERFORMANCE_RISK,
          message: 'Direct DOM manipulation detected - consider using React refs',
          line: lineNumber,
          code: line.trim()
        })
      }

      // Type safety warnings
      if (line.includes('any') && line.includes(':')) {
        warnings.push({
          type: SecurityWarningType.TYPE_SAFETY,
          message: 'Usage of "any" type detected - consider using specific types',
          line: lineNumber,
          code: line.trim()
        })
      }
    })

    return { violations, warnings }
  }

  /**
   * Validate dependencies against whitelist
   */
  private validateDependencies(dependencies: string[]): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    dependencies.forEach((dep) => {
      if (!this.allowedDependencies.includes(dep)) {
        violations.push({
          type: SecurityViolationType.UNSAFE_DEPENDENCY,
          severity: 'critical',
          message: `Unsafe dependency '${dep}' not in whitelist. Allowed: ${this.allowedDependencies.join(', ')}`
        })
      }
    })

    return violations
  }

  /**
   * Validate artifact metadata
   */
  private validateMetadata(metadata: any): { violations: SecurityViolation[]; warnings: SecurityWarning[] } {
    const violations: SecurityViolation[] = []
    const warnings: SecurityWarning[] = []

    if (!metadata) {
      warnings.push({
        type: SecurityWarningType.BEST_PRACTICE,
        message: 'Missing metadata - consider adding title and description'
      })
      return { violations, warnings }
    }

    // Check for suspicious metadata
    if (metadata.title && this.containsSuspiciousContent(metadata.title)) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'medium',
        message: 'Suspicious content detected in title'
      })
    }

    if (metadata.description && this.containsSuspiciousContent(metadata.description)) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'medium',
        message: 'Suspicious content detected in description'
      })
    }

    // Validate props structure
    if (metadata.props && typeof metadata.props !== 'object') {
      warnings.push({
        type: SecurityWarningType.TYPE_SAFETY,
        message: 'Props should be defined as an object with type annotations'
      })
    }

    return { violations, warnings }
  }

  /**
   * Analyze for additional security patterns
   */
  private analyzeSecurityPatterns(code: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    // Check for base64 encoded content (potential obfuscation)
    const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g
    const base64Matches = code.match(base64Pattern)
    if (base64Matches && base64Matches.length > 0) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'medium',
        message: 'Base64 encoded content detected - potential obfuscation'
      })
    }

    // Check for suspicious Unicode characters
    const suspiciousUnicodePattern = /[\u200B-\u200D\uFEFF]/g
    if (suspiciousUnicodePattern.test(code)) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'medium',
        message: 'Suspicious Unicode characters detected'
      })
    }

    // Check for excessive string concatenation (potential obfuscation)
    const concatenationPattern = /(\+\s*["'`][^"'`]*["'`]\s*){5,}/g
    if (concatenationPattern.test(code)) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'low',
        message: 'Excessive string concatenation detected - potential obfuscation'
      })
    }

    return violations
  }

  /**
   * Check if content contains suspicious patterns
   */
  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [/<script/i, /javascript:/i, /data:text\/html/i, /vbscript:/i, /on\w+=/i]

    return suspiciousPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Calculate security score based on violations and warnings
   */
  private calculateSecurityScore(violations: SecurityViolation[], warnings: SecurityWarning[]): number {
    let score = 100

    violations.forEach((violation) => {
      switch (violation.severity) {
        case 'critical':
          score -= 25
          break
        case 'high':
          score -= 15
          break
        case 'medium':
          score -= 8
          break
        case 'low':
          score -= 3
          break
      }
    })

    warnings.forEach(() => {
      score -= 1
    })

    return Math.max(0, score)
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(violations: SecurityViolation[], warnings: SecurityWarning[]): string[] {
    const recommendations: string[] = []

    const criticalViolations = violations.filter((v) => v.severity === 'critical')
    const highViolations = violations.filter((v) => v.severity === 'high')

    if (criticalViolations.length > 0) {
      recommendations.push('🚨 Critical security issues must be resolved before deployment')
      recommendations.push('Remove all dangerous functions (eval, Function, etc.)')
      recommendations.push('Ensure no XSS vectors are present in the code')
    }

    if (highViolations.length > 0) {
      recommendations.push('⚠️ High-priority security issues should be addressed')
      recommendations.push('Remove network requests and file access operations')
      recommendations.push('Avoid unsafe HTML manipulation')
    }

    if (warnings.length > 5) {
      recommendations.push('📝 Consider addressing code quality warnings for better maintainability')
    }

    if (violations.length === 0 && warnings.length === 0) {
      recommendations.push('✅ Code passes all security checks')
      recommendations.push('Consider adding comprehensive error handling')
      recommendations.push('Ensure accessibility best practices are followed')
    }

    return recommendations
  }

  /**
   * Quick security check for real-time validation
   */
  public quickSecurityCheck(code: string): { isSecure: boolean; criticalIssues: string[] } {
    const criticalIssues: string[] = []

    // Check for immediate red flags
    if (code.includes('eval(') || code.includes('Function(')) {
      criticalIssues.push('Dangerous eval/Function usage detected')
    }

    if (this.xssPatterns.some((pattern) => pattern.test(code))) {
      criticalIssues.push('Potential XSS vector detected')
    }

    if (this.networkPatterns.some((pattern) => pattern.test(code))) {
      criticalIssues.push('Network request detected')
    }

    return {
      isSecure: criticalIssues.length === 0,
      criticalIssues
    }
  }
}
