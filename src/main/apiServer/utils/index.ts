import { reduxService } from '@main/services/ReduxService'
import { Model, Provider } from '@types'
import Logger from 'electron-log'

// OpenAI compatible model format
export interface OpenAICompatibleModel {
  id: string
  object: 'model'
  created: number
  owned_by: string
}

export function getAvailableProviders(): Provider[] {
  try {
    const providers = reduxService.selectSync('state.llm.providers')
    if (!providers || !Array.isArray(providers)) {
      Logger.warn('No providers found in Redux store, returning empty array')
      return []
    }
    return providers.filter((p: Provider) => p.enabled)
  } catch (error) {
    Logger.error('Failed to get providers from Redux store:', error)
    return []
  }
}

export function listAllAvailableModels(): Model[] {
  try {
    const providers = getAvailableProviders()
    return providers.map((p: Provider) => p.models || []).flat() as Model[]
  } catch (error) {
    Logger.error('Failed to list available models:', error)
    return []
  }
}

export function getProviderByModel(model: string): Provider | undefined {
  try {
    if (!model || typeof model !== 'string') {
      Logger.warn('Invalid model parameter:', model)
      return undefined
    }

    const providers = getAvailableProviders()
    const modelInfo = model.split(':')

    if (modelInfo.length < 2) {
      Logger.warn('Invalid model format, expected "provider:model":', model)
      return undefined
    }

    const providerId = modelInfo[0]
    const provider = providers.find((p: Provider) => p.id === providerId)

    if (!provider) {
      Logger.warn('Provider not found for model:', model)
      return undefined
    }

    return provider
  } catch (error) {
    Logger.error('Failed to get provider by model:', error)
    return undefined
  }
}

export function transformModelToOpenAI(model: Model): OpenAICompatibleModel {
  return {
    id: `${model.provider}:${model.id}`,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: model.owned_by || model.provider
  }
}

export function validateProvider(provider: Provider): boolean {
  try {
    if (!provider) {
      return false
    }

    // Check required fields
    if (!provider.id || !provider.type || !provider.apiKey || !provider.apiHost) {
      Logger.warn('Provider missing required fields:', {
        id: !!provider.id,
        type: !!provider.type,
        apiKey: !!provider.apiKey,
        apiHost: !!provider.apiHost
      })
      return false
    }

    // Check if provider is enabled
    if (!provider.enabled) {
      Logger.debug('Provider is disabled:', provider.id)
      return false
    }

    return true
  } catch (error) {
    Logger.error('Error validating provider:', error)
    return false
  }
}
