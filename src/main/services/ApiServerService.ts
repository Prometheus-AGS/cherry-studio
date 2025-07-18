import Logger from 'electron-log'

import { apiServer } from '../apiServer'

export interface ApiServerConfig {
  port: number
  apiKey: string
}

export class ApiServerService {
  constructor() {
    // Use the new clean implementation
  }

  async start(): Promise<void> {
    try {
      await apiServer.start()
      Logger.info('API Server started successfully')
    } catch (error) {
      Logger.error('Failed to start API Server:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    try {
      await apiServer.stop()
      Logger.info('API Server stopped successfully')
    } catch (error) {
      Logger.error('Failed to stop API Server:', error)
      throw error
    }
  }

  async restart(): Promise<void> {
    try {
      await apiServer.restart()
      Logger.info('API Server restarted successfully')
    } catch (error) {
      Logger.error('Failed to restart API Server:', error)
      throw error
    }
  }

  isRunning(): boolean {
    return apiServer.isRunning()
  }

  getCurrentConfig(): ApiServerConfig {
    const config = apiServer.isRunning()
      ? require('../apiServer/config').config.get()
      : { port: 13333, apiKey: 'not-loaded' }

    return {
      port: config.port,
      apiKey: config.apiKey
    }
  }
}

// Export singleton instance
export const apiServerService = new ApiServerService()
