import { ReactArtifactMinApp } from '@renderer/types'
import React, { useCallback, useEffect, useRef } from 'react'
import styled from 'styled-components'

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background);
`

const EditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--background-secondary);
  font-size: 12px;
  color: var(--foreground-secondary);
`

const EditorContent = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`

const CodeTextarea = styled.textarea<{ hasError: boolean }>`
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  background: var(--background);
  color: var(--foreground);
  border: ${(props) => (props.hasError ? '2px solid #ff6b6b' : 'none')};

  &:focus {
    outline: none;
    border-color: ${(props) => (props.hasError ? '#ff6b6b' : 'var(--primary)')};
  }

  &::placeholder {
    color: var(--foreground-secondary);
  }
`

const LineNumbers = styled.div`
  position: absolute;
  left: 0;
  top: 16px;
  width: 50px;
  padding: 0 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground-secondary);
  background: var(--background-secondary);
  border-right: 1px solid var(--border);
  user-select: none;
  pointer-events: none;
`

const CodeArea = styled.div`
  position: relative;
  height: 100%;
`

const ErrorIndicator = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff6b6b;
  border: 2px solid var(--background);
`

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  border-top: 1px solid var(--border);
  background: var(--background-secondary);
  font-size: 11px;
  color: var(--foreground-secondary);
`

interface ArtifactCodeEditorProps {
  code: string
  language: 'tsx' | 'jsx' | 'typescript' | 'javascript'
  onChange?: (code: string) => void
  readOnly?: boolean
  artifact: ReactArtifactMinApp
  error?: string | null
  showLineNumbers?: boolean
}

export const ArtifactCodeEditor: React.FC<ArtifactCodeEditorProps> = ({
  code,
  language,
  onChange,
  readOnly = false,
  artifact,
  error,
  showLineNumbers = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Handle code changes
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value
      onChange?.(newCode)
    },
    [onChange]
  )

  // Update line numbers
  const updateLineNumbers = useCallback(() => {
    if (!showLineNumbers || !lineNumbersRef.current || !textareaRef.current) return

    const lines = code.split('\n')
    const lineNumbersContent = lines.map((_, index) => (index + 1).toString()).join('\n')

    lineNumbersRef.current.textContent = lineNumbersContent

    // Sync scroll position
    lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
  }, [code, showLineNumbers])

  // Handle scroll synchronization
  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return

      // Tab handling
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newCode = code.substring(0, start) + '  ' + code.substring(end)

        onChange?.(newCode)

        // Restore cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }

      // Auto-closing brackets
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const pairs: Record<string, string> = {
          '(': ')',
          '[': ']',
          '{': '}',
          '"': '"',
          "'": "'"
        }

        if (pairs[e.key]) {
          e.preventDefault()
          const textarea = e.currentTarget
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const selectedText = code.substring(start, end)
          const newCode = code.substring(0, start) + e.key + selectedText + pairs[e.key] + code.substring(end)

          onChange?.(newCode)

          // Position cursor
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1
          }, 0)
        }
      }
    },
    [code, onChange, readOnly]
  )

  // Update line numbers when code changes
  useEffect(() => {
    updateLineNumbers()
  }, [updateLineNumbers])

  // Get file stats
  const getFileStats = useCallback(() => {
    const lines = code.split('\n').length
    const characters = code.length
    const words = code.split(/\s+/).filter(Boolean).length
    return { lines, characters, words }
  }, [code])

  const stats = getFileStats()

  return (
    <EditorContainer>
      <EditorHeader>
        <span>{artifact.artifact.metadata.title}.tsx</span>
        <span>
          {language.toUpperCase()} • {readOnly ? 'Read Only' : 'Editable'}
          {error && <ErrorIndicator title={error} />}
        </span>
      </EditorHeader>

      <EditorContent>
        <CodeArea>
          {showLineNumbers && <LineNumbers ref={lineNumbersRef} />}
          <CodeTextarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            hasError={!!error}
            placeholder={readOnly ? '' : 'Start typing your React component...'}
            style={{
              paddingLeft: showLineNumbers ? '60px' : '16px'
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </CodeArea>
      </EditorContent>

      <StatusBar>
        <span>
          Ln {code.substring(0, textareaRef.current?.selectionStart || 0).split('\n').length}, Col{' '}
          {(textareaRef.current?.selectionStart || 0) -
            code.lastIndexOf('\n', (textareaRef.current?.selectionStart || 0) - 1)}
        </span>
        <span>
          {stats.lines} lines • {stats.characters} chars • {stats.words} words
        </span>
      </StatusBar>
    </EditorContainer>
  )
}

export default ArtifactCodeEditor
