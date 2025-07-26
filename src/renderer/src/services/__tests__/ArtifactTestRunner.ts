import { loggerService } from '@logger'

import type { ReactArtifact } from '../../types'
import { ArtifactSecurityAuditor, SecurityAuditResult } from '../ArtifactSecurityAuditor'
import { ArtifactSecurityValidator } from '../ArtifactSecurityValidator'
import { ArtifactTestSuite, TestSuiteResult } from './ArtifactTestSuite'

const logger = loggerService.withContext('ArtifactTestRunner')

/**
 * Comprehensive test execution result
 */
export interface ComprehensiveTestResult {
  testSuiteResult: TestSuiteResult
  securityAuditResult: SecurityAuditResult
  overallStatus: 'passed' | 'failed' | 'warning'
  summary: TestExecutionSummary
  recommendations: string[]
  timestamp: string
}

/**
 * Test execution summary
 */
export interface TestExecutionSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  securityScore: number
  complianceScore: number
  overallRisk: string
  readyForProduction: boolean
}

/**
 * Test configuration options
 */
export interface TestConfiguration {
  includePerformanceTests: boolean
  includeSecurityAudit: boolean
  includeComplianceCheck: boolean
  maxExecutionTime: number
  failOnSecurityIssues: boolean
  failOnPerformanceIssues: boolean
}

/**
 * Comprehensive test runner for React artifacts
 * Orchestrates all testing and security validation processes
 */
export class ArtifactTestRunner {
  private static instance: ArtifactTestRunner | null = null
  private testSuite: ArtifactTestSuite
  private securityAuditor: ArtifactSecurityAuditor
  private securityValidator: ArtifactSecurityValidator

  private constructor() {
    this.testSuite = ArtifactTestSuite.getInstance()
    this.securityAuditor = ArtifactSecurityAuditor.getInstance()
    this.securityValidator = ArtifactSecurityValidator.getInstance()
  }

  public static getInstance(): ArtifactTestRunner {
    if (!ArtifactTestRunner.instance) {
      ArtifactTestRunner.instance = new ArtifactTestRunner()
    }
    return ArtifactTestRunner.instance
  }

  /**
   * Run comprehensive testing and security validation
   */
  public async runComprehensiveTests(
    artifact: ReactArtifact,
    config: Partial<TestConfiguration> = {}
  ): Promise<ComprehensiveTestResult> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    const defaultConfig: TestConfiguration = {
      includePerformanceTests: true,
      includeSecurityAudit: true,
      includeComplianceCheck: true,
      maxExecutionTime: 300000, // 5 minutes
      failOnSecurityIssues: true,
      failOnPerformanceIssues: false
    }

    const finalConfig = { ...defaultConfig, ...config }

    logger.info('Starting comprehensive test execution', {
      artifactId: artifact.id,
      config: finalConfig
    })

    try {
      // Set execution timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Test execution timeout after ${finalConfig.maxExecutionTime}ms`))
        }, finalConfig.maxExecutionTime)
      })

      // Run tests with timeout
      const testPromise = this.executeTests(artifact, finalConfig)
      const result = await Promise.race([testPromise, timeoutPromise])

      const duration = Date.now() - startTime
      logger.info('Comprehensive test execution completed', {
        artifactId: artifact.id,
        duration,
        overallStatus: result.overallStatus
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Comprehensive test execution failed', {
        error: errorMessage,
        artifactId: artifact.id
      })

      // Return failure result
      return {
        testSuiteResult: {
          suiteName: 'Failed Test Suite',
          totalTests: 0,
          passedTests: 0,
          failedTests: 1,
          duration: Date.now() - startTime,
          results: [],
          coverage: {
            security: 0,
            compilation: 0,
            storage: 0,
            versioning: 0,
            sandbox: 0,
            overall: 0
          }
        },
        securityAuditResult: {
          auditId: 'failed-audit',
          timestamp,
          artifactId: artifact.id,
          overallRisk: 'critical' as any,
          findings: [],
          recommendations: [],
          complianceScore: 0,
          summary: {
            totalFindings: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
            complianceStatus: 'non-compliant',
            riskScore: 100,
            securityPosture: 'critical'
          }
        },
        overallStatus: 'failed',
        summary: {
          totalTests: 0,
          passedTests: 0,
          failedTests: 1,
          securityScore: 0,
          complianceScore: 0,
          overallRisk: 'critical',
          readyForProduction: false
        },
        recommendations: [`Fix test execution error: ${errorMessage}`],
        timestamp
      }
    }
  }

  /**
   * Execute all tests and audits
   */
  private async executeTests(artifact: ReactArtifact, config: TestConfiguration): Promise<ComprehensiveTestResult> {
    const timestamp = new Date().toISOString()

    // 1. Run functional test suite
    logger.info('Running functional test suite')
    const testSuiteResult = await this.testSuite.runFullTestSuite()

    // 2. Run security audit if enabled
    let securityAuditResult: SecurityAuditResult
    if (config.includeSecurityAudit) {
      logger.info('Running security audit')
      securityAuditResult = await this.securityAuditor.performSecurityAudit(artifact)
    } else {
      // Create minimal security result
      const quickValidation = await this.securityValidator.validateArtifact(artifact)
      securityAuditResult = {
        auditId: 'quick-validation',
        timestamp,
        artifactId: artifact.id,
        overallRisk: quickValidation.isSecure ? 'minimal' : 'high',
        findings: [],
        recommendations: [],
        complianceScore: quickValidation.score,
        summary: {
          totalFindings: quickValidation.violations.length,
          criticalFindings: quickValidation.violations.filter((v) => v.severity === 'critical').length,
          highFindings: quickValidation.violations.filter((v) => v.severity === 'high').length,
          mediumFindings: quickValidation.violations.filter((v) => v.severity === 'medium').length,
          lowFindings: quickValidation.violations.filter((v) => v.severity === 'low').length,
          complianceStatus: quickValidation.score >= 80 ? 'compliant' : 'non-compliant',
          riskScore: 100 - quickValidation.score,
          securityPosture: quickValidation.score >= 90 ? 'excellent' : 'good'
        }
      } as SecurityAuditResult
    }

    // 3. Determine overall status
    const overallStatus = this.determineOverallStatus(testSuiteResult, securityAuditResult, config)

    // 4. Generate summary
    const summary = this.generateExecutionSummary(testSuiteResult, securityAuditResult)

    // 5. Generate recommendations
    const recommendations = this.generateRecommendations(testSuiteResult, securityAuditResult, overallStatus)

    return {
      testSuiteResult,
      securityAuditResult,
      overallStatus,
      summary,
      recommendations,
      timestamp
    }
  }

  /**
   * Determine overall test status
   */
  private determineOverallStatus(
    testResult: TestSuiteResult,
    securityResult: SecurityAuditResult,
    config: TestConfiguration
  ): 'passed' | 'failed' | 'warning' {
    // Check for critical failures
    if (testResult.failedTests > 0) {
      const criticalFailures = testResult.results.filter(
        (r) => !r.passed && (r.testName.includes('Security:') || r.testName.includes('Compilation:'))
      )
      if (criticalFailures.length > 0) {
        return 'failed'
      }
    }

    // Check security issues
    if (config.failOnSecurityIssues) {
      if (securityResult.summary.criticalFindings > 0 || securityResult.summary.highFindings > 2) {
        return 'failed'
      }
    }

    // Check performance issues
    if (config.failOnPerformanceIssues) {
      const performanceFailures = testResult.results.filter((r) => !r.passed && r.testName.includes('Performance:'))
      if (performanceFailures.length > 0) {
        return 'failed'
      }
    }

    // Check for warnings
    if (testResult.failedTests > 0 || securityResult.summary.highFindings > 0 || securityResult.complianceScore < 80) {
      return 'warning'
    }

    return 'passed'
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(
    testResult: TestSuiteResult,
    securityResult: SecurityAuditResult
  ): TestExecutionSummary {
    const readyForProduction =
      testResult.passedTests === testResult.totalTests &&
      securityResult.summary.criticalFindings === 0 &&
      securityResult.summary.highFindings <= 1 &&
      securityResult.complianceScore >= 80

    return {
      totalTests: testResult.totalTests,
      passedTests: testResult.passedTests,
      failedTests: testResult.failedTests,
      securityScore: securityResult.complianceScore,
      complianceScore: securityResult.complianceScore,
      overallRisk: securityResult.overallRisk,
      readyForProduction
    }
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    testResult: TestSuiteResult,
    securityResult: SecurityAuditResult,
    overallStatus: 'passed' | 'failed' | 'warning'
  ): string[] {
    const recommendations: string[] = []

    // Test-based recommendations
    if (testResult.failedTests > 0) {
      recommendations.push(`Fix ${testResult.failedTests} failing tests before deployment`)

      const securityFailures = testResult.results.filter((r) => !r.passed && r.testName.includes('Security:'))
      if (securityFailures.length > 0) {
        recommendations.push('Address security test failures immediately - these are critical')
      }

      const compilationFailures = testResult.results.filter((r) => !r.passed && r.testName.includes('Compilation:'))
      if (compilationFailures.length > 0) {
        recommendations.push('Fix compilation errors - artifact cannot be deployed')
      }
    }

    // Security-based recommendations
    if (securityResult.summary.criticalFindings > 0) {
      recommendations.push(`🚨 CRITICAL: Address ${securityResult.summary.criticalFindings} critical security findings`)
    }

    if (securityResult.summary.highFindings > 0) {
      recommendations.push(
        `⚠️ HIGH: Review and fix ${securityResult.summary.highFindings} high-severity security issues`
      )
    }

    if (securityResult.complianceScore < 80) {
      recommendations.push(`Improve compliance score from ${securityResult.complianceScore}% to at least 80%`)
    }

    // Coverage-based recommendations
    if (testResult.coverage.overall < 90) {
      recommendations.push(`Improve test coverage from ${testResult.coverage.overall.toFixed(1)}% to 90%+`)
    }

    // Status-based recommendations
    switch (overallStatus) {
      case 'failed':
        recommendations.push('❌ Artifact is NOT ready for production deployment')
        recommendations.push('Focus on fixing critical issues before proceeding')
        break
      case 'warning':
        recommendations.push('⚠️ Artifact has warnings - review before production deployment')
        recommendations.push('Consider addressing warnings to improve security posture')
        break
      case 'passed':
        recommendations.push('✅ Artifact passes all tests and security checks')
        recommendations.push('Ready for production deployment with current configuration')
        break
    }

    // Add security-specific recommendations
    recommendations.push(...securityResult.recommendations.map((r) => `Security: ${r.title}`))

    return recommendations
  }

  /**
   * Quick validation for development workflow
   */
  public async quickValidation(artifact: ReactArtifact): Promise<{
    isValid: boolean
    criticalIssues: string[]
    warnings: string[]
  }> {
    try {
      logger.info('Running quick validation', { artifactId: artifact.id })

      // Quick security check
      const securityCheck = this.securityValidator.quickSecurityCheck(artifact.code)

      // Basic validation
      const criticalIssues: string[] = []
      const warnings: string[] = []

      if (!securityCheck.isSecure) {
        criticalIssues.push(...securityCheck.criticalIssues)
      }

      // Check for basic code structure
      if (!artifact.code.trim()) {
        criticalIssues.push('Empty code - no component defined')
      }

      if (!artifact.code.includes('export')) {
        warnings.push('No export statement found - component may not be usable')
      }

      if (!artifact.metadata?.dependencies?.includes('react')) {
        warnings.push('React not listed in dependencies')
      }

      const isValid = criticalIssues.length === 0

      logger.info('Quick validation completed', {
        artifactId: artifact.id,
        isValid,
        criticalIssues: criticalIssues.length,
        warnings: warnings.length
      })

      return {
        isValid,
        criticalIssues,
        warnings
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Quick validation failed', { error: errorMessage, artifactId: artifact.id })

      return {
        isValid: false,
        criticalIssues: [`Validation error: ${errorMessage}`],
        warnings: []
      }
    }
  }

  /**
   * Generate test report for UI display
   */
  public generateTestReport(result: ComprehensiveTestResult): string {
    const { testSuiteResult, securityAuditResult, overallStatus, summary } = result

    const statusEmoji = {
      passed: '✅',
      warning: '⚠️',
      failed: '❌'
    }

    return `
# Artifact Test Report

## Overall Status: ${statusEmoji[overallStatus]} ${overallStatus.toUpperCase()}

### Summary
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passedTests}
- **Failed**: ${summary.failedTests}
- **Security Score**: ${summary.securityScore}%
- **Compliance Score**: ${summary.complianceScore}%
- **Overall Risk**: ${summary.overallRisk}
- **Production Ready**: ${summary.readyForProduction ? '✅ Yes' : '❌ No'}

### Test Coverage
- **Security**: ${testSuiteResult.coverage.security.toFixed(1)}%
- **Compilation**: ${testSuiteResult.coverage.compilation.toFixed(1)}%
- **Storage**: ${testSuiteResult.coverage.storage.toFixed(1)}%
- **Versioning**: ${testSuiteResult.coverage.versioning.toFixed(1)}%
- **Sandbox**: ${testSuiteResult.coverage.sandbox.toFixed(1)}%
- **Overall**: ${testSuiteResult.coverage.overall.toFixed(1)}%

### Security Findings
- **Critical**: ${securityAuditResult.summary.criticalFindings}
- **High**: ${securityAuditResult.summary.highFindings}
- **Medium**: ${securityAuditResult.summary.mediumFindings}
- **Low**: ${securityAuditResult.summary.lowFindings}

### Recommendations
${result.recommendations.map((r) => `- ${r}`).join('\n')}

---
*Generated at: ${result.timestamp}*
    `.trim()
  }
}
