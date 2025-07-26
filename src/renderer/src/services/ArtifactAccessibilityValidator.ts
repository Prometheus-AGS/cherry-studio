import { loggerService } from '@logger'

const logger = loggerService.withContext('ArtifactAccessibilityValidator')

export interface AccessibilityRule {
  id: string
  name: string
  description: string
  level: 'A' | 'AA' | 'AAA'
  category: 'color' | 'keyboard' | 'images' | 'forms' | 'structure' | 'navigation'
}

export interface AccessibilityViolation {
  rule: AccessibilityRule
  element: string
  message: string
  severity: 'error' | 'warning' | 'info'
  xpath?: string
  selector?: string
  fix?: string
}

export interface AccessibilityReport {
  artifactId: string
  timestamp: number
  score: number // 0-100
  violations: AccessibilityViolation[]
  passedRules: AccessibilityRule[]
  summary: {
    totalRules: number
    passedRules: number
    violations: number
    errors: number
    warnings: number
    info: number
  }
  recommendations: string[]
}

export interface ColorContrastResult {
  foreground: string
  background: string
  ratio: number
  level: 'AA' | 'AAA' | 'fail'
  isValid: boolean
}

export class ArtifactAccessibilityValidator {
  private static instance: ArtifactAccessibilityValidator
  private rules: AccessibilityRule[] = []

  private constructor() {
    this.initializeRules()
  }

  public static getInstance(): ArtifactAccessibilityValidator {
    if (!ArtifactAccessibilityValidator.instance) {
      ArtifactAccessibilityValidator.instance = new ArtifactAccessibilityValidator()
    }
    return ArtifactAccessibilityValidator.instance
  }

  /**
   * Validate accessibility for an artifact's rendered DOM
   */
  public async validateArtifact(artifactId: string, container: HTMLElement): Promise<AccessibilityReport> {
    logger.info(`Starting accessibility validation for artifact ${artifactId}`)

    const violations: AccessibilityViolation[] = []
    const passedRules: AccessibilityRule[] = []

    // Run all accessibility checks
    for (const rule of this.rules) {
      try {
        const ruleViolations = await this.checkRule(rule, container)
        if (ruleViolations.length > 0) {
          violations.push(...ruleViolations)
        } else {
          passedRules.push(rule)
        }
      } catch (error) {
        logger.warn(`Failed to check rule ${rule.id}:`, error as Error)
      }
    }

    const summary = this.generateSummary(violations, passedRules)
    const score = this.calculateScore(summary)
    const recommendations = this.generateRecommendations(violations)

    const report: AccessibilityReport = {
      artifactId,
      timestamp: Date.now(),
      score,
      violations,
      passedRules,
      summary,
      recommendations
    }

    logger.info(`Accessibility validation completed for ${artifactId}. Score: ${score}/100`)
    return report
  }

  /**
   * Check color contrast for text elements
   */
  public checkColorContrast(element: HTMLElement): ColorContrastResult {
    const styles = window.getComputedStyle(element)
    const foreground = styles.color
    const background = styles.backgroundColor || '#ffffff'

    const ratio = this.calculateContrastRatio(foreground, background)
    const level = this.getContrastLevel(ratio)

    return {
      foreground,
      background,
      ratio,
      level,
      isValid: level !== 'fail'
    }
  }

  /**
   * Check if element is keyboard accessible
   */
  public checkKeyboardAccessibility(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase()
    const tabIndex = element.tabIndex
    const role = element.getAttribute('role')

    // Interactive elements should be focusable
    const interactiveElements = ['button', 'input', 'select', 'textarea', 'a']
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio']

    if (interactiveElements.includes(tagName) || (role && interactiveRoles.includes(role))) {
      return tabIndex >= 0
    }

    return true // Non-interactive elements don't need to be focusable
  }

  /**
   * Check if images have alt text
   */
  public checkImageAltText(img: HTMLImageElement): boolean {
    const alt = img.getAttribute('alt')
    const role = img.getAttribute('role')

    // Decorative images can have empty alt or role="presentation"
    if (role === 'presentation' || role === 'none') {
      return true
    }

    // Images should have alt text
    return alt !== null && alt.trim().length > 0
  }

  /**
   * Check heading structure
   */
  public checkHeadingStructure(container: HTMLElement): AccessibilityViolation[] {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const violations: AccessibilityViolation[] = []
    let previousLevel = 0

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))

      if (index === 0 && level !== 1) {
        violations.push({
          rule: this.getRuleById('heading-start-h1')!,
          element: heading.tagName,
          message: 'Page should start with h1',
          severity: 'error',
          selector: this.getSelector(heading as HTMLElement),
          fix: 'Change the first heading to h1'
        })
      }

      if (level > previousLevel + 1) {
        violations.push({
          rule: this.getRuleById('heading-order')!,
          element: heading.tagName,
          message: `Heading level skipped from h${previousLevel} to h${level}`,
          severity: 'error',
          selector: this.getSelector(heading as HTMLElement),
          fix: `Use h${previousLevel + 1} instead of h${level}`
        })
      }

      previousLevel = level
    })

    return violations
  }

  /**
   * Check form accessibility
   */
  public checkFormAccessibility(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const inputs = container.querySelectorAll('input, select, textarea')

    inputs.forEach((input) => {
      const element = input as HTMLElement
      const id = element.id
      const label = container.querySelector(`label[for="${id}"]`)
      const ariaLabel = element.getAttribute('aria-label')
      const ariaLabelledBy = element.getAttribute('aria-labelledby')

      if (!label && !ariaLabel && !ariaLabelledBy) {
        violations.push({
          rule: this.getRuleById('form-label')!,
          element: element.tagName,
          message: 'Form input must have an associated label',
          severity: 'error',
          selector: this.getSelector(element),
          fix: 'Add a label element or aria-label attribute'
        })
      }
    })

    return violations
  }

  private async checkRule(rule: AccessibilityRule, container: HTMLElement): Promise<AccessibilityViolation[]> {
    switch (rule.id) {
      case 'color-contrast':
        return this.checkColorContrastRule(container)
      case 'keyboard-access':
        return this.checkKeyboardAccessRule(container)
      case 'image-alt':
        return this.checkImageAltRule(container)
      case 'heading-order':
      case 'heading-start-h1':
        return this.checkHeadingStructure(container)
      case 'form-label':
        return this.checkFormAccessibility(container)
      case 'focus-visible':
        return this.checkFocusVisibleRule(container)
      case 'aria-labels':
        return this.checkAriaLabelsRule(container)
      default:
        return []
    }
  }

  private checkColorContrastRule(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const textElements = container.querySelectorAll('*')

    textElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      if (htmlElement.textContent && htmlElement.textContent.trim()) {
        const contrast = this.checkColorContrast(htmlElement)
        if (!contrast.isValid) {
          violations.push({
            rule: this.getRuleById('color-contrast')!,
            element: htmlElement.tagName,
            message: `Color contrast ratio ${contrast.ratio.toFixed(2)} is below WCAG standards`,
            severity: 'error',
            selector: this.getSelector(htmlElement),
            fix: 'Increase color contrast between text and background'
          })
        }
      }
    })

    return violations
  }

  private checkKeyboardAccessRule(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const interactiveElements = container.querySelectorAll(
      'button, input, select, textarea, a, [role="button"], [role="link"]'
    )

    interactiveElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      if (!this.checkKeyboardAccessibility(htmlElement)) {
        violations.push({
          rule: this.getRuleById('keyboard-access')!,
          element: htmlElement.tagName,
          message: 'Interactive element is not keyboard accessible',
          severity: 'error',
          selector: this.getSelector(htmlElement),
          fix: 'Add tabindex="0" or ensure element is focusable'
        })
      }
    })

    return violations
  }

  private checkImageAltRule(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const images = container.querySelectorAll('img')

    images.forEach((img) => {
      if (!this.checkImageAltText(img)) {
        violations.push({
          rule: this.getRuleById('image-alt')!,
          element: 'IMG',
          message: 'Image missing alt text',
          severity: 'error',
          selector: this.getSelector(img),
          fix: 'Add descriptive alt text or role="presentation" for decorative images'
        })
      }
    })

    return violations
  }

  private checkFocusVisibleRule(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const focusableElements = container.querySelectorAll('button, input, select, textarea, a, [tabindex]')

    focusableElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      const styles = window.getComputedStyle(htmlElement, ':focus')
      const outline = styles.outline
      const boxShadow = styles.boxShadow

      if (outline === 'none' && !boxShadow.includes('inset')) {
        violations.push({
          rule: this.getRuleById('focus-visible')!,
          element: htmlElement.tagName,
          message: 'Focusable element has no visible focus indicator',
          severity: 'warning',
          selector: this.getSelector(htmlElement),
          fix: 'Add :focus styles with outline or box-shadow'
        })
      }
    })

    return violations
  }

  private checkAriaLabelsRule(container: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    const elementsWithRole = container.querySelectorAll('[role]')

    elementsWithRole.forEach((element) => {
      const htmlElement = element as HTMLElement
      const role = htmlElement.getAttribute('role')
      const ariaLabel = htmlElement.getAttribute('aria-label')
      const ariaLabelledBy = htmlElement.getAttribute('aria-labelledby')

      const rolesRequiringLabels = ['button', 'link', 'textbox', 'combobox', 'listbox']
      if (role && rolesRequiringLabels.includes(role) && !ariaLabel && !ariaLabelledBy) {
        violations.push({
          rule: this.getRuleById('aria-labels')!,
          element: htmlElement.tagName,
          message: `Element with role="${role}" needs accessible name`,
          severity: 'error',
          selector: this.getSelector(htmlElement),
          fix: 'Add aria-label or aria-labelledby attribute'
        })
      }
    })

    return violations
  }

  private calculateContrastRatio(foreground: string, background: string): number {
    const fgLuminance = this.getLuminance(foreground)
    const bgLuminance = this.getLuminance(background)

    const lighter = Math.max(fgLuminance, bgLuminance)
    const darker = Math.min(fgLuminance, bgLuminance)

    return (lighter + 0.05) / (darker + 0.05)
  }

  private getLuminance(color: string): number {
    const rgb = this.parseColor(color)
    const [r, g, b] = rgb.map((c) => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  private parseColor(color: string): [number, number, number] {
    // Simple RGB parser - in production, use a more robust color parsing library
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
    }

    // Default to black if parsing fails
    return [0, 0, 0]
  }

  private getContrastLevel(ratio: number): 'AA' | 'AAA' | 'fail' {
    if (ratio >= 7) return 'AAA'
    if (ratio >= 4.5) return 'AA'
    return 'fail'
  }

  private getSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`
    if (element.className) return `.${element.className.split(' ')[0]}`
    return element.tagName.toLowerCase()
  }

  private getRuleById(id: string): AccessibilityRule | undefined {
    return this.rules.find((rule) => rule.id === id)
  }

  private generateSummary(violations: AccessibilityViolation[], passedRules: AccessibilityRule[]) {
    const errors = violations.filter((v) => v.severity === 'error').length
    const warnings = violations.filter((v) => v.severity === 'warning').length
    const info = violations.filter((v) => v.severity === 'info').length

    return {
      totalRules: this.rules.length,
      passedRules: passedRules.length,
      violations: violations.length,
      errors,
      warnings,
      info
    }
  }

  private calculateScore(summary: any): number {
    const totalChecks = summary.totalRules
    const passed = summary.passedRules
    const errors = summary.errors
    const warnings = summary.warnings

    let score = (passed / totalChecks) * 100
    score -= errors * 10 // Deduct 10 points per error
    score -= warnings * 5 // Deduct 5 points per warning

    return Math.max(0, Math.round(score))
  }

  private generateRecommendations(violations: AccessibilityViolation[]): string[] {
    const recommendations = new Set<string>()

    violations.forEach((violation) => {
      switch (violation.rule.category) {
        case 'color':
          recommendations.add('Ensure sufficient color contrast for all text elements')
          recommendations.add('Do not rely solely on color to convey information')
          break
        case 'keyboard':
          recommendations.add('Make all interactive elements keyboard accessible')
          recommendations.add('Provide visible focus indicators')
          break
        case 'images':
          recommendations.add('Provide descriptive alt text for all informative images')
          recommendations.add('Use empty alt="" for decorative images')
          break
        case 'forms':
          recommendations.add('Associate labels with form controls')
          recommendations.add('Provide clear error messages and instructions')
          break
        case 'structure':
          recommendations.add('Use proper heading hierarchy (h1-h6)')
          recommendations.add('Structure content with semantic HTML elements')
          break
        case 'navigation':
          recommendations.add('Provide skip links for keyboard navigation')
          recommendations.add('Use ARIA landmarks for page regions')
          break
      }
    })

    return Array.from(recommendations)
  }

  private initializeRules(): void {
    this.rules = [
      {
        id: 'color-contrast',
        name: 'Color Contrast',
        description: 'Text must have sufficient contrast against background',
        level: 'AA',
        category: 'color'
      },
      {
        id: 'keyboard-access',
        name: 'Keyboard Accessibility',
        description: 'All interactive elements must be keyboard accessible',
        level: 'A',
        category: 'keyboard'
      },
      {
        id: 'image-alt',
        name: 'Image Alt Text',
        description: 'Images must have appropriate alt text',
        level: 'A',
        category: 'images'
      },
      {
        id: 'heading-order',
        name: 'Heading Order',
        description: 'Headings must be in logical order',
        level: 'AA',
        category: 'structure'
      },
      {
        id: 'heading-start-h1',
        name: 'Page Starts with H1',
        description: 'Page should start with h1 heading',
        level: 'AA',
        category: 'structure'
      },
      {
        id: 'form-label',
        name: 'Form Labels',
        description: 'Form inputs must have associated labels',
        level: 'A',
        category: 'forms'
      },
      {
        id: 'focus-visible',
        name: 'Focus Visible',
        description: 'Focusable elements must have visible focus indicators',
        level: 'AA',
        category: 'keyboard'
      },
      {
        id: 'aria-labels',
        name: 'ARIA Labels',
        description: 'Elements with roles must have accessible names',
        level: 'A',
        category: 'structure'
      }
    ]
  }
}
