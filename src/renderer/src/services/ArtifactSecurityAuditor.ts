import { loggerService } from '@logger'

import type { ReactArtifact } from '../types'
import { ArtifactSecurityValidator, SecurityValidationResult } from './ArtifactSecurityValidator'

const logger = loggerService.withContext('ArtifactSecurityAuditor')

/**
 * Security audit result interface
 */
export interface SecurityAuditResult {
  auditId: string
  timestamp: string
  artifactId: string
  overallRisk: SecurityRiskLevel
  findings: SecurityFinding[]
  recommendations: SecurityRecommendation[]
  complianceScore: number
  summary: SecurityAuditSummary
}

/**
 * Security risk levels
 */
export enum SecurityRiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal'
}

/**
 * Security finding interface
 */
export interface SecurityFinding {
  id: string
  type: SecurityFindingType
  severity: SecurityRiskLevel
  title: string
  description: string
  location?: {
    line: number
    column: number
    code: string
  }
  impact: string
  remediation: string
  references: string[]
}

/**
 * Security finding types
 */
export enum SecurityFindingType {
  CODE_INJECTION = 'code_injection',
  XSS_VULNERABILITY = 'xss_vulnerability',
  UNSAFE_DEPENDENCY = 'unsafe_dependency',
  INSECURE_PATTERN = 'insecure_pattern',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXPOSURE = 'data_exposure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  COMPLIANCE_VIOLATION = 'compliance_violation'
}

/**
 * Security recommendation interface
 */
export interface SecurityRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  implementation: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

/**
 * Security audit summary
 */
export interface SecurityAuditSummary {
  totalFindings: number
  criticalFindings: number
  highFindings: number
  mediumFindings: number
  lowFindings: number
  complianceStatus: 'compliant' | 'non-compliant' | 'partial'
  riskScore: number
  securityPosture: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
}

/**
 * Comprehensive security auditor for React artifacts
 * Performs deep security analysis and compliance checking
 */
export class ArtifactSecurityAuditor {
  private static instance: ArtifactSecurityAuditor | null = null
  private validator: ArtifactSecurityValidator

  // Security patterns for advanced detection
  private readonly advancedThreatPatterns = {
    codeInjection: [
      /eval\s*\(/,
      /Function\s*\(/,
      /new\s+Function/,
      /setTimeout\s*\(\s*["'`][^"'`]*["'`]/,
      /setInterval\s*\(\s*["'`][^"'`]*["'`]/
    ],
    xssVectors: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript\s*:/i,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /data\s*:\s*text\/html/i,
      /vbscript\s*:/i
    ],
    privilegeEscalation: [
      /window\s*\.\s*parent/,
      /window\s*\.\s*top/,
      /document\s*\.\s*domain/,
      /location\s*\.\s*href\s*=/,
      /history\s*\.\s*pushState/
    ],
    dataExposure: [
      /localStorage/,
      /sessionStorage/,
      /document\s*\.\s*cookie/,
      /navigator\s*\.\s*userAgent/,
      /screen\s*\./
    ],
    denialOfService: [
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/,
      /setInterval\s*\(\s*[^,]+\s*,\s*0\s*\)/,
      /setTimeout\s*\(\s*[^,]+\s*,\s*0\s*\)/
    ]
  }

  // Compliance frameworks
  private readonly complianceFrameworks = {
    owasp: {
      name: 'OWASP Top 10',
      checks: [
        'injection_prevention',
        'authentication_security',
        'data_exposure_prevention',
        'xml_external_entities',
        'access_control',
        'security_misconfiguration',
        'xss_prevention',
        'insecure_deserialization',
        'vulnerable_components',
        'logging_monitoring'
      ]
    },
    nist: {
      name: 'NIST Cybersecurity Framework',
      checks: ['identify_assets', 'protect_data', 'detect_threats', 'respond_incidents', 'recover_operations']
    }
  }

  private constructor() {
    this.validator = ArtifactSecurityValidator.getInstance()
  }

  public static getInstance(): ArtifactSecurityAuditor {
    if (!ArtifactSecurityAuditor.instance) {
      ArtifactSecurityAuditor.instance = new ArtifactSecurityAuditor()
    }
    return ArtifactSecurityAuditor.instance
  }

  /**
   * Perform comprehensive security audit
   */
  public async performSecurityAudit(artifact: ReactArtifact): Promise<SecurityAuditResult> {
    const auditId = this.generateAuditId()
    const timestamp = new Date().toISOString()

    logger.info('Starting comprehensive security audit', {
      auditId,
      artifactId: artifact.id
    })

    try {
      // 1. Basic security validation
      const validationResult = await this.validator.validateArtifact(artifact)

      // 2. Advanced threat detection
      const threatFindings = await this.performThreatDetection(artifact)

      // 3. Compliance checking
      const complianceFindings = await this.performComplianceCheck(artifact)

      // 4. Dependency security analysis
      const dependencyFindings = await this.analyzeDependencySecurity(artifact)

      // 5. Code pattern analysis
      const patternFindings = await this.analyzeCodePatterns(artifact)

      // Combine all findings
      const allFindings = [...threatFindings, ...complianceFindings, ...dependencyFindings, ...patternFindings]

      // Calculate overall risk and compliance
      const overallRisk = this.calculateOverallRisk(allFindings)
      const complianceScore = this.calculateComplianceScore(allFindings, validationResult)
      const summary = this.generateAuditSummary(allFindings, complianceScore)

      // Generate recommendations
      const recommendations = this.generateSecurityRecommendations(allFindings, validationResult)

      const auditResult: SecurityAuditResult = {
        auditId,
        timestamp,
        artifactId: artifact.id,
        overallRisk,
        findings: allFindings,
        recommendations,
        complianceScore,
        summary
      }

      logger.info('Security audit completed', {
        auditId,
        artifactId: artifact.id,
        overallRisk,
        findingsCount: allFindings.length,
        complianceScore
      })

      return auditResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Security audit failed', { error: errorMessage, auditId, artifactId: artifact.id })

      return {
        auditId,
        timestamp,
        artifactId: artifact.id,
        overallRisk: SecurityRiskLevel.CRITICAL,
        findings: [
          {
            id: 'audit-error',
            type: SecurityFindingType.COMPLIANCE_VIOLATION,
            severity: SecurityRiskLevel.CRITICAL,
            title: 'Security Audit Failed',
            description: `Security audit could not be completed: ${errorMessage}`,
            impact: 'Unable to verify security posture',
            remediation: 'Fix audit errors and re-run security analysis',
            references: []
          }
        ],
        recommendations: [
          {
            id: 'fix-audit',
            priority: 'high',
            category: 'System',
            title: 'Fix Security Audit Process',
            description: 'Resolve issues preventing security audit completion',
            implementation: 'Debug and fix audit system errors',
            effort: 'medium',
            impact: 'high'
          }
        ],
        complianceScore: 0,
        summary: {
          totalFindings: 1,
          criticalFindings: 1,
          highFindings: 0,
          mediumFindings: 0,
          lowFindings: 0,
          complianceStatus: 'non-compliant',
          riskScore: 100,
          securityPosture: 'critical'
        }
      }
    }
  }

  /**
   * Perform advanced threat detection
   */
  private async performThreatDetection(artifact: ReactArtifact): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []
    const code = artifact.code
    const lines = code.split('\n')

    // Check for code injection threats
    lines.forEach((line, index) => {
      this.advancedThreatPatterns.codeInjection.forEach((pattern) => {
        if (pattern.test(line)) {
          findings.push({
            id: `code-injection-${index}`,
            type: SecurityFindingType.CODE_INJECTION,
            severity: SecurityRiskLevel.CRITICAL,
            title: 'Code Injection Vulnerability',
            description: 'Potential code injection vector detected',
            location: {
              line: index + 1,
              column: line.search(pattern),
              code: line.trim()
            },
            impact: 'Arbitrary code execution, complete system compromise',
            remediation: 'Remove dynamic code execution, use safe alternatives',
            references: [
              'https://owasp.org/www-community/attacks/Code_Injection',
              'https://cwe.mitre.org/data/definitions/94.html'
            ]
          })
        }
      })

      // Check for XSS vectors
      this.advancedThreatPatterns.xssVectors.forEach((pattern) => {
        if (pattern.test(line)) {
          findings.push({
            id: `xss-${index}`,
            type: SecurityFindingType.XSS_VULNERABILITY,
            severity: SecurityRiskLevel.HIGH,
            title: 'Cross-Site Scripting (XSS) Vector',
            description: 'Potential XSS vulnerability detected',
            location: {
              line: index + 1,
              column: line.search(pattern),
              code: line.trim()
            },
            impact: 'Session hijacking, data theft, malicious actions',
            remediation: 'Sanitize user input, use safe rendering methods',
            references: [
              'https://owasp.org/www-community/attacks/xss/',
              'https://cwe.mitre.org/data/definitions/79.html'
            ]
          })
        }
      })

      // Check for privilege escalation
      this.advancedThreatPatterns.privilegeEscalation.forEach((pattern) => {
        if (pattern.test(line)) {
          findings.push({
            id: `privilege-escalation-${index}`,
            type: SecurityFindingType.PRIVILEGE_ESCALATION,
            severity: SecurityRiskLevel.HIGH,
            title: 'Privilege Escalation Risk',
            description: 'Potential privilege escalation vector detected',
            location: {
              line: index + 1,
              column: line.search(pattern),
              code: line.trim()
            },
            impact: 'Sandbox escape, unauthorized access to parent context',
            remediation: 'Remove access to privileged objects, use secure APIs',
            references: ['https://cwe.mitre.org/data/definitions/269.html']
          })
        }
      })

      // Check for data exposure
      this.advancedThreatPatterns.dataExposure.forEach((pattern) => {
        if (pattern.test(line)) {
          findings.push({
            id: `data-exposure-${index}`,
            type: SecurityFindingType.DATA_EXPOSURE,
            severity: SecurityRiskLevel.MEDIUM,
            title: 'Sensitive Data Exposure',
            description: 'Potential sensitive data exposure detected',
            location: {
              line: index + 1,
              column: line.search(pattern),
              code: line.trim()
            },
            impact: 'Information disclosure, privacy violation',
            remediation: 'Avoid accessing sensitive browser APIs',
            references: [
              'https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url'
            ]
          })
        }
      })

      // Check for denial of service
      this.advancedThreatPatterns.denialOfService.forEach((pattern) => {
        if (pattern.test(line)) {
          findings.push({
            id: `dos-${index}`,
            type: SecurityFindingType.DENIAL_OF_SERVICE,
            severity: SecurityRiskLevel.MEDIUM,
            title: 'Denial of Service Risk',
            description: 'Potential denial of service vector detected',
            location: {
              line: index + 1,
              column: line.search(pattern),
              code: line.trim()
            },
            impact: 'Resource exhaustion, application unavailability',
            remediation: 'Implement proper loop controls and resource limits',
            references: ['https://cwe.mitre.org/data/definitions/400.html']
          })
        }
      })
    })

    return findings
  }

  /**
   * Perform compliance checking
   */
  private async performComplianceCheck(artifact: ReactArtifact): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []

    // OWASP compliance checks
    if (!this.hasInputValidation(artifact.code)) {
      findings.push({
        id: 'owasp-input-validation',
        type: SecurityFindingType.COMPLIANCE_VIOLATION,
        severity: SecurityRiskLevel.MEDIUM,
        title: 'OWASP: Missing Input Validation',
        description: 'Component lacks proper input validation mechanisms',
        impact: 'Increased risk of injection attacks',
        remediation: 'Implement comprehensive input validation',
        references: ['https://owasp.org/www-project-top-ten/2017/A1_2017-Injection']
      })
    }

    if (!this.hasErrorHandling(artifact.code)) {
      findings.push({
        id: 'owasp-error-handling',
        type: SecurityFindingType.COMPLIANCE_VIOLATION,
        severity: SecurityRiskLevel.LOW,
        title: 'OWASP: Insufficient Error Handling',
        description: 'Component lacks proper error handling',
        impact: 'Information disclosure through error messages',
        remediation: 'Implement comprehensive error handling',
        references: ['https://owasp.org/www-community/Improper_Error_Handling']
      })
    }

    return findings
  }

  /**
   * Analyze dependency security
   */
  private async analyzeDependencySecurity(artifact: ReactArtifact): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []
    const dependencies = artifact.metadata?.dependencies || []

    // Check for known vulnerable dependencies
    const vulnerableDependencies = ['lodash@<4.17.21', 'react@<16.14.0', 'styled-components@<5.3.1']

    dependencies.forEach((dep) => {
      vulnerableDependencies.forEach((vuln) => {
        if (dep.includes(vuln.split('@')[0])) {
          findings.push({
            id: `vulnerable-dependency-${dep}`,
            type: SecurityFindingType.UNSAFE_DEPENDENCY,
            severity: SecurityRiskLevel.HIGH,
            title: 'Vulnerable Dependency',
            description: `Dependency ${dep} may have known vulnerabilities`,
            impact: 'Potential security vulnerabilities in third-party code',
            remediation: 'Update to latest secure version',
            references: ['https://nvd.nist.gov/']
          })
        }
      })
    })

    return findings
  }

  /**
   * Analyze code patterns for security issues
   */
  private async analyzeCodePatterns(artifact: ReactArtifact): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []
    const code = artifact.code

    // Check for insecure patterns
    if (code.includes('dangerouslySetInnerHTML')) {
      findings.push({
        id: 'insecure-html',
        type: SecurityFindingType.INSECURE_PATTERN,
        severity: SecurityRiskLevel.HIGH,
        title: 'Insecure HTML Rendering',
        description: 'Use of dangerouslySetInnerHTML detected',
        impact: 'XSS vulnerability through unsanitized HTML',
        remediation: 'Use safe rendering methods or sanitize HTML content',
        references: ['https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml']
      })
    }

    if (code.includes('target="_blank"') && !code.includes('rel="noopener"')) {
      findings.push({
        id: 'tabnabbing',
        type: SecurityFindingType.INSECURE_PATTERN,
        severity: SecurityRiskLevel.MEDIUM,
        title: 'Tabnabbing Vulnerability',
        description: 'Links with target="_blank" missing rel="noopener"',
        impact: 'Potential tabnabbing attack',
        remediation: 'Add rel="noopener noreferrer" to external links',
        references: ['https://owasp.org/www-community/attacks/Reverse_Tabnabbing']
      })
    }

    return findings
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(findings: SecurityFinding[]): SecurityRiskLevel {
    const criticalCount = findings.filter((f) => f.severity === SecurityRiskLevel.CRITICAL).length
    const highCount = findings.filter((f) => f.severity === SecurityRiskLevel.HIGH).length
    const mediumCount = findings.filter((f) => f.severity === SecurityRiskLevel.MEDIUM).length

    if (criticalCount > 0) return SecurityRiskLevel.CRITICAL
    if (highCount > 2) return SecurityRiskLevel.HIGH
    if (highCount > 0 || mediumCount > 3) return SecurityRiskLevel.MEDIUM
    if (mediumCount > 0) return SecurityRiskLevel.LOW
    return SecurityRiskLevel.MINIMAL
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(findings: SecurityFinding[], validationResult: SecurityValidationResult): number {
    let score = validationResult.score

    // Deduct points for compliance violations
    const complianceViolations = findings.filter((f) => f.type === SecurityFindingType.COMPLIANCE_VIOLATION)
    score -= complianceViolations.length * 10

    // Deduct points for critical findings
    const criticalFindings = findings.filter((f) => f.severity === SecurityRiskLevel.CRITICAL)
    score -= criticalFindings.length * 25

    return Math.max(0, score)
  }

  /**
   * Generate audit summary
   */
  private generateAuditSummary(findings: SecurityFinding[], complianceScore: number): SecurityAuditSummary {
    const criticalFindings = findings.filter((f) => f.severity === SecurityRiskLevel.CRITICAL).length
    const highFindings = findings.filter((f) => f.severity === SecurityRiskLevel.HIGH).length
    const mediumFindings = findings.filter((f) => f.severity === SecurityRiskLevel.MEDIUM).length
    const lowFindings = findings.filter((f) => f.severity === SecurityRiskLevel.LOW).length

    const riskScore = criticalFindings * 25 + highFindings * 15 + mediumFindings * 8 + lowFindings * 3

    let securityPosture: SecurityAuditSummary['securityPosture']
    if (complianceScore >= 90) securityPosture = 'excellent'
    else if (complianceScore >= 75) securityPosture = 'good'
    else if (complianceScore >= 60) securityPosture = 'fair'
    else if (complianceScore >= 40) securityPosture = 'poor'
    else securityPosture = 'critical'

    let complianceStatus: SecurityAuditSummary['complianceStatus']
    if (complianceScore >= 80) complianceStatus = 'compliant'
    else if (complianceScore >= 60) complianceStatus = 'partial'
    else complianceStatus = 'non-compliant'

    return {
      totalFindings: findings.length,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      complianceStatus,
      riskScore,
      securityPosture
    }
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    findings: SecurityFinding[],
    validationResult: SecurityValidationResult
  ): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = []

    // Add recommendations based on findings
    if (findings.some((f) => f.type === SecurityFindingType.CODE_INJECTION)) {
      recommendations.push({
        id: 'eliminate-code-injection',
        priority: 'high',
        category: 'Code Security',
        title: 'Eliminate Code Injection Vectors',
        description: 'Remove all dynamic code execution patterns',
        implementation: 'Replace eval(), Function(), and similar patterns with safe alternatives',
        effort: 'medium',
        impact: 'high'
      })
    }

    if (findings.some((f) => f.type === SecurityFindingType.XSS_VULNERABILITY)) {
      recommendations.push({
        id: 'prevent-xss',
        priority: 'high',
        category: 'Web Security',
        title: 'Implement XSS Prevention',
        description: 'Add comprehensive XSS protection measures',
        implementation: 'Sanitize all user inputs and use safe rendering methods',
        effort: 'medium',
        impact: 'high'
      })
    }

    if (validationResult.score < 80) {
      recommendations.push({
        id: 'improve-security-score',
        priority: 'medium',
        category: 'General Security',
        title: 'Improve Overall Security Score',
        description: 'Address security warnings and violations',
        implementation: 'Follow security best practices and fix identified issues',
        effort: 'low',
        impact: 'medium'
      })
    }

    return recommendations
  }

  /**
   * Helper methods for compliance checking
   */
  private hasInputValidation(code: string): boolean {
    return /prop.*validation|validate|sanitize|escape/i.test(code)
  }

  private hasErrorHandling(code: string): boolean {
    return /try.*catch|error.*boundary|\.catch\(/i.test(code)
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
