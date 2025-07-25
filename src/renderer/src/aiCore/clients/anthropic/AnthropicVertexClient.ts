import Anthropic from '@anthropic-ai/sdk'
import AnthropicVertex from '@anthropic-ai/vertex-sdk'
import { getVertexAILocation, getVertexAIProjectId, getVertexAIServiceAccount } from '@renderer/hooks/useVertexAI'
import { loggerService } from '@renderer/services/LoggerService'
import { Provider } from '@renderer/types'

const logger = loggerService.withContext('AnthropicVertexClient')
import { AnthropicAPIClient } from './AnthropicAPIClient'

export class AnthropicVertexClient extends AnthropicAPIClient {
  sdkInstance: AnthropicVertex | undefined = undefined
  private authHeaders?: Record<string, string>
  private authHeadersExpiry?: number

  constructor(provider: Provider) {
    super(provider)
  }

  private formatApiHost(host: string): string {
    // For Vertex AI with Anthropic models, we should NOT append /v1/
    // The AnthropicVertex SDK handles all path construction internally
    if (!host) {
      return host
    }

    // Remove any trailing paths that might interfere with the SDK's URL construction
    // Keep only the base domain
    const url = new URL(host.startsWith('http') ? host : `https://${host}`)
    return `${url.protocol}//${url.host}`
  }

  override getBaseURL(): string {
    const host = this.provider.apiHost

    // If using the standard Google AI Platform endpoint, return the default
    // Google AI Platform endpoint
    if (!host || host === 'https://aiplatform.googleapis.com') {
      return 'https://aiplatform.googleapis.com'
    }

    // For custom endpoints, format appropriately
    return this.formatApiHost(host)
  }

  override async getSdkInstance(): Promise<AnthropicVertex> {
    if (this.sdkInstance) {
      return this.sdkInstance
    }

    const serviceAccount = getVertexAIServiceAccount()
    const projectId = getVertexAIProjectId()
    const location = getVertexAILocation()

    if (!serviceAccount.privateKey || !serviceAccount.clientEmail || !projectId || !location) {
      throw new Error('Vertex AI settings are not configured')
    }

    const authHeaders = await this.getServiceAccountAuthHeaders()
    const host = this.provider.apiHost

    // Create SDK configuration
    const sdkConfig: any = {
      projectId: projectId,
      region: location,
      dangerouslyAllowBrowser: true,
      defaultHeaders: authHeaders
    }

    // Only set baseURL if it's a custom endpoint, otherwise let SDK use its defaults
    if (host && host !== 'https://aiplatform.googleapis.com') {
      sdkConfig.baseURL = this.formatApiHost(host)
    }

    this.sdkInstance = new AnthropicVertex(sdkConfig)

    return this.sdkInstance
  }

  override async listModels(): Promise<Anthropic.ModelInfo[]> {
    throw new Error('Vertex AI does not support listModels method.')
  }

  /**
   * 获取认证头，如果配置了 service account 则从主进程获取
   */
  private async getServiceAccountAuthHeaders(): Promise<Record<string, string> | undefined> {
    const serviceAccount = getVertexAIServiceAccount()
    const projectId = getVertexAIProjectId()

    // 检查是否配置了 service account
    if (!serviceAccount.privateKey || !serviceAccount.clientEmail || !projectId) {
      return undefined
    }

    // 检查是否已有有效的认证头（提前 5 分钟过期）
    const now = Date.now()
    if (this.authHeaders && this.authHeadersExpiry && this.authHeadersExpiry - now > 5 * 60 * 1000) {
      return this.authHeaders
    }

    try {
      // 从主进程获取认证头
      this.authHeaders = await window.api.vertexAI.getAuthHeaders({
        projectId,
        serviceAccount: {
          privateKey: serviceAccount.privateKey,
          clientEmail: serviceAccount.clientEmail
        }
      })

      // 设置过期时间（通常认证头有效期为 1 小时）
      this.authHeadersExpiry = now + 60 * 60 * 1000

      return this.authHeaders
    } catch (error: any) {
      logger.error('Failed to get auth headers:', error)
      throw new Error(`Service Account authentication failed: ${error.message}`)
    }
  }
}
