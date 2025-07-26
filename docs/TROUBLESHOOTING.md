# React Artifacts Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the React Artifacts system in Cherry Studio.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Error Messages](#error-messages)
4. [Performance Issues](#performance-issues)
5. [Security Problems](#security-problems)
6. [Development Issues](#development-issues)
7. [Debug Tools](#debug-tools)
8. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check

Run a quick health check on your artifacts system:

```typescript
import { ArtifactDebugger } from '@renderer/services/ArtifactDebugger'

const debugger = ArtifactDebugger.getInstance()

// Quick validation
const validation = await debugger.quickValidation(artifactId)
if (!validation.isValid) {
  console.log('Issues found:', validation.criticalIssues)
}
```

### System Status

Check if all services are running properly:

```typescript
import { ReactArtifactManager } from '@renderer/services/ReactArtifactManager'
import { ComponentCompiler } from '@renderer/services/ComponentCompiler'
import { ArtifactSecurityValidator } from '@renderer/services/ArtifactSecurityValidator'

// Check service availability
const manager = ReactArtifactManager.getInstance()
const compiler = ComponentCompiler.getInstance()
const validator = ArtifactSecurityValidator.getInstance()

console.log('Services initialized:', {
  manager: !!manager,
  compiler: !!compiler,
  validator: !!validator
})
```

## Common Issues

### 1. Artifact Won't Compile

**Symptoms:**
- Compilation errors in console
- Empty preview panel
- Error messages about missing modules

**Causes & Solutions:**

#### Missing Dependencies
```typescript
// Check if all dependencies are declared
const artifact = await storage.getArtifact(artifactId)
const usedDeps = extractUsedDependencies(artifact.code)
const missing = usedDeps.filter(dep => !artifact.metadata.dependencies.includes(dep))

if (missing.length > 0) {
  console.log('Missing dependencies:', missing)
  // Add missing dependencies to metadata
  artifact.metadata.dependencies.push(...missing)
  await storage.saveArtifact(artifact)
}
```

#### Syntax Errors
```typescript
// Common syntax issues:
// ❌ Missing semicolons
const value = 'hello'
const other = 'world'

// ❌ Unclosed brackets
const Component = () => {
  return <div>Hello</div>
// Missing closing bracket

// ❌ Invalid JSX
return <div>
  <span>Text</span>
  // Missing closing div tag

// ✅ Correct syntax
const Component = () => {
  return (
    <div>
      <span>Text</span>
    </div>
  );
};
```

#### TypeScript Errors
```typescript
// ❌ Missing type definitions
const handleClick = (event) => { // Missing type for event
  console.log(event.target.value)
}

// ✅ Proper typing
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  console.log(event.currentTarget.textContent)
}
```

### 2. Security Validation Failures

**Symptoms:**
- Red security warnings
- Artifact blocked from rendering
- Security score below 80%

**Common Violations & Fixes:**

#### Dangerous Functions
```typescript
// ❌ Don't use eval
const result = eval(userInput)

// ✅ Use safe alternatives
const result = JSON.parse(userInput)
```

#### XSS Vectors
```typescript
// ❌ Dangerous HTML injection
<div dangerouslySetInnerHTML={{__html: userContent}} />

// ✅ Safe rendering
<div>{sanitizedContent}</div>
```

#### Network Requests
```typescript
// ❌ Network requests not allowed
fetch('/api/data')
  .then(response => response.json())

// ✅ Use props or mock data
const data = props.data || mockData
```

### 3. Preview Not Loading

**Symptoms:**
- Blank preview panel
- Loading spinner never stops
- Console errors about iframe

**Solutions:**

#### Check Sandbox Creation
```typescript
import { ComponentSandbox } from '@renderer/services/ComponentSandbox'

const sandbox = ComponentSandbox.getInstance()

try {
  const iframe = await sandbox.createSandbox(artifactId, artifact)
  console.log('Sandbox created successfully:', iframe)
} catch (error) {
  console.error('Sandbox creation failed:', error)
  // Check if artifact is valid and secure
}
```

#### Verify Compilation
```typescript
import { ComponentCompiler } from '@renderer/services/ComponentCompiler'

const compiler = ComponentCompiler.getInstance()
const result = await compiler.compileArtifact(artifact)

if (!result.success) {
  console.error('Compilation failed:', result.errors)
  // Fix compilation errors first
}
```

### 4. Version Control Issues

**Symptoms:**
- Can't create new versions
- Rollback fails
- Version history missing

**Solutions:**

#### Check Version Manager
```typescript
import { ArtifactVersionManager } from '@renderer/services/ArtifactVersionManager'

const versionManager = ArtifactVersionManager.getInstance()

try {
  const history = await versionManager.getHistory(artifactId)
  console.log('Version history:', history)
} catch (error) {
  console.error('Version manager error:', error)
  // Reinitialize version tracking
}
```

#### Fix Corrupted History
```typescript
// If version history is corrupted, reinitialize
const artifact = await storage.getArtifact(artifactId)
if (!artifact.history || artifact.history.versions.length === 0) {
  // Create initial version
  await versionManager.createVersion(
    artifactId,
    artifact.code,
    'Initial version (recovered)'
  )
}
```

### 5. Performance Problems

**Symptoms:**
- Slow compilation
- High memory usage
- UI freezing during operations

**Solutions:**

#### Optimize Large Components
```typescript
// ❌ Large monolithic component
const HugeComponent = () => {
  // 1000+ lines of code
  return <div>...</div>
}

// ✅ Break into smaller components
const Header = () => <header>...</header>
const Content = () => <main>...</main>
const Footer = () => <footer>...</footer>

const OptimizedComponent = () => (
  <div>
    <Header />
    <Content />
    <Footer />
  </div>
)
```

#### Use Performance Monitoring
```typescript
import { ArtifactPerformanceMonitor } from '@renderer/services/ArtifactPerformanceMonitor'

const monitor = ArtifactPerformanceMonitor.getInstance()
const sessionId = await monitor.startMonitoring(artifactId)

// Your operations here

const metrics = await monitor.getMetrics(sessionId)
console.log('Performance metrics:', metrics)
```

## Error Messages

### Compilation Errors

#### "Cannot find module 'react'"
**Cause:** React not in dependencies
**Solution:**
```typescript
artifact.metadata.dependencies.push('react', 'react-dom')
await storage.saveArtifact(artifact)
```

#### "Unexpected token '<'"
**Cause:** JSX syntax in non-JSX file
**Solution:** Ensure file is treated as JSX/TSX

#### "Type 'string' is not assignable to type 'number'"
**Cause:** TypeScript type mismatch
**Solution:** Fix type annotations or use type assertions

### Security Errors

#### "Dangerous function detected: eval"
**Cause:** Use of eval() function
**Solution:** Replace with safe alternatives like JSON.parse()

#### "XSS vector detected"
**Cause:** Unsafe HTML rendering
**Solution:** Use safe rendering methods

#### "Network request blocked"
**Cause:** Attempted HTTP request
**Solution:** Remove network calls, use props or mock data

### Runtime Errors

#### "Cannot read property 'map' of undefined"
**Cause:** Trying to map over undefined array
**Solution:**
```typescript
// ❌ Unsafe
items.map(item => <div key={item.id}>{item.name}</div>)

// ✅ Safe
(items || []).map(item => <div key={item.id}>{item.name}</div>)
```

#### "Maximum update depth exceeded"
**Cause:** Infinite re-render loop
**Solution:**
```typescript
// ❌ Causes infinite loop
const [count, setCount] = useState(0)
setCount(count + 1) // Called on every render

// ✅ Proper usage
const handleClick = () => {
  setCount(count + 1)
}
```

## Performance Issues

### Slow Compilation

**Diagnosis:**
```typescript
const debugger = ArtifactDebugger.getInstance()
const profile = await debugger.profilePerformance(artifactId)

if (profile.phases.compilation > 1000) {
  console.log('Slow compilation detected')
  console.log('Bottlenecks:', profile.bottlenecks)
  console.log('Optimizations:', profile.optimizations)
}
```

**Solutions:**
1. Reduce component complexity
2. Minimize dependencies
3. Optimize TypeScript configuration
4. Use code splitting

### Memory Leaks

**Diagnosis:**
```typescript
// Monitor memory usage
const monitor = ArtifactPerformanceMonitor.getInstance()
const metrics = await monitor.getMetrics(sessionId)

if (metrics.memoryUsage > 100) { // MB
  console.warn('High memory usage detected')
}
```

**Solutions:**
1. Clean up event listeners
2. Cancel pending promises
3. Destroy unused sandboxes
4. Clear old debug sessions

### UI Freezing

**Causes:**
- Synchronous heavy operations
- Large DOM updates
- Memory pressure

**Solutions:**
```typescript
// ❌ Synchronous heavy operation
const processLargeData = (data) => {
  return data.map(item => heavyProcessing(item))
}

// ✅ Asynchronous with batching
const processLargeData = async (data) => {
  const results = []
  for (let i = 0; i < data.length; i += 100) {
    const batch = data.slice(i, i + 100)
    const batchResults = batch.map(item => heavyProcessing(item))
    results.push(...batchResults)

    // Yield control to browser
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  return results
}
```

## Security Problems

### Failed Security Validation

**Diagnosis:**
```typescript
const validator = ArtifactSecurityValidator.getInstance()
const result = await validator.validateArtifact(artifact)

console.log('Security score:', result.score)
console.log('Violations:', result.violations)
console.log('Recommendations:', result.recommendations)
```

**Common Fixes:**

#### Remove Dangerous Patterns
```typescript
// Remove eval, Function constructor, etc.
// Replace with safe alternatives
```

#### Sanitize User Input
```typescript
// ❌ Direct rendering
<div>{userInput}</div>

// ✅ Sanitized rendering
<div>{sanitizeInput(userInput)}</div>
```

#### Use Allowed Dependencies Only
```typescript
const allowedDeps = ['react', 'react-dom', 'styled-components', 'lodash', 'dayjs', 'uuid']
const disallowed = artifact.metadata.dependencies.filter(dep => !allowedDeps.includes(dep))

if (disallowed.length > 0) {
  console.log('Remove disallowed dependencies:', disallowed)
}
```

## Development Issues

### Hot Reload Not Working

**Symptoms:**
- Changes not reflected in preview
- Need to manually refresh

**Solutions:**
1. Check if file watching is enabled
2. Verify artifact update triggers
3. Clear browser cache
4. Restart development server

### TypeScript Errors

**Common Issues:**

#### Missing Type Definitions
```typescript
// Install type definitions
npm install @types/react @types/react-dom
```

#### Strict Mode Issues
```typescript
// Configure tsconfig.json
{
  "compilerOptions": {
    "strict": false, // Temporarily disable for debugging
    "noImplicitAny": false
  }
}
```

### Import/Export Issues

**ES Module vs CommonJS:**
```typescript
// ❌ Mixed module systems
const React = require('react') // CommonJS
import { useState } from 'react' // ES Module

// ✅ Consistent ES Modules
import React, { useState } from 'react'
```

## Debug Tools

### Enable Debug Logging

```typescript
import { loggerService } from '@logger'

// Enable debug level logging
const logger = loggerService.withContext('ArtifactDebug')
logger.setLevel('debug')

// Log artifact operations
logger.debug('Artifact processing started', { artifactId })
```

### Use Debug Session

```typescript
const debugger = ArtifactDebugger.getInstance()
const sessionId = await debugger.startDebugSession(artifactId)

// Your operations here
debugger.addLog(sessionId, 'info', 'Custom debug message')

// Export logs for analysis
const logs = debugger.exportDebugLogs(sessionId)
console.log('Debug logs:', logs)
```

### Performance Profiling

```typescript
const profile = await debugger.profilePerformance(artifactId)
console.log('Performance profile:', {
  phases: profile.phases,
  bottlenecks: profile.bottlenecks,
  optimizations: profile.optimizations
})
```

### Comprehensive Diagnostics

```typescript
const diagnostics = await debugger.performDiagnostics(artifactId)
console.log('Diagnostic result:', {
  status: diagnostics.status,
  issues: diagnostics.issues,
  recommendations: diagnostics.recommendations
})
```

## Getting Help

### Check Documentation

1. [Developer Guide](./DEVELOPER_GUIDE.md) - Comprehensive development guide
2. [API Reference](./API_REFERENCE.md) - Complete API documentation
3. [Technical Specification](./ARTIFACTS.md) - System architecture details

### Debug Information

When reporting issues, include:

```typescript
// System information
const systemInfo = {
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
  artifactId: 'your-artifact-id',
  version: 'cherry-studio-version'
}

// Error details
const errorInfo = {
  message: error.message,
  stack: error.stack,
  code: error.code // if available
}

// Artifact state
const artifactState = {
  code: artifact.code.substring(0, 500), // First 500 chars
  metadata: artifact.metadata,
  version: artifact.version
}

console.log('Debug information:', {
  system: systemInfo,
  error: errorInfo,
  artifact: artifactState
})
```

### Common Support Channels

1. **GitHub Issues** - For bugs and feature requests
2. **Documentation** - Check existing guides first
3. **Community Forums** - For general questions
4. **Debug Logs** - Always include relevant logs

### Before Reporting Issues

1. ✅ Check this troubleshooting guide
2. ✅ Review error messages carefully
3. ✅ Try basic diagnostics
4. ✅ Check if issue is reproducible
5. ✅ Gather debug information
6. ✅ Search existing issues

---

*This troubleshooting guide is maintained by the Cherry Studio development team. Last updated: 2025-01-26*
