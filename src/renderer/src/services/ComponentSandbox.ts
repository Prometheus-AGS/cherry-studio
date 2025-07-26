import { loggerService } from '@logger'
import { ReactArtifact } from '@renderer/types'

const logger = loggerService.withContext('ComponentSandbox')

export interface SandboxConfig {
  allowedDependencies: string[]
  maxMemoryMB: number
  executionTimeoutMs: number
  enableConsoleLogging: boolean
  enableErrorReporting: boolean
}

export interface SandboxError {
  type: 'compilation' | 'runtime' | 'security' | 'timeout' | 'memory'
  message: string
  stack?: string
  line?: number
  column?: number
}

export interface SandboxResult {
  success: boolean
  error?: SandboxError
  compiledCode?: string
  memoryUsage?: number
  executionTime?: number
}

export class ComponentSandbox {
  private static instance: ComponentSandbox
  private config: SandboxConfig
  private sandboxes: Map<string, HTMLIFrameElement> = new Map()

  private constructor() {
    this.config = {
      allowedDependencies: ['react', 'react-dom', 'styled-components', 'lodash', 'dayjs', 'uuid'],
      maxMemoryMB: 50,
      executionTimeoutMs: 5000,
      enableConsoleLogging: true,
      enableErrorReporting: true
    }
  }

  public static getInstance(): ComponentSandbox {
    if (!ComponentSandbox.instance) {
      ComponentSandbox.instance = new ComponentSandbox()
    }
    return ComponentSandbox.instance
  }

  /**
   * Create a sandboxed iframe for component rendering
   */
  async createSandbox(artifactId: string, artifact: ReactArtifact): Promise<HTMLIFrameElement> {
    try {
      // Remove existing sandbox if it exists
      this.destroySandbox(artifactId)

      // Create iframe element
      const iframe = document.createElement('iframe')
      iframe.id = `sandbox-${artifactId}`
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      iframe.style.background = 'transparent'

      // Security attributes
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-modals')

      // Set up CSP and security headers
      const sandboxHtml = this.generateSandboxHtml(artifact)

      // Create blob URL for the sandbox content
      const blob = new Blob([sandboxHtml], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)

      iframe.src = blobUrl

      // Store sandbox reference
      this.sandboxes.set(artifactId, iframe)

      // Set up error handling and communication
      this.setupSandboxCommunication(iframe, artifactId)

      logger.info(`Created sandbox for artifact: ${artifactId}`)
      return iframe
    } catch (error) {
      logger.error('Failed to create sandbox:', error as Error)
      throw error
    }
  }

  /**
   * Generate secure HTML for the sandbox iframe
   */
  private generateSandboxHtml(artifact: ReactArtifact): string {
    const { code, metadata } = artifact

    // Validate dependencies
    const safeDependencies = metadata.dependencies.filter((dep) => this.config.allowedDependencies.includes(dep))

    // Generate dependency imports
    const dependencyImports = this.generateDependencyImports(safeDependencies)

    // Generate CSP header
    const csp = this.generateCSP()

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>React Artifact Sandbox</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: transparent;
      overflow: auto;
    }

    #root {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .error-boundary {
      padding: 20px;
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      color: #c33;
      font-family: monospace;
      white-space: pre-wrap;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #666;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading">Loading component...</div>
  </div>

  <!-- Dependency Scripts -->
  ${dependencyImports}

  <script type="module">
    // Error boundary and monitoring
    class ErrorBoundary {
      constructor() {
        this.hasError = false;
        this.setupErrorHandling();
      }

      setupErrorHandling() {
        window.addEventListener('error', (event) => {
          this.handleError(event.error, event.filename, event.lineno, event.colno);
        });

        window.addEventListener('unhandledrejection', (event) => {
          this.handleError(event.reason, 'Promise', 0, 0);
        });
      }

      handleError(error, filename, line, column) {
        this.hasError = true;
        const errorInfo = {
          type: 'runtime',
          message: error.message || String(error),
          stack: error.stack,
          line,
          column,
          filename
        };

        this.displayError(errorInfo);
        this.reportError(errorInfo);
      }

      displayError(errorInfo) {
        const root = document.getElementById('root');
        root.innerHTML = \`
          <div class="error-boundary">
            <h3>Component Error</h3>
            <p><strong>Message:</strong> \${errorInfo.message}</p>
            \${errorInfo.line ? \`<p><strong>Line:</strong> \${errorInfo.line}</p>\` : ''}
            \${errorInfo.stack ? \`<p><strong>Stack:</strong></p><pre>\${errorInfo.stack}</pre>\` : ''}
          </div>
        \`;
      }

      reportError(errorInfo) {
        if (window.parent) {
          window.parent.postMessage({
            type: 'sandbox-error',
            artifactId: '${artifact.id}',
            error: errorInfo
          }, '*');
        }
      }
    }

    // Performance monitoring
    class PerformanceMonitor {
      constructor() {
        this.startTime = performance.now();
        this.memoryCheckInterval = null;
        this.maxMemory = ${this.config.maxMemoryMB} * 1024 * 1024; // Convert to bytes
        this.timeout = ${this.config.executionTimeoutMs};
      }

      start() {
        // Set execution timeout
        setTimeout(() => {
          this.handleTimeout();
        }, this.timeout);

        // Monitor memory usage
        if (performance.memory) {
          this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryUsage();
          }, 1000);
        }
      }

      checkMemoryUsage() {
        if (performance.memory && performance.memory.usedJSHeapSize > this.maxMemory) {
          this.handleMemoryLimit();
        }
      }

      handleTimeout() {
        const errorInfo = {
          type: 'timeout',
          message: \`Component execution exceeded \${this.timeout}ms timeout\`
        };

        if (window.parent) {
          window.parent.postMessage({
            type: 'sandbox-error',
            artifactId: '${artifact.id}',
            error: errorInfo
          }, '*');
        }
      }

      handleMemoryLimit() {
        const errorInfo = {
          type: 'memory',
          message: \`Component exceeded memory limit of \${this.config.maxMemoryMB}MB\`
        };

        if (window.parent) {
          window.parent.postMessage({
            type: 'sandbox-error',
            artifactId: '${artifact.id}',
            error: errorInfo
          }, '*');
        }
      }

      stop() {
        if (this.memoryCheckInterval) {
          clearInterval(this.memoryCheckInterval);
        }
      }

      getMetrics() {
        const endTime = performance.now();
        return {
          executionTime: endTime - this.startTime,
          memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0
        };
      }
    }

    // Initialize monitoring
    const errorBoundary = new ErrorBoundary();
    const performanceMonitor = new PerformanceMonitor();
    performanceMonitor.start();

    // Component code execution
    try {
      // Sanitized component code
      ${this.sanitizeCode(code)}

      // Report successful load
      if (window.parent) {
        window.parent.postMessage({
          type: 'sandbox-ready',
          artifactId: '${artifact.id}',
          metrics: performanceMonitor.getMetrics()
        }, '*');
      }
    } catch (error) {
      errorBoundary.handleError(error, 'component', 0, 0);
    }
  </script>
</body>
</html>
    `.trim()
  }

  /**
   * Generate dependency imports for allowed libraries
   */
  private generateDependencyImports(dependencies: string[]): string {
    const importMap: Record<string, string> = {
      react: 'https://unpkg.com/react@18/umd/react.development.js',
      'react-dom': 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
      'styled-components': 'https://unpkg.com/styled-components@5/dist/styled-components.min.js',
      lodash: 'https://unpkg.com/lodash@4/lodash.min.js',
      dayjs: 'https://unpkg.com/dayjs@1/dayjs.min.js',
      uuid: 'https://unpkg.com/uuid@9/dist/umd/uuid.min.js'
    }

    return dependencies
      .filter((dep) => importMap[dep])
      .map((dep) => `<script crossorigin src="${importMap[dep]}"></script>`)
      .join('\n  ')
  }

  /**
   * Generate Content Security Policy
   */
  private generateCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "media-src 'none'"
    ].join('; ')
  }

  /**
   * Sanitize component code for security
   */
  private sanitizeCode(code: string): string {
    // Remove dangerous patterns
    const sanitized = code
      .replace(/eval\s*\(/g, '/* eval removed */')
      .replace(/Function\s*\(/g, '/* Function constructor removed */')
      .replace(/innerHTML\s*=/g, '/* innerHTML removed */')
      .replace(/document\.write\s*\(/g, '/* document.write removed */')
      .replace(/window\./g, '/* window access removed */')
      .replace(/global\./g, '/* global access removed */')
      .replace(/process\./g, '/* process access removed */')
      .replace(/require\s*\(/g, '/* require removed */')
      .replace(/import\s*\(/g, '/* dynamic import removed */')

    // Wrap in try-catch for additional safety
    return `
      try {
        ${sanitized}
      } catch (error) {
        console.error('Component execution error:', error);
        throw error;
      }
    `
  }

  /**
   * Set up communication between sandbox and parent
   */
  private setupSandboxCommunication(iframe: HTMLIFrameElement, artifactId: string): void {
    const messageHandler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return

      const { type, artifactId: msgArtifactId, error, metrics } = event.data

      if (msgArtifactId !== artifactId) return

      switch (type) {
        case 'sandbox-ready':
          logger.info(`Sandbox ready for artifact: ${artifactId}`, metrics)
          this.dispatchSandboxEvent('ready', artifactId, { metrics })
          break

        case 'sandbox-error':
          logger.error(`Sandbox error for artifact: ${artifactId}`, error)
          this.dispatchSandboxEvent('error', artifactId, { error })
          break

        default:
          logger.warn(`Unknown sandbox message type: ${type}`)
      }
    }

    window.addEventListener('message', messageHandler)

    // Store cleanup function
    iframe.dataset.messageHandler = 'attached'
  }

  /**
   * Dispatch custom events for sandbox communication
   */
  private dispatchSandboxEvent(type: string, artifactId: string, detail: any): void {
    const event = new CustomEvent(`sandbox-${type}`, {
      detail: { artifactId, ...detail }
    })
    window.dispatchEvent(event)
  }

  /**
   * Update sandbox with new code
   */
  async updateSandbox(artifactId: string, artifact: ReactArtifact): Promise<void> {
    try {
      const existingSandbox = this.sandboxes.get(artifactId)
      if (!existingSandbox) {
        throw new Error(`Sandbox not found for artifact: ${artifactId}`)
      }

      // Generate new sandbox HTML
      const sandboxHtml = this.generateSandboxHtml(artifact)
      const blob = new Blob([sandboxHtml], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)

      // Update iframe source
      existingSandbox.src = blobUrl

      logger.info(`Updated sandbox for artifact: ${artifactId}`)
    } catch (error) {
      logger.error('Failed to update sandbox:', error as Error)
      throw error
    }
  }

  /**
   * Destroy a sandbox and clean up resources
   */
  destroySandbox(artifactId: string): void {
    const sandbox = this.sandboxes.get(artifactId)
    if (sandbox) {
      // Revoke blob URL to free memory
      if (sandbox.src.startsWith('blob:')) {
        URL.revokeObjectURL(sandbox.src)
      }

      // Remove from DOM if attached
      if (sandbox.parentNode) {
        sandbox.parentNode.removeChild(sandbox)
      }

      // Remove from map
      this.sandboxes.delete(artifactId)

      logger.info(`Destroyed sandbox for artifact: ${artifactId}`)
    }
  }

  /**
   * Get sandbox element by artifact ID
   */
  getSandbox(artifactId: string): HTMLIFrameElement | null {
    return this.sandboxes.get(artifactId) || null
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(newConfig: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('Updated sandbox configuration', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config }
  }

  /**
   * Clean up all sandboxes
   */
  destroyAllSandboxes(): void {
    for (const artifactId of this.sandboxes.keys()) {
      this.destroySandbox(artifactId)
    }
    logger.info('Destroyed all sandboxes')
  }
}

// Export singleton instance
export const componentSandbox = ComponentSandbox.getInstance()
