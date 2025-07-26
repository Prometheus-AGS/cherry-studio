# React Artifacts API Reference

Complete API documentation for the React Artifacts system in Cherry Studio.

## Table of Contents

1. [Core Interfaces](#core-interfaces)
2. [Service APIs](#service-apis)
3. [Component APIs](#component-apis)
4. [Hook APIs](#hook-apis)
5. [Utility APIs](#utility-apis)
6. [Error Types](#error-types)
7. [Configuration](#configuration)
8. [Events](#events)

## Core Interfaces

### ReactArtifact

```typescript
interface ReactArtifact {
  id: string
  code: string
  metadata: ArtifactMetadata
  version: number
  history: ArtifactHistory
}
```

**Properties:**
- `id`: Unique identifier for the artifact
- `code`: React component source code (TypeScript/JSX)
- `metadata`: Additional information about the artifact
- `version`: Current version number (incremented on changes)
- `history`: Version control history

### ArtifactMetadata

```typescript
interface ArtifactMetadata {
  title: string
  description: string
  props: Record<string, string>
  dependencies: string[]
  createdAt: string
  updatedAt: string
  tags?: string[]
  author?: string
  license?: string
}
```

**Properties:**
- `title`: Human-readable name for the artifact
- `description`: Brief description of functionality
- `props`: Component props with type information
- `dependencies`: Required npm packages
- `createdAt`: ISO timestamp of creation
- `updatedAt`: ISO timestamp of last modification
- `tags`: Optional categorization tags
- `author`: Optional author information
- `license`: Optional license information

### ArtifactHistory

```typescript
interface ArtifactHistory {
  versions: ArtifactVersion[]
  currentVersion: number
  totalVersions: number
}
```

### ArtifactVersion

```typescript
interface ArtifactVersion {
  version: number
  code: string
  metadata: ArtifactMetadata
  timestamp: string
  message?: string
  diff?: string
}
```

### SecurityValidationResult

```typescript
interface SecurityValidationResult {
  isSecure: boolean
  violations: SecurityViolation[]
  warnings: SecurityWarning[]
  score: number // 0-100
  recommendations: string[]
  timestamp: string
}
```

### SecurityViolation

```typescript
interface SecurityViolation {
  type: SecurityViolationType
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  line?: number
  column?: number
  code?: string
}
```

### CompilationResult

```typescript
interface CompilationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  bundle: string | null
  sourceMap: string | null
  compilationTime: number
}
```

## Service APIs

### ArtifactStorage

Manages persistent storage of artifacts.

#### Methods

##### `getInstance(): ArtifactStorage`
Returns the singleton instance.

##### `saveArtifact(artifact: ReactArtifact): Promise<void>`
Saves an artifact to storage.

**Parameters:**
- `artifact`: The artifact to save

**Returns:** Promise that resolves when save is complete

**Example:**
```typescript
const storage = ArtifactStorage.getInstance()
await storage.saveArtifact(artifact)
```

##### `getArtifact(id: string): Promise<ReactArtifact | null>`
Retrieves an artifact by ID.

**Parameters:**
- `id`: Artifact identifier

**Returns:** Promise resolving to artifact or null if not found

##### `deleteArtifact(id: string): Promise<void>`
Deletes an artifact from storage.

**Parameters:**
- `id`: Artifact identifier

**Returns:** Promise that resolves when deletion is complete

##### `loadArtifacts(): Promise<ReactArtifact[]>`
Loads all artifacts from storage.

**Returns:** Promise resolving to array of all artifacts

##### `searchArtifacts(query: string): Promise<ReactArtifact[]>`
Searches artifacts by title, description, or tags.

**Parameters:**
- `query`: Search query string

**Returns:** Promise resolving to matching artifacts

### ReactArtifactManager

Manages React artifacts within the MinApp system.

#### Methods

##### `getInstance(): ReactArtifactManager`
Returns the singleton instance.

##### `createArtifact(code: string, metadata: ArtifactMetadata): Promise<ReactArtifact>`
Creates a new React artifact.

**Parameters:**
- `code`: React component source code
- `metadata`: Artifact metadata

**Returns:** Promise resolving to created artifact

##### `updateArtifact(id: string, updates: Partial<ReactArtifact>): Promise<ReactArtifact>`
Updates an existing artifact.

**Parameters:**
- `id`: Artifact identifier
- `updates`: Partial artifact data to update

**Returns:** Promise resolving to updated artifact

##### `renderArtifact(id: string, props?: Record<string, unknown>): Promise<void>`
Renders an artifact in the MinApp grid.

**Parameters:**
- `id`: Artifact identifier
- `props`: Optional props to pass to component

**Returns:** Promise that resolves when rendering is complete

### ComponentCompiler

Compiles TypeScript/JSX code into executable JavaScript.

#### Methods

##### `getInstance(): ComponentCompiler`
Returns the singleton instance.

##### `compileArtifact(artifact: ReactArtifact, options?: CompilerOptions): Promise<CompilationResult>`
Compiles an artifact's code.

**Parameters:**
- `artifact`: Artifact to compile
- `options`: Optional compilation options

**Returns:** Promise resolving to compilation result

**Example:**
```typescript
const compiler = ComponentCompiler.getInstance()
const result = await compiler.compileArtifact(artifact, {
  generateSourceMap: true,
  minify: false
})

if (result.success) {
  console.log('Compiled successfully')
} else {
  console.error('Compilation errors:', result.errors)
}
```

### ComponentSandbox

Provides secure iframe-based rendering environment.

#### Methods

##### `getInstance(): ComponentSandbox`
Returns the singleton instance.

##### `createSandbox(artifactId: string, artifact: ReactArtifact): Promise<HTMLIFrameElement>`
Creates a secure sandbox for rendering.

**Parameters:**
- `artifactId`: Artifact identifier
- `artifact`: Artifact to render

**Returns:** Promise resolving to iframe element

##### `destroySandbox(artifactId: string): void`
Destroys a sandbox and cleans up resources.

**Parameters:**
- `artifactId`: Artifact identifier

##### `updateSandbox(artifactId: string, newCode: string): Promise<void>`
Updates sandbox with new code.

**Parameters:**
- `artifactId`: Artifact identifier
- `newCode`: Updated component code

**Returns:** Promise that resolves when update is complete

### ArtifactSecurityValidator

Validates artifacts for security compliance.

#### Methods

##### `getInstance(): ArtifactSecurityValidator`
Returns the singleton instance.

##### `validateArtifact(artifact: ReactArtifact): Promise<SecurityValidationResult>`
Performs comprehensive security validation.

**Parameters:**
- `artifact`: Artifact to validate

**Returns:** Promise resolving to validation result

**Example:**
```typescript
const validator = ArtifactSecurityValidator.getInstance()
const result = await validator.validateArtifact(artifact)

if (result.isSecure) {
  console.log('✅ Artifact is secure')
} else {
  console.log('❌ Security issues:', result.violations)
}
```

### ArtifactVersionManager

Manages version control for artifacts.

#### Methods

##### `getInstance(): ArtifactVersionManager`
Returns the singleton instance.

##### `createVersion(artifactId: string, code: string, message?: string): Promise<ArtifactVersion>`
Creates a new version of an artifact.

**Parameters:**
- `artifactId`: Artifact identifier
- `code`: Updated code
- `message`: Optional commit message

**Returns:** Promise resolving to new version

##### `getHistory(artifactId: string): Promise<ArtifactHistory>`
Gets version history for an artifact.

**Parameters:**
- `artifactId`: Artifact identifier

**Returns:** Promise resolving to version history

##### `rollbackToVersion(artifactId: string, version: number): Promise<ReactArtifact>`
Rolls back artifact to a specific version.

**Parameters:**
- `artifactId`: Artifact identifier
- `version`: Version number to rollback to

**Returns:** Promise resolving to rolled back artifact

### ArtifactEditService

Handles LLM-based conversational editing.

#### Methods

##### `getInstance(): ArtifactEditService`
Returns the singleton instance.

##### `processEditRequest(artifactId: string, request: EditRequest): Promise<EditResponse>`
Processes an edit request using LLM.

**Parameters:**
- `artifactId`: Artifact identifier
- `request`: Edit request details

**Returns:** Promise resolving to edit response

**Example:**
```typescript
const editService = ArtifactEditService.getInstance()
const response = await editService.processEditRequest('artifact-123', {
  type: 'modify',
  instruction: 'Add a loading spinner',
  context: 'User wants to show loading state'
})
```

### ArtifactDebugger

Provides debugging and diagnostic capabilities.

#### Methods

##### `getInstance(): ArtifactDebugger`
Returns the singleton instance.

##### `performDiagnostics(artifactId: string): Promise<DiagnosticResult>`
Performs comprehensive diagnostic analysis.

**Parameters:**
- `artifactId`: Artifact identifier

**Returns:** Promise resolving to diagnostic result

##### `profilePerformance(artifactId: string): Promise<PerformanceProfile>`
Profiles performance of artifact processing.

**Parameters:**
- `artifactId`: Artifact identifier

**Returns:** Promise resolving to performance profile

##### `startDebugSession(artifactId: string): Promise<string>`
Starts a new debugging session.

**Parameters:**
- `artifactId`: Artifact identifier

**Returns:** Promise resolving to session ID

## Component APIs

### ArtifactViewer

Main component for viewing and editing artifacts.

#### Props

```typescript
interface ArtifactViewerProps {
  artifactId: string
  initialLayout?: 'horizontal' | 'vertical'
  showToolbar?: boolean
  readOnly?: boolean
  onArtifactChange?: (artifact: ReactArtifact) => void
  onError?: (error: Error) => void
}
```

#### Methods

##### `refreshPreview(): void`
Refreshes the preview panel.

##### `toggleLayout(): void`
Toggles between horizontal and vertical layout.

##### `exportArtifact(format: ExportFormat): Promise<void>`
Exports the artifact in specified format.

### ArtifactCodeEditor

Code editor component with syntax highlighting.

#### Props

```typescript
interface ArtifactCodeEditorProps {
  code: string
  onChange: (code: string) => void
  language?: string
  theme?: string
  readOnly?: boolean
  showLineNumbers?: boolean
  wordWrap?: boolean
}
```

### ArtifactPreviewPanel

Live preview panel for rendered components.

#### Props

```typescript
interface ArtifactPreviewPanelProps {
  artifact: ReactArtifact
  props?: Record<string, unknown>
  onError?: (error: Error) => void
  onLoad?: () => void
}
```

## Hook APIs

### useReactArtifacts

React hook for managing artifacts.

```typescript
function useReactArtifacts(): {
  artifacts: ReactArtifact[]
  loading: boolean
  error: Error | null
  createArtifact: (code: string, metadata: ArtifactMetadata) => Promise<ReactArtifact>
  updateArtifact: (id: string, updates: Partial<ReactArtifact>) => Promise<ReactArtifact>
  deleteArtifact: (id: string) => Promise<void>
  refreshArtifacts: () => Promise<void>
}
```

**Example:**
```typescript
const {
  artifacts,
  loading,
  error,
  createArtifact,
  updateArtifact,
  deleteArtifact
} = useReactArtifacts()

// Create new artifact
const newArtifact = await createArtifact(code, metadata)

// Update existing artifact
await updateArtifact('artifact-123', { code: newCode })

// Delete artifact
await deleteArtifact('artifact-123')
```

## Utility APIs

### ArtifactDetectionService

Detects React artifacts in LLM responses.

#### Methods

##### `getInstance(): ArtifactDetectionService`
Returns the singleton instance.

##### `detectArtifacts(content: string): ArtifactDetection[]`
Detects artifacts in text content.

**Parameters:**
- `content`: Text content to analyze

**Returns:** Array of detected artifacts

##### `parseArtifactBlock(block: string): ParsedArtifact | null`
Parses a single artifact block.

**Parameters:**
- `block`: Artifact block text

**Returns:** Parsed artifact or null if invalid

### DependencyManager

Manages artifact dependencies.

#### Methods

##### `getInstance(): DependencyManager`
Returns the singleton instance.

##### `resolveDependencies(dependencies: string[]): Promise<DependencyResolution>`
Resolves artifact dependencies.

**Parameters:**
- `dependencies`: Array of dependency names

**Returns:** Promise resolving to resolution result

##### `validateDependency(name: string): boolean`
Validates if a dependency is allowed.

**Parameters:**
- `name`: Dependency name

**Returns:** True if dependency is allowed

## Error Types

### ArtifactError

Base error class for artifact-related errors.

```typescript
class ArtifactError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'ArtifactError'
  }
}
```

### CompilationError

Error thrown during compilation.

```typescript
class CompilationError extends ArtifactError {
  constructor(message: string, public location?: CodeLocation) {
    super(message, 'COMPILATION_ERROR')
  }
}
```

### SecurityError

Error thrown for security violations.

```typescript
class SecurityError extends ArtifactError {
  constructor(message: string, public violations: SecurityViolation[]) {
    super(message, 'SECURITY_ERROR')
  }
}
```

### ValidationError

Error thrown for validation failures.

```typescript
class ValidationError extends ArtifactError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR')
  }
}
```

## Configuration

### CompilerOptions

```typescript
interface CompilerOptions {
  generateSourceMap?: boolean
  minify?: boolean
  target?: 'es2015' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'esnext'
  format?: 'esm' | 'cjs' | 'iife'
  external?: string[]
}
```

### SecurityConfig

```typescript
interface SecurityConfig {
  enableStrictMode: boolean
  allowedDependencies: string[]
  dangerousPatterns: string[]
  maxCodeSize: number
  timeoutMs: number
}
```

### SandboxConfig

```typescript
interface SandboxConfig {
  cspHeaders: string[]
  allowedOrigins: string[]
  memoryLimit: number
  executionTimeout: number
}
```

## Events

### ArtifactEvents

Event system for artifact lifecycle.

```typescript
interface ArtifactEvents {
  'artifact:created': (artifact: ReactArtifact) => void
  'artifact:updated': (artifact: ReactArtifact) => void
  'artifact:deleted': (artifactId: string) => void
  'artifact:compiled': (result: CompilationResult) => void
  'artifact:validated': (result: SecurityValidationResult) => void
  'artifact:rendered': (artifactId: string) => void
  'artifact:error': (error: ArtifactError) => void
}
```

**Example:**
```typescript
import { artifactEventBus } from '@renderer/services/ArtifactEventBus'

// Listen for artifact creation
artifactEventBus.on('artifact:created', (artifact) => {
  console.log('New artifact created:', artifact.id)
})

// Listen for compilation results
artifactEventBus.on('artifact:compiled', (result) => {
  if (result.success) {
    console.log('Compilation successful')
  } else {
    console.error('Compilation failed:', result.errors)
  }
})
```

## Best Practices

### Error Handling

Always wrap artifact operations in try-catch blocks:

```typescript
try {
  const artifact = await artifactManager.createArtifact(code, metadata)
  console.log('Artifact created successfully')
} catch (error) {
  if (error instanceof SecurityError) {
    console.error('Security violation:', error.violations)
  } else if (error instanceof CompilationError) {
    console.error('Compilation failed:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

### Performance Optimization

Use debouncing for real-time updates:

```typescript
import { debounce } from 'lodash'

const debouncedUpdate = debounce(async (code: string) => {
  await artifactManager.updateArtifact(artifactId, { code })
}, 500)

// Use in editor onChange
const handleCodeChange = (newCode: string) => {
  setCode(newCode)
  debouncedUpdate(newCode)
}
```

### Security Guidelines

Always validate artifacts before rendering:

```typescript
const validator = ArtifactSecurityValidator.getInstance()
const result = await validator.validateArtifact(artifact)

if (!result.isSecure) {
  throw new SecurityError('Artifact failed security validation', result.violations)
}

// Safe to render
await sandbox.createSandbox(artifact.id, artifact)
```

---

*This API reference is maintained by the Cherry Studio development team. Last updated: 2025-01-26*
