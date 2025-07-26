import { loggerService } from '@logger'
import { CompilationResult, CompilerOptions, ReactArtifact } from '@renderer/types'

import { dependencyManager } from './DependencyManager'

const logger = loggerService.withContext('ComponentCompiler')

export class ComponentCompiler {
  private static instance: ComponentCompiler

  public static getInstance(): ComponentCompiler {
    if (!ComponentCompiler.instance) {
      ComponentCompiler.instance = new ComponentCompiler()
    }
    return ComponentCompiler.instance
  }

  /**
   * Compile React artifact code into executable bundle
   */
  async compileArtifact(artifact: ReactArtifact, options: CompilerOptions = {}): Promise<CompilationResult> {
    try {
      logger.info(`Compiling artifact: ${artifact.id}`)

      // Validate code before compilation
      const validation = this.validateCode(artifact.code)
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: [],
          bundle: null,
          sourceMap: null,
          compilationTime: 0
        }
      }

      const startTime = Date.now()

      // Transform TypeScript/JSX to JavaScript
      const transformedCode = await this.transformCode(artifact.code)

      // Resolve dependencies
      const dependencyResolution = await dependencyManager.resolveDependencies(artifact.metadata.dependencies)

      if (dependencyResolution.failed.length > 0) {
        return {
          success: false,
          errors: [`Failed to resolve dependencies: ${dependencyResolution.failed.join(', ')}`],
          warnings: dependencyResolution.warnings,
          bundle: null,
          sourceMap: null,
          compilationTime: 0
        }
      }

      // Generate import map for dependencies
      const importMap = dependencyManager.generateImportMap(dependencyResolution.resolved)

      // Create executable bundle
      const bundle = this.createBundle(transformedCode, importMap, artifact.metadata)

      // Generate source map for debugging
      const sourceMap = options.generateSourceMap ? this.generateSourceMap(artifact.code) : null

      const compilationTime = Date.now() - startTime

      logger.info(`Successfully compiled artifact ${artifact.id} in ${compilationTime}ms`)

      return {
        success: true,
        errors: [],
        warnings: validation.warnings || [],
        bundle,
        sourceMap,
        compilationTime
      }
    } catch (error) {
      logger.error('Failed to compile artifact:', error as Error)
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown compilation error'],
        warnings: [],
        bundle: null,
        sourceMap: null,
        compilationTime: 0
      }
    }
  }

  /**
   * Validate artifact code for compilation
   */
  private validateCode(code: string): { isValid: boolean; errors: string[]; warnings?: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for required React import
    if (!code.includes('import React') && !code.includes('import { ') && !code.includes("from 'react'")) {
      errors.push('React import is required')
    }

    // Check for component export
    if (!code.includes('export default') && !code.includes('export {')) {
      errors.push('Component must have a default export')
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, message: 'eval() is not allowed for security reasons' },
      { pattern: /Function\s*\(/g, message: 'Function constructor is not allowed for security reasons' },
      { pattern: /innerHTML/g, message: 'innerHTML is not allowed, use textContent or JSX instead' },
      { pattern: /document\.write/g, message: 'document.write is not allowed for security reasons' },
      { pattern: /import\s*\(/g, message: 'Dynamic imports are not allowed for security reasons' }
    ]

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message)
      }
    }

    // Check for network requests
    const networkPatterns = [/fetch\s*\(/g, /XMLHttpRequest/g, /axios\./g, /\.get\s*\(/g, /\.post\s*\(/g]

    for (const pattern of networkPatterns) {
      if (pattern.test(code)) {
        warnings.push('Network requests may not work in sandboxed environment')
        break
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  /**
   * Transform TypeScript/JSX code to JavaScript
   */
  private async transformCode(code: string): Promise<string> {
    // Simple transformation for now - in a real implementation, you'd use esbuild or Babel
    let transformedCode = code

    // Remove TypeScript type annotations (basic implementation)
    transformedCode = transformedCode
      .replace(/:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(?=\s*[,;=)])/g, '')
      .replace(/interface\s+\w+\s*{[^}]*}/g, '')
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')

    // Transform JSX to React.createElement calls (basic implementation)
    // In a real implementation, you'd use a proper JSX transformer
    transformedCode = this.transformJSX(transformedCode)

    // Add React import if missing
    if (!transformedCode.includes('import React')) {
      transformedCode = `import React from 'react';\n${transformedCode}`
    }

    return transformedCode
  }

  /**
   * Basic JSX transformation (simplified)
   */
  private transformJSX(code: string): string {
    // This is a very basic JSX transformation
    // In a real implementation, you'd use a proper JSX parser/transformer
    return code
      .replace(/<(\w+)([^>]*?)\/>/g, 'React.createElement("$1", {$2})')
      .replace(/<(\w+)([^>]*?)>(.*?)<\/\1>/g, 'React.createElement("$1", {$2}, $3)')
  }

  /**
   * Create executable bundle
   */
  private createBundle(code: string, importMap: Record<string, string>, metadata: ReactArtifact['metadata']): string {
    const bundleTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title}</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: var(--background, #ffffff);
      color: var(--foreground, #000000);
    }

    * {
      box-sizing: border-box;
    }

    .artifact-container {
      width: 100%;
      height: 100%;
      min-height: 200px;
    }

    .error-boundary {
      padding: 20px;
      border: 2px solid #ff6b6b;
      border-radius: 8px;
      background: #ffe0e0;
      color: #d63031;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="root" class="artifact-container"></div>

  <script type="importmap">
  {
    "imports": ${JSON.stringify(importMap, null, 2)}
  }
  </script>

  <script type="module">
    // Error boundary implementation
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }

      componentDidCatch(error, errorInfo) {
        console.error('Component error:', error, errorInfo);
        window.parent?.postMessage({
          type: 'artifact-error',
          error: error.message,
          stack: error.stack
        }, '*');
      }

      render() {
        if (this.state.hasError) {
          return React.createElement('div', {
            className: 'error-boundary'
          }, [
            React.createElement('h3', { key: 'title' }, 'Component Error'),
            React.createElement('p', { key: 'message' }, this.state.error?.message || 'Unknown error'),
            React.createElement('pre', { key: 'stack' }, this.state.error?.stack)
          ]);
        }

        return this.props.children;
      }
    }

    // Component code
    ${code}

    // Render component
    try {
      const container = document.getElementById('root');
      const root = ReactDOM.createRoot(container);

      // Get component from default export
      const Component = window.default || window.Component;

      if (!Component) {
        throw new Error('No default export found. Please export your component as default.');
      }

      // Render with error boundary
      root.render(
        React.createElement(ErrorBoundary, null,
          React.createElement(Component, window.artifactProps || {})
        )
      );

      // Notify parent that component is ready
      window.parent?.postMessage({
        type: 'artifact-ready',
        artifactId: '${metadata.title}'
      }, '*');

    } catch (error) {
      console.error('Render error:', error);
      document.getElementById('root').innerHTML = \`
        <div class="error-boundary">
          <h3>Render Error</h3>
          <p>\${error.message}</p>
          <pre>\${error.stack}</pre>
        </div>
      \`;

      window.parent?.postMessage({
        type: 'artifact-error',
        error: error.message,
        stack: error.stack
      }, '*');
    }
  </script>
</body>
</html>
    `.trim()

    return bundleTemplate
  }

  /**
   * Generate source map for debugging
   */
  private generateSourceMap(originalCode: string): string {
    // Basic source map generation
    // In a real implementation, you'd use a proper source map generator
    const sourceMap = {
      version: 3,
      sources: ['artifact.tsx'],
      names: [],
      mappings: '',
      sourcesContent: [originalCode]
    }

    return JSON.stringify(sourceMap)
  }

  /**
   * Get compilation statistics
   */
  getCompilationStats(): {
    totalCompilations: number
    averageCompilationTime: number
    successRate: number
  } {
    // In a real implementation, you'd track these statistics
    return {
      totalCompilations: 0,
      averageCompilationTime: 0,
      successRate: 100
    }
  }

  /**
   * Clear compilation cache
   */
  clearCache(): void {
    // In a real implementation, you'd clear any compilation caches
    logger.info('Compilation cache cleared')
  }
}

// Export singleton instance
export const componentCompiler = ComponentCompiler.getInstance()
