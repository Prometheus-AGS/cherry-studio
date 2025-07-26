import { loggerService } from '@logger'
import { ConversationContext } from '@renderer/types'

const logger = loggerService.withContext('SystemPromptManager')

export class SystemPromptManager {
  private static instance: SystemPromptManager
  private basePrompt: string = ''

  public static getInstance(): SystemPromptManager {
    if (!SystemPromptManager.instance) {
      SystemPromptManager.instance = new SystemPromptManager()
    }
    return SystemPromptManager.instance
  }

  /**
   * Core system prompt for React artifact generation
   */
  private readonly ARTIFACT_SYSTEM_PROMPT = `
You are an AI assistant with React artifact generation capabilities. When users request interactive components, demos, or UI elements, you should create React artifacts using the following protocol:

## Artifact Creation Guidelines

1. **When to Create Artifacts:**
   - User requests an interactive component or demo
   - User asks for a UI element or widget
   - User wants to visualize data or create a tool
   - User requests a form, calculator, or interactive example
   - User mentions creating React components

2. **Artifact Format:**
   Use this exact structure for React artifacts:

   \`\`\`artifact:react
   {
     "title": "Component Name",
     "description": "Brief description of what this component does",
     "props": {
       "propName": "type",
       "anotherProp": "type"
     },
     "dependencies": ["react", "styled-components"],
     "tags": ["interactive", "demo"]
   }
   \`\`\`tsx
   [Complete React component code here]
   \`\`\`

3. **Code Requirements:**
   - Use functional components with hooks
   - Include proper TypeScript types
   - Use styled-components for styling
   - Implement proper error handling
   - Make components responsive
   - Include meaningful prop defaults
   - Add accessibility attributes

4. **Security Guidelines:**
   - Only use whitelisted dependencies: react, react-dom, styled-components, lodash, dayjs, uuid
   - No external API calls or network requests
   - No dangerous patterns (eval, innerHTML, etc.)
   - No file system access

5. **Best Practices:**
   - Keep components self-contained
   - Use clear, descriptive variable names
   - Include helpful comments
   - Implement proper loading and error states
   - Make components reusable and configurable

## Example Artifact:

\`\`\`artifact:react
{
  "title": "Color Picker",
  "description": "An interactive color picker with hex and RGB display",
  "props": {
    "initialColor": "string",
    "onChange": "function"
  },
  "dependencies": ["react", "styled-components"],
  "tags": ["color", "picker", "interactive"]
}
\`\`\`tsx
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';

const Container = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  background: #f5f5f5;
  max-width: 300px;
\`;

const ColorInput = styled.input\`
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
\`;

const ColorDisplay = styled.div\`
  display: flex;
  align-items: center;
  gap: 12px;
\`;

const ColorSwatch = styled.div<{ color: string }>\`
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: \${props => props.color};
  border: 2px solid #ddd;
\`;

const ColorInfo = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: monospace;
  font-size: 14px;
\`;

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ?
    \`rgb(\${parseInt(result[1], 16)}, \${parseInt(result[2], 16)}, \${parseInt(result[3], 16)})\` :
    'Invalid';
};

interface ColorPickerProps {
  initialColor?: string;
  onChange?: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  initialColor = '#ff0000',
  onChange
}) => {
  const [color, setColor] = useState(initialColor);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    onChange?.(newColor);
  }, [onChange]);

  return (
    <Container>
      <ColorInput
        type="color"
        value={color}
        onChange={(e) => handleColorChange(e.target.value)}
      />
      <ColorDisplay>
        <ColorSwatch color={color} />
        <ColorInfo>
          <div>Hex: {color}</div>
          <div>RGB: {hexToRgb(color)}</div>
        </ColorInfo>
      </ColorDisplay>
    </Container>
  );
};

export default ColorPicker;
\`\`\`

Remember: Always create artifacts when users request interactive elements, and follow the exact format specified above.
`

  /**
   * Set the base system prompt
   */
  setBasePrompt(prompt: string): void {
    this.basePrompt = prompt
    logger.info('Base system prompt updated')
  }

  /**
   * Generate enhanced prompt with artifact capabilities
   */
  generateEnhancedPrompt(userMessage: string, context?: ConversationContext): string {
    const shouldEnableArtifacts = this.shouldEnableArtifacts(userMessage, context)

    if (shouldEnableArtifacts) {
      const enhancedPrompt = `${this.basePrompt}\n\n${this.ARTIFACT_SYSTEM_PROMPT}\n\nUser: ${userMessage}`
      logger.info('Generated enhanced prompt with artifact capabilities')
      return enhancedPrompt
    }

    return `${this.basePrompt}\n\nUser: ${userMessage}`
  }

  /**
   * Determine if artifacts should be enabled for this message
   */
  shouldEnableArtifacts(message: string, context?: ConversationContext): boolean {
    // Check for explicit artifact requests
    if (message.includes('artifact:react') || message.includes('create component')) {
      return true
    }

    // Check context for existing artifacts
    if (context?.hasArtifacts || context?.lastMessageContainedArtifact) {
      return true
    }

    // Check for artifact trigger phrases
    const artifactTriggers = [
      /create.*component/i,
      /build.*interface/i,
      /make.*interactive/i,
      /show.*example/i,
      /demo/i,
      /calculator/i,
      /form/i,
      /widget/i,
      /tool/i,
      /visualize/i,
      /chart/i,
      /graph/i,
      /react.*component/i,
      /tsx.*component/i,
      /interactive.*element/i,
      /ui.*component/i,
      /user.*interface/i,
      /dashboard/i,
      /app/i,
      /application/i
    ]

    const shouldEnable = artifactTriggers.some((trigger) => trigger.test(message))

    if (shouldEnable) {
      logger.info('Artifact triggers detected in message')
    }

    return shouldEnable
  }

  /**
   * Get artifact-specific instructions for different component types
   */
  getComponentTypeInstructions(componentType: string): string {
    const instructions: Record<string, string> = {
      form: `
Additional Form Component Guidelines:
- Use controlled components with useState
- Implement proper form validation
- Include submit and reset functionality
- Add loading states for async operations
- Use semantic HTML form elements
`,

      chart: `
Additional Chart Component Guidelines:
- Create responsive visualizations
- Use SVG for scalable graphics
- Implement hover interactions
- Add proper data validation
- Include legend and axis labels
`,

      calculator: `
Additional Calculator Component Guidelines:
- Implement proper mathematical operations
- Handle edge cases (division by zero, etc.)
- Use a clear display for results
- Add keyboard support
- Include memory functions if appropriate
`,

      dashboard: `
Additional Dashboard Component Guidelines:
- Create a responsive grid layout
- Use cards for different sections
- Implement data filtering and sorting
- Add loading states for data
- Include proper error handling
`,

      game: `
Additional Game Component Guidelines:
- Implement game state management
- Add score tracking
- Include start/pause/reset functionality
- Use proper game loop patterns
- Add sound effects (optional)
`
    }

    return instructions[componentType.toLowerCase()] || ''
  }

  /**
   * Generate context-aware prompt enhancement
   */
  generateContextualPrompt(userMessage: string, context: ConversationContext, componentType?: string): string {
    let enhancement = ''

    if (context.hasArtifacts) {
      enhancement += `\nContext: This conversation already contains ${context.artifactCount} React artifact(s). `

      if (context.lastMessageContainedArtifact) {
        enhancement += 'The previous message contained an artifact. Consider if the user wants to modify or extend it.'
      }
    }

    if (componentType) {
      enhancement += this.getComponentTypeInstructions(componentType)
    }

    return enhancement
  }

  /**
   * Detect component type from user message
   */
  detectComponentType(message: string): string | null {
    const typePatterns: Record<string, RegExp[]> = {
      form: [/form/i, /input/i, /submit/i, /validation/i],
      chart: [/chart/i, /graph/i, /plot/i, /visualization/i, /data.*visual/i],
      calculator: [/calculator/i, /calculate/i, /math/i, /arithmetic/i],
      dashboard: [/dashboard/i, /admin/i, /overview/i, /summary/i],
      game: [/game/i, /play/i, /score/i, /level/i],
      table: [/table/i, /grid/i, /list/i, /data.*table/i],
      modal: [/modal/i, /popup/i, /dialog/i, /overlay/i],
      navigation: [/nav/i, /menu/i, /sidebar/i, /header/i],
      card: [/card/i, /tile/i, /panel/i],
      button: [/button/i, /click/i, /action/i]
    }

    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some((pattern) => pattern.test(message))) {
        return type
      }
    }

    return null
  }

  /**
   * Generate full enhanced prompt with all context
   */
  generateFullPrompt(userMessage: string, context?: ConversationContext): string {
    const componentType = this.detectComponentType(userMessage)
    const shouldEnable = this.shouldEnableArtifacts(userMessage, context)

    if (!shouldEnable) {
      return `${this.basePrompt}\n\nUser: ${userMessage}`
    }

    let fullPrompt = this.basePrompt

    // Add artifact system prompt
    fullPrompt += `\n\n${this.ARTIFACT_SYSTEM_PROMPT}`

    // Add contextual enhancements
    if (context) {
      const contextualPrompt = this.generateContextualPrompt(userMessage, context, componentType || undefined)
      if (contextualPrompt) {
        fullPrompt += `\n\n${contextualPrompt}`
      }
    }

    // Add component-specific instructions
    if (componentType) {
      const typeInstructions = this.getComponentTypeInstructions(componentType)
      if (typeInstructions) {
        fullPrompt += `\n\n${typeInstructions}`
      }
    }

    fullPrompt += `\n\nUser: ${userMessage}`

    logger.info(`Generated full enhanced prompt for component type: ${componentType || 'generic'}`)
    return fullPrompt
  }
}

// Export singleton instance
export const systemPromptManager = SystemPromptManager.getInstance()
