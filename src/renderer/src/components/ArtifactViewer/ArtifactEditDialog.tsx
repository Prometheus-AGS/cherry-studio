import { Button, Input, Modal, Select, Tag } from 'antd'
import { AlertCircle, CheckCircle, Lightbulb, Loader2, Wand2 } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ArtifactEditService } from '../../services/ArtifactEditService'
import type { Assistant, EditRequest, EditResponse } from '../../types'

const { TextArea } = Input

interface ArtifactEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artifactId: string
  currentVersion: number
  assistant: Assistant
  onEditComplete: (response: EditResponse) => void
}

export const ArtifactEditDialog: React.FC<ArtifactEditDialogProps> = ({
  open,
  onOpenChange,
  artifactId,
  currentVersion,
  assistant,
  onEditComplete
}) => {
  const { t } = useTranslation()
  const [editInstruction, setEditInstruction] = useState('')
  const [context, setContext] = useState('')
  const [preserveProps, setPreserveProps] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const editService = ArtifactEditService.getInstance()

  // Load suggestions when dialog opens
  React.useEffect(() => {
    if (open && artifactId) {
      loadSuggestions()
    }
  }, [open, artifactId])

  const loadSuggestions = useCallback(async () => {
    try {
      const suggestions = await editService.getEditSuggestions(artifactId, currentVersion)
      setSuggestions(suggestions)
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }, [artifactId, currentVersion, editService])

  const handleSubmit = useCallback(async () => {
    if (!editInstruction.trim()) return

    setIsProcessing(true)
    try {
      const request: EditRequest = {
        artifactId,
        currentVersion,
        editInstruction: editInstruction.trim(),
        context: context.trim() || undefined,
        preserveProps
      }

      const response = await editService.processEditRequest(request, assistant)
      onEditComplete(response)

      if (response.success) {
        setEditInstruction('')
        setContext('')
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Edit request failed:', error)
      onEditComplete({
        success: false,
        explanation: 'Failed to process edit request',
        changesApplied: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setIsProcessing(false)
    }
  }, [
    editInstruction,
    context,
    preserveProps,
    artifactId,
    currentVersion,
    assistant,
    editService,
    onEditComplete,
    onOpenChange
  ])

  const handleTemplateSelect = useCallback(
    async (templateName: string) => {
      if (!templateName) return

      setSelectedTemplate(templateName)
      setIsProcessing(true)

      try {
        const response = await editService.applyEditTemplate(artifactId, templateName, assistant)
        onEditComplete(response)

        if (response.success) {
          onOpenChange(false)
        }
      } catch (error) {
        console.error('Template application failed:', error)
        onEditComplete({
          success: false,
          explanation: 'Failed to apply template',
          changesApplied: [],
          errors: [error instanceof Error ? error.message : 'Unknown error']
        })
      } finally {
        setIsProcessing(false)
        setSelectedTemplate('')
      }
    },
    [artifactId, assistant, editService, onEditComplete, onOpenChange]
  )

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setEditInstruction(suggestion)
  }, [])

  const templates = [
    { value: 'add-loading-state', label: 'Add Loading State' },
    { value: 'add-error-handling', label: 'Add Error Handling' },
    { value: 'make-responsive', label: 'Make Responsive' },
    { value: 'add-accessibility', label: 'Add Accessibility' },
    { value: 'optimize-performance', label: 'Optimize Performance' },
    { value: 'add-dark-mode', label: 'Add Dark Mode' },
    { value: 'add-animations', label: 'Add Animations' },
    { value: 'extract-components', label: 'Extract Components' }
  ]

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wand2 size={20} />
          {t('artifacts.edit.title', 'Edit Artifact')}
        </div>
      }
      open={open}
      onCancel={() => onOpenChange(false)}
      width={800}
      footer={[
        <Button key="cancel" onClick={() => onOpenChange(false)} disabled={isProcessing}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          disabled={!editInstruction.trim() || isProcessing}
          loading={isProcessing}
          icon={isProcessing ? <Loader2 size={16} /> : <Wand2 size={16} />}>
          {isProcessing ? 'Processing...' : 'Apply Edit'}
        </Button>
      ]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Quick Templates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Quick Templates</label>
          <Select
            placeholder="Choose a template..."
            value={selectedTemplate}
            onChange={handleTemplateSelect}
            disabled={isProcessing}
            style={{ width: '100%' }}>
            {templates.map((template) => (
              <Select.Option key={template.value} value={template.value}>
                {template.label}
              </Select.Option>
            ))}
          </Select>
        </div>

        <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>Or customize manually</div>

        {/* Edit Instruction */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Edit Instruction</label>
          <TextArea
            placeholder="Describe what you want to change about this component..."
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            rows={4}
            disabled={isProcessing}
          />
        </div>

        {/* Additional Context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Additional Context (Optional)</label>
          <TextArea
            placeholder="Provide any additional context or requirements..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            disabled={isProcessing}
          />
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Options</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="preserve-props"
              checked={preserveProps}
              onChange={(e) => setPreserveProps(e.target.checked)}
              disabled={isProcessing}
            />
            <label htmlFor="preserve-props" style={{ fontSize: '14px' }}>
              Preserve existing props and their types
            </label>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={16} />
              <label style={{ fontWeight: 500 }}>Suggestions</label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((suggestion, index) => (
                <Tag key={index} style={{ cursor: 'pointer' }} onClick={() => handleSuggestionClick(suggestion)}>
                  {suggestion}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface EditResultToastProps {
  response: EditResponse
  onClose: () => void
}

export const EditResultToast: React.FC<EditResultToastProps> = ({ response, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        maxWidth: 400,
        padding: 16,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid',
        zIndex: 1000,
        backgroundColor: response.success ? '#f6ffed' : '#fff2f0',
        borderColor: response.success ? '#b7eb8f' : '#ffccc7',
        color: response.success ? '#389e0d' : '#cf1322'
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {response.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontWeight: 500 }}>
            {response.success ? 'Edit Applied Successfully' : 'Edit Failed'}
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>{response.explanation}</p>

          {response.changesApplied.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500 }}>Changes Applied:</p>
              <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 16px', fontSize: '12px' }}>
                {response.changesApplied.map((change, index) => (
                  <li key={index} style={{ opacity: 0.8 }}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {response.warnings && response.warnings.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500 }}>Warnings:</p>
              <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 16px', fontSize: '12px' }}>
                {response.warnings.map((warning, index) => (
                  <li key={index} style={{ opacity: 0.8 }}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {response.errors && response.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500 }}>Errors:</p>
              <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 16px', fontSize: '12px' }}>
                {response.errors.map((error, index) => (
                  <li key={index} style={{ opacity: 0.8 }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Button type="text" size="small" onClick={onClose} style={{ padding: 0, minWidth: 24, height: 24 }}>
          ×
        </Button>
      </div>
    </div>
  )
}
