import { loggerService } from '@logger'
import JSZip from 'jszip'

import type { ReactArtifact } from '../types'
import { ArtifactStorage } from './ArtifactStorage'
import { ComponentCompiler } from './ComponentCompiler'
import { DependencyManager } from './DependencyManager'

const logger = loggerService.withContext('ArtifactExportService')

export interface ExportOptions {
  includeSourceMap?: boolean
  minify?: boolean
  includeTypes?: boolean
  bundleDependencies?: boolean
  format?: 'esm' | 'cjs' | 'umd'
}

export interface ExportResult {
  success: boolean
  data?: string | Buffer
  error?: string
  metadata?: {
    size: number
    dependencies: string[]
    exportTime: number
  }
}

export class ArtifactExportService {
  private static instance: ArtifactExportService
  private compiler: ComponentCompiler
  private dependencyManager: DependencyManager
  private storage: ArtifactStorage

  private constructor() {
    this.compiler = ComponentCompiler.getInstance()
    this.dependencyManager = DependencyManager.getInstance()
    this.storage = ArtifactStorage.getInstance()
  }

  public static getInstance(): ArtifactExportService {
    if (!ArtifactExportService.instance) {
      ArtifactExportService.instance = new ArtifactExportService()
    }
    return ArtifactExportService.instance
  }

  /**
   * Export artifact as standalone HTML file
   */
  public async exportAsHTML(artifactId: string, options: ExportOptions = {}): Promise<ExportResult> {
    const startTime = Date.now()

    try {
      logger.info(`Exporting artifact ${artifactId} as HTML`)

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        return { success: false, error: 'Artifact not found' }
      }

      // Compile the component
      const compilationResult = await this.compiler.compileArtifact(artifact, {
        minify: options.minify,
        format: 'esm'
      })

      if (!compilationResult.success || !compilationResult.bundle) {
        return { success: false, error: compilationResult.errors.join(', ') || 'Compilation failed' }
      }

      // Get dependencies
      const dependencyResolution = await this.dependencyManager.resolveDependencies(artifact.metadata.dependencies)
      const importMap = this.dependencyManager.generateImportMap(dependencyResolution.resolved)

      // Generate HTML template
      const html = this.generateHTMLTemplate(artifact, compilationResult.bundle, importMap, options)

      const exportTime = Date.now() - startTime
      const size = new Blob([html]).size

      logger.info(`HTML export completed for ${artifactId} in ${exportTime}ms`)

      return {
        success: true,
        data: html,
        metadata: {
          size,
          dependencies: artifact.metadata.dependencies,
          exportTime
        }
      }
    } catch (error) {
      logger.error('HTML export failed:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export artifact as TSX file
   */
  public async exportAsTSX(artifactId: string): Promise<ExportResult> {
    const startTime = Date.now()

    try {
      logger.info(`Exporting artifact ${artifactId} as TSX`)

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        return { success: false, error: 'Artifact not found' }
      }

      // Generate TSX content with proper imports and types
      const tsxContent = this.generateTSXContent(artifact)
      const exportTime = Date.now() - startTime
      const size = new Blob([tsxContent]).size

      logger.info(`TSX export completed for ${artifactId} in ${exportTime}ms`)

      return {
        success: true,
        data: tsxContent,
        metadata: {
          size,
          dependencies: artifact.metadata.dependencies,
          exportTime
        }
      }
    } catch (error) {
      logger.error('TSX export failed:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export artifact as complete package (ZIP)
   */
  public async exportAsPackage(artifactId: string, options: ExportOptions = {}): Promise<ExportResult> {
    const startTime = Date.now()

    try {
      logger.info(`Exporting artifact ${artifactId} as package`)

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        return { success: false, error: 'Artifact not found' }
      }

      const zip = new JSZip()

      // Add main component file
      const tsxContent = this.generateTSXContent(artifact)
      zip.file(`${artifact.metadata.title || 'Component'}.tsx`, tsxContent)

      // Add package.json
      const packageJson = this.generatePackageJson(artifact, options)
      zip.file('package.json', JSON.stringify(packageJson, null, 2))

      // Add README.md
      const readme = this.generateReadme(artifact)
      zip.file('README.md', readme)

      // Add TypeScript config if types are included
      if (options.includeTypes) {
        const tsConfig = this.generateTSConfig()
        zip.file('tsconfig.json', JSON.stringify(tsConfig, null, 2))
      }

      // Add HTML example
      const htmlExample = await this.exportAsHTML(artifactId, options)
      if (htmlExample.success && htmlExample.data) {
        zip.file('example.html', htmlExample.data as string)
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
      const buffer = Buffer.from(zipBuffer)

      const exportTime = Date.now() - startTime

      logger.info(`Package export completed for ${artifactId} in ${exportTime}ms`)

      return {
        success: true,
        data: buffer,
        metadata: {
          size: buffer.length,
          dependencies: artifact.metadata.dependencies,
          exportTime
        }
      }
    } catch (error) {
      logger.error('Package export failed:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate shareable link (placeholder for future implementation)
   */
  public async generateShareableLink(artifactId: string): Promise<ExportResult> {
    try {
      logger.info(`Generating shareable link for artifact ${artifactId}`)

      const artifact = await this.storage.getArtifact(artifactId)
      if (!artifact) {
        return { success: false, error: 'Artifact not found' }
      }

      // For now, generate a local file URL
      // In the future, this could upload to a sharing service
      const timestamp = Date.now()
      const shareableId = `${artifactId}-${timestamp}`
      const shareableLink = `cherry-studio://artifact/${shareableId}`

      logger.info(`Shareable link generated: ${shareableLink}`)

      return {
        success: true,
        data: shareableLink,
        metadata: {
          size: shareableLink.length,
          dependencies: artifact.metadata.dependencies,
          exportTime: 0
        }
      }
    } catch (error) {
      logger.error('Shareable link generation failed:', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private generateHTMLTemplate(
    artifact: ReactArtifact,
    compiledCode: string,
    importMap: Record<string, string>,
    options: ExportOptions
  ): string {
    const title = artifact.metadata.title || 'React Component'
    const description = artifact.metadata.description || 'Exported React component from Cherry Studio'

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">

    <!-- React and ReactDOM from CDN -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.${options.minify ? 'production.min' : 'development'}.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.${options.minify ? 'production.min' : 'development'}.js"></script>

    <!-- Import Map for dependencies -->
    <script type="importmap">
    {
      "imports": ${JSON.stringify(importMap, null, 2)}
    }
    </script>

    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background-color: #f5f5f5;
        }

        #root {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .error-boundary {
            padding: 20px;
            background-color: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c33;
        }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="module">
        ${compiledCode}

        // Error boundary
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
            }

            render() {
                if (this.state.hasError) {
                    return React.createElement('div', { className: 'error-boundary' },
                        React.createElement('h3', null, 'Component Error'),
                        React.createElement('p', null, this.state.error?.message || 'An error occurred')
                    );
                }
                return this.props.children;
            }
        }

        // Render the component
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
            React.createElement(ErrorBoundary, null,
                React.createElement(Component)
            )
        );
    </script>

    <!-- Generated by Cherry Studio Artifacts -->
    <script>
        console.log('Component exported from Cherry Studio');
        console.log('Artifact ID: ${artifact.id}');
        console.log('Export time: ${new Date().toISOString()}');
    </script>
</body>
</html>`
  }

  private generateTSXContent(artifact: ReactArtifact): string {
    const imports = artifact.metadata.dependencies
      .map((dep) => `import * as ${dep.replace(/[^a-zA-Z0-9]/g, '')} from '${dep}';`)
      .join('\n')

    const header = `/**
 * ${artifact.metadata.title || 'React Component'}
 * ${artifact.metadata.description || 'Exported from Cherry Studio'}
 *
 * Generated on: ${new Date().toISOString()}
 * Artifact ID: ${artifact.id}
 */

import React from 'react';
${imports}

`

    return header + artifact.code
  }

  private generatePackageJson(artifact: ReactArtifact, options: ExportOptions): any {
    const dependencies: Record<string, string> = {
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    }

    // Add artifact dependencies
    artifact.metadata.dependencies.forEach((dep) => {
      dependencies[dep] = 'latest'
    })

    return {
      name: artifact.metadata.title?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'react-component',
      version: '1.0.0',
      description: artifact.metadata.description || 'React component exported from Cherry Studio',
      main: `${artifact.metadata.title || 'Component'}.tsx`,
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch'
      },
      dependencies,
      devDependencies: options.includeTypes
        ? {
            '@types/react': '^18.0.0',
            '@types/react-dom': '^18.0.0',
            typescript: '^5.0.0'
          }
        : {},
      peerDependencies: {
        react: '>=16.8.0',
        'react-dom': '>=16.8.0'
      },
      keywords: ['react', 'component', 'cherry-studio'],
      author: 'Cherry Studio',
      license: 'MIT'
    }
  }

  private generateReadme(artifact: ReactArtifact): string {
    return `# ${artifact.metadata.title || 'React Component'}

${artifact.metadata.description || 'A React component exported from Cherry Studio.'}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`tsx
import React from 'react';
import Component from './${artifact.metadata.title || 'Component'}';

function App() {
  return (
    <div>
      <Component />
    </div>
  );
}

export default App;
\`\`\`

## Dependencies

${artifact.metadata.dependencies.map((dep) => `- ${dep}`).join('\n')}

## Generated by Cherry Studio

This component was created and exported using Cherry Studio's React Artifacts system.

- **Artifact ID**: ${artifact.id}
- **Created**: ${new Date(artifact.metadata.createdAt).toLocaleDateString()}
- **Last Modified**: ${new Date(artifact.metadata.updatedAt).toLocaleDateString()}
- **Version**: ${artifact.version}
`
  }

  private generateTSConfig(): any {
    return {
      compilerOptions: {
        target: 'es2020',
        lib: ['dom', 'dom.iterable', 'es6'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx'
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules']
    }
  }
}
