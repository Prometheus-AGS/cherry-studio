# React Artifacts Developer Guide

This guide provides comprehensive documentation for developers working with the React Artifacts system in Cherry Studio.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Core Services](#core-services)
4. [Component Development](#component-development)
5. [Security Guidelines](#security-guidelines)
6. [Testing & Validation](#testing--validation)
7. [Debugging & Troubleshooting](#debugging--troubleshooting)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)
10. [Contributing](#contributing)

## Quick Start

### Creating Your First Artifact

```typescript
import { ReactArtifactManager } from '@renderer/services/ReactArtifactManager'

const manager = ReactArtifactManager.getInstance()

// Create a simple component
const code = `
import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div\`
  padding: 20px;
  border-radius: 8px;
  background: #f5f5f5;
\`;

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <Container>
      <h2>Counter: {count}</h2>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </Container>
  );
};

export default Counter;
`

const metadata = {
  title: 'Simple Counter',
  description: 'A basic counter component',
  props: {},
  dependencies: ['react', 'styled-components'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// Create the artifact
const artifact = await manager.createArtifact(code, metadata)
console.log('Artifact created:', artifact.id)
```

### Validating Security

```typescript
import { ArtifactSecurityValidator } from '@renderer/services/ArtifactSecurityValidator'

const validator = ArtifactSecurityValidator.getInstance()
const result = await validator.validateArtifact(artifact)

if (result.isSecure) {
  console.log('✅ Artifact is secure')
} else {
  console.log('❌ Security issues found:', result.violations)
}
```

### Running Tests

```typescript
import { ArtifactTestRunner } from '@renderer/services/__tests__/ArtifactTestRunner'

const testRunner = ArtifactTestRunner.getInstance()
const testResult = await testRunner.runComprehensiveTests(artifact)

console.log('Test Results:', testResult.summary)
```

## Architecture Overview

The React Artifacts system is built with a modular architecture consisting of several key layers:

### Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  ArtifactViewer  │  ArtifactToolbar  │  Version History    │
├─────────────────────────────────────────────────────────────┤
│                   Service Layer                             │
├─────────────────────────────────────────────────────────────┤
│ ReactArtifactManager │ ArtifactEditService │ VersionManager │
├─────────────────────────────────────────────────────────────┤
│                  Security Layer                             │
├─────────────────────────────────────────────────────────────┤
│ SecurityValidator │ SecurityAuditor │ ComponentSandbox     │
├─────────────────────────────────────────────────────────────┤
│                  Storage Layer                              │
├─────────────────────────────────────────────────────────────┤
│    ArtifactStorage    │    VersionManager    │    Cache     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Artifact Creation**: LLM generates code → Detection service parses → Storage saves
2. **Security Validation**: Multi-layer security analysis → Risk assessment → Approval/Rejection
3. **Compilation**: TypeScript/JSX transformation → Dependency resolution → Bundle generation
4. **Rendering**: Secure sandbox creation → Component mounting → Error boundary protection
5. **Version Control**: Change tracking → Diff generation → History management

## Core Services

### ArtifactStorage

Handles persistent storage of artifacts and their metadata.

```typescript
import { ArtifactStorage } from '@renderer/services/ArtifactStorage'

const storage = ArtifactStorage.getInstance()

// Save artifact
await storage.saveArtifact(artifact)

// Load artifact
const artifact = await storage.getArtifact('artifact-id')

// Delete artifact
await storage.deleteArtifact('artifact-id')

// Load all artifacts
const artifacts = await storage.loadArtifacts()
```

### ComponentCompiler

Compiles TypeScript/JSX code into executable JavaScript.

```typescript
import { ComponentCompiler } from '@renderer/services/ComponentCompiler'

const compiler = ComponentCompiler.getInstance()

const result = await compiler.compileArtifact(artifact, {
  generateSourceMap: true,
  minify: false
})

if (result.success) {
  console.log('Compiled successfully:', result.bundle)
} else {
  console.log('Compilation errors:', result.errors)
}
```

### ComponentSandbox

Provides secure iframe-based rendering environment.

```typescript
import { ComponentSandbox } from '@renderer/services/ComponentSandbox'

const sandbox = ComponentSandbox.getInstance()

// Create secure sandbox
const iframe = await sandbox.createSandbox('artifact-id', artifact)

// Destroy sandbox
sandbox.destroySandbox('artifact-id')
```

### ArtifactVersionManager

Manages version control and history tracking.

```typescript
import { ArtifactVersionManager } from '@renderer/services/ArtifactVersionManager'

const versionManager = ArtifactVersionManager.getInstance()

// Create new version
const version = await versionManager.createVersion(
  'artifact-id',
  newCode,
  'Updated styling'
)

// Get version history
const history = await versionManager.getHistory('artifact-id')

// Rollback to previous version
const rolledBack = await versionManager.rollbackToVersion('artifact-id', 2)
```

## Component Development

### Supported Features

The React Artifacts system supports a comprehensive set of React features:

- **Hooks**: useState, useEffect, useCallback, useMemo, useRef, custom hooks
- **Styling**: styled-components, inline styles, CSS modules
- **TypeScript**: Full TypeScript support with type checking
- **Props**: Interface definitions and prop validation
- **Event Handling**: onClick, onChange, onSubmit, etc.
- **Conditional Rendering**: Ternary operators, logical AND, if statements
- **Lists**: map(), filter(), reduce() with proper key props

### Whitelisted Dependencies

Only these dependencies are allowed for security:

```typescript
const allowedDependencies = [
  'react',
  'react-dom',
  'styled-components',
  'lodash',
  'dayjs',
  'uuid'
]
```

### Component Template

```typescript
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Define props interface
interface ComponentProps {
  title?: string;
  initialValue?: number;
  onValueChange?: (value: number) => void;
}

// Styled components
const Container = styled.div`
  padding: 20px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  color: #333;
  margin-bottom: 16px;
`;

// Main component
const MyComponent: React.FC<ComponentProps> = ({
  title = 'Default Title',
  initialValue = 0,
  onValueChange
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    onValueChange?.(value);
  }, [value, onValueChange]);

  const handleIncrement = () => {
    setValue(prev => prev + 1);
  };

  return (
    <Container>
      <Title>{title}</Title>
      <p>Current value: {value}</p>
      <button onClick={handleIncrement}>
        Increment
      </button>
    </Container>
  );
};

export default MyComponent;
```

## Security Guidelines

### Prohibited Patterns

❌ **Never use these patterns:**

```typescript
// Code injection
eval('malicious code')
new Function('return malicious code')()

// XSS vectors
<div dangerouslySetInnerHTML={{__html: userInput}} />
<script>alert('xss')</script>

// Network requests
fetch('https://malicious-site.com')
XMLHttpRequest()

// File access
new FileReader()
window.open('file://')

// Privilege escalation
window.parent.postMessage()
window.top.location
```

✅ **Use these safe alternatives:**

```typescript
// Safe rendering
<div>{sanitizedContent}</div>

// Safe event handling
const handleClick = useCallback(() => {
  // Safe logic here
}, []);

// Safe styling
const StyledDiv = styled.div`
  color: ${props => props.theme.primary};
`;
```

### Security Validation

All artifacts undergo automatic security validation:

1. **Static Analysis**: AST parsing for dangerous patterns
2. **Pattern Matching**: Regex-based threat detection
3. **Dependency Validation**: Whitelist enforcement
4. **Runtime Protection**: Sandbox isolation
5. **Content Security Policy**: Strict CSP headers

## Testing & Validation

### Running Tests

```typescript
import { ArtifactTestSuite } from '@renderer/services/__tests__/ArtifactTestSuite'

const testSuite = ArtifactTestSuite.getInstance()

// Run all tests
const result = await testSuite.runFullTestSuite()

console.log(`Tests: ${result.passedTests}/${result.totalTests} passed`)
console.log(`Coverage: ${result.coverage.overall}%`)
```

### Security Audit

```typescript
import { ArtifactSecurityAuditor } from '@renderer/services/ArtifactSecurityAuditor'

const auditor = ArtifactSecurityAuditor.getInstance()
const audit = await auditor.performSecurityAudit(artifact)

console.log(`Security Score: ${audit.complianceScore}%`)
console.log(`Risk Level: ${audit.overallRisk}`)
console.log(`Findings: ${audit.findings.length}`)
```

### Quick Validation

```typescript
import { ArtifactTestRunner } from '@renderer/services/__tests__/ArtifactTestRunner'

const runner = ArtifactTestRunner.getInstance()
const validation = await runner.quickValidation(artifact)

if (validation.isValid) {
  console.log('✅ Ready for development')
} else {
  console.log('❌ Issues found:', validation.criticalIssues)
}
```

## Debugging & Troubleshooting

### Common Issues

#### 1. Compilation Errors

**Problem**: TypeScript compilation fails
```
Error: Cannot find module 'react'
```

**Solution**: Ensure React is in dependencies
```typescript
const metadata = {
  // ...
  dependencies: ['react', 'react-dom'] // Add missing dependencies
}
```

#### 2. Security Violations

**Problem**: Security validation fails
```
Security violation: eval usage detected
```

**Solution**: Remove dangerous patterns
```typescript
// ❌ Don't do this
const result = eval(userInput)

// ✅ Do this instead
const result = safeFunction(userInput)
```

#### 3. Sandbox Errors

**Problem**: Component doesn't render in sandbox
```
Error: Cannot access parent window
```

**Solution**: Remove privileged access attempts
```typescript
// ❌ Don't do this
window.parent.postMessage('data', '*')

// ✅ Do this instead
// Use props or state for communication
```

### Debug Tools

#### Enable Debug Logging

```typescript
import { loggerService } from '@logger'

const logger = loggerService.withContext('ArtifactDebug')
logger.setLevel('debug')

// Your code here
logger.debug('Artifact processing started', { artifactId })
```

#### Performance Monitoring

```typescript
import { ArtifactPerformanceMonitor } from '@renderer/services/ArtifactPerformanceMonitor'

const monitor = ArtifactPerformanceMonitor.getInstance()

// Start monitoring
const sessionId = await monitor.startMonitoring('artifact-id')

// Your code here

// Get metrics
const metrics = await monitor.getMetrics(sessionId)
console.log('Performance:', metrics)
```

## API Reference

### ReactArtifact Interface

```typescript
interface ReactArtifact {
  id: string
  code: string
  metadata: {
    title: string
    description: string
    props: Record<string, string>
    dependencies: string[]
    createdAt: string
    updatedAt: string
  }
  version: number
  history: ArtifactHistory
}
```

### SecurityValidationResult Interface

```typescript
interface SecurityValidationResult {
  isSecure: boolean
  violations: SecurityViolation[]
  warnings: SecurityWarning[]
  score: number // 0-100
  recommendations: string[]
}
```

### TestSuiteResult Interface

```typescript
interface TestSuiteResult {
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  results: TestResult[]
  coverage: TestCoverage
}
```

## Best Practices

### 1. Component Design

- **Single Responsibility**: Each component should have one clear purpose
- **Props Interface**: Always define TypeScript interfaces for props
- **Error Boundaries**: Handle errors gracefully
- **Accessibility**: Include ARIA labels and semantic HTML
- **Performance**: Use React.memo, useCallback, useMemo when appropriate

### 2. Security

- **Input Validation**: Validate all props and user inputs
- **Safe Rendering**: Never use dangerouslySetInnerHTML
- **Dependency Management**: Only use whitelisted dependencies
- **Code Review**: Always review generated code before deployment

### 3. Testing

- **Comprehensive Coverage**: Test all component functionality
- **Security Testing**: Validate security requirements
- **Performance Testing**: Monitor resource usage
- **Edge Cases**: Test with empty, null, and invalid inputs

### 4. Version Control

- **Meaningful Messages**: Use descriptive commit messages
- **Incremental Changes**: Make small, focused changes
- **Rollback Strategy**: Always test rollback procedures
- **History Preservation**: Maintain complete version history

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start development server: `npm run dev`

### Code Standards

- Follow ESLint configuration
- Use TypeScript for all new code
- Write comprehensive tests
- Document all public APIs
- Follow security guidelines

### Pull Request Process

1. Create feature branch
2. Implement changes with tests
3. Run security validation
4. Update documentation
5. Submit pull request
6. Address review feedback

## Support

For questions and support:

- **Documentation**: Check this guide and API reference
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions
- **Security**: Report security issues privately

---

*This guide is maintained by the Cherry Studio development team. Last updated: 2025-01-26*
