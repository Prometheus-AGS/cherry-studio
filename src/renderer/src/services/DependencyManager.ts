import { loggerService } from '@logger'

const logger = loggerService.withContext('DependencyManager')

export interface DependencyInfo {
  name: string
  version: string
  url: string
  type: 'esm' | 'umd' | 'cjs'
  integrity?: string
  dependencies?: string[]
}

export interface DependencyResolution {
  resolved: DependencyInfo[]
  failed: string[]
  warnings: string[]
}

export class DependencyManager {
  private static instance: DependencyManager
  private dependencyCache = new Map<string, DependencyInfo>()
  private readonly WHITELISTED_DEPENDENCIES: Record<string, DependencyInfo> = {
    react: {
      name: 'react',
      version: '18.2.0',
      url: 'https://esm.sh/react@18.2.0',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: []
    },
    'react-dom': {
      name: 'react-dom',
      version: '18.2.0',
      url: 'https://esm.sh/react-dom@18.2.0',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: ['react']
    },
    'styled-components': {
      name: 'styled-components',
      version: '5.3.11',
      url: 'https://esm.sh/styled-components@5.3.11',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: ['react']
    },
    lodash: {
      name: 'lodash',
      version: '4.17.21',
      url: 'https://esm.sh/lodash@4.17.21',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: []
    },
    dayjs: {
      name: 'dayjs',
      version: '1.11.9',
      url: 'https://esm.sh/dayjs@1.11.9',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: []
    },
    uuid: {
      name: 'uuid',
      version: '9.0.0',
      url: 'https://esm.sh/uuid@9.0.0',
      type: 'esm',
      integrity: 'sha384-...',
      dependencies: []
    }
  }

  public static getInstance(): DependencyManager {
    if (!DependencyManager.instance) {
      DependencyManager.instance = new DependencyManager()
    }
    return DependencyManager.instance
  }

  /**
   * Resolve dependencies for an artifact
   */
  async resolveDependencies(dependencies: string[]): Promise<DependencyResolution> {
    const resolved: DependencyInfo[] = []
    const failed: string[] = []
    const warnings: string[] = []

    logger.info(`Resolving ${dependencies.length} dependencies`)

    for (const dep of dependencies) {
      try {
        const depInfo = await this.resolveDependency(dep)
        if (depInfo) {
          resolved.push(depInfo)

          // Recursively resolve sub-dependencies
          if (depInfo.dependencies && depInfo.dependencies.length > 0) {
            const subResolution = await this.resolveDependencies(depInfo.dependencies)
            resolved.push(...subResolution.resolved)
            failed.push(...subResolution.failed)
            warnings.push(...subResolution.warnings)
          }
        } else {
          failed.push(dep)
        }
      } catch (error) {
        logger.error(`Failed to resolve dependency ${dep}:`, error as Error)
        failed.push(dep)
      }
    }

    // Remove duplicates
    const uniqueResolved = this.deduplicateDependencies(resolved)

    logger.info(`Resolved ${uniqueResolved.length} dependencies, ${failed.length} failed`)

    return {
      resolved: uniqueResolved,
      failed,
      warnings
    }
  }

  /**
   * Resolve a single dependency
   */
  private async resolveDependency(dependency: string): Promise<DependencyInfo | null> {
    // Check cache first
    if (this.dependencyCache.has(dependency)) {
      return this.dependencyCache.get(dependency)!
    }

    // Parse dependency string (name@version or just name)
    const { name, version } = this.parseDependencyString(dependency)

    // Check if dependency is whitelisted
    if (!this.WHITELISTED_DEPENDENCIES[name]) {
      logger.warn(`Dependency ${name} is not whitelisted`)
      return null
    }

    const depInfo = { ...this.WHITELISTED_DEPENDENCIES[name] }

    // Use specific version if provided
    if (version && version !== depInfo.version) {
      depInfo.version = version
      depInfo.url = depInfo.url.replace(/@[\d.]+/, `@${version}`)
    }

    // Cache the resolved dependency
    this.dependencyCache.set(dependency, depInfo)

    return depInfo
  }

  /**
   * Parse dependency string to extract name and version
   */
  private parseDependencyString(dependency: string): { name: string; version?: string } {
    const parts = dependency.split('@')

    if (parts.length === 1) {
      return { name: parts[0] }
    }

    if (parts.length === 2) {
      return { name: parts[0], version: parts[1] }
    }

    // Handle scoped packages like @types/react@18.0.0
    if (dependency.startsWith('@')) {
      const scopedParts = dependency.split('@')
      if (scopedParts.length === 3) {
        return { name: `@${scopedParts[1]}`, version: scopedParts[2] }
      }
      return { name: `@${scopedParts[1]}` }
    }

    return { name: parts[0] }
  }

  /**
   * Remove duplicate dependencies
   */
  private deduplicateDependencies(dependencies: DependencyInfo[]): DependencyInfo[] {
    const seen = new Set<string>()
    const unique: DependencyInfo[] = []

    for (const dep of dependencies) {
      const key = `${dep.name}@${dep.version}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(dep)
      }
    }

    return unique
  }

  /**
   * Generate import map for resolved dependencies
   */
  generateImportMap(dependencies: DependencyInfo[]): Record<string, string> {
    const importMap: Record<string, string> = {}

    for (const dep of dependencies) {
      importMap[dep.name] = dep.url
    }

    return importMap
  }

  /**
   * Validate dependency security
   */
  validateDependencySecurity(dependencies: string[]): { isValid: boolean; violations: string[] } {
    const violations: string[] = []

    for (const dep of dependencies) {
      const { name } = this.parseDependencyString(dep)

      // Check if dependency is whitelisted
      if (!this.WHITELISTED_DEPENDENCIES[name]) {
        violations.push(`Dependency ${name} is not in the whitelist`)
      }

      // Check for dangerous packages
      const dangerousPackages = [
        'eval',
        'vm',
        'child_process',
        'fs',
        'path',
        'os',
        'crypto',
        'http',
        'https',
        'net',
        'dgram',
        'dns'
      ]

      if (dangerousPackages.includes(name)) {
        violations.push(`Dependency ${name} is potentially dangerous`)
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    }
  }

  /**
   * Get dependency information
   */
  getDependencyInfo(name: string): DependencyInfo | null {
    return this.WHITELISTED_DEPENDENCIES[name] || null
  }

  /**
   * Get all whitelisted dependencies
   */
  getWhitelistedDependencies(): string[] {
    return Object.keys(this.WHITELISTED_DEPENDENCIES)
  }

  /**
   * Check if dependency is whitelisted
   */
  isDependencyWhitelisted(name: string): boolean {
    return name in this.WHITELISTED_DEPENDENCIES
  }

  /**
   * Add custom dependency (for testing or development)
   */
  addCustomDependency(name: string, info: DependencyInfo): void {
    this.WHITELISTED_DEPENDENCIES[name] = info
    logger.info(`Added custom dependency: ${name}`)
  }

  /**
   * Clear dependency cache
   */
  clearCache(): void {
    this.dependencyCache.clear()
    logger.info('Dependency cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.dependencyCache.size,
      entries: Array.from(this.dependencyCache.keys())
    }
  }

  /**
   * Preload common dependencies
   */
  async preloadCommonDependencies(): Promise<void> {
    const commonDeps = ['react', 'react-dom', 'styled-components']

    try {
      await this.resolveDependencies(commonDeps)
      logger.info('Preloaded common dependencies')
    } catch (error) {
      logger.error('Failed to preload common dependencies:', error as Error)
    }
  }

  /**
   * Generate dependency bundle for offline use
   */
  async generateOfflineBundle(dependencies: string[]): Promise<string> {
    const resolution = await this.resolveDependencies(dependencies)

    if (resolution.failed.length > 0) {
      throw new Error(`Failed to resolve dependencies: ${resolution.failed.join(', ')}`)
    }

    // Generate a bundle script that includes all dependencies
    const bundleScript = `
// Offline dependency bundle
const dependencies = ${JSON.stringify(resolution.resolved, null, 2)};

// Create import map
const importMap = {
  imports: ${JSON.stringify(this.generateImportMap(resolution.resolved), null, 2)}
};

// Inject import map
const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);
document.head.appendChild(script);

// Export dependencies for runtime access
window.__ARTIFACT_DEPENDENCIES__ = dependencies;
    `.trim()

    return bundleScript
  }
}

// Export singleton instance
export const dependencyManager = DependencyManager.getInstance()
