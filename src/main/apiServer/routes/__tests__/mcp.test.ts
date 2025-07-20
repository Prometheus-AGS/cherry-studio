import { MCPServer } from '@types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock logger service
vi.mock('../../../services/LoggerService', () => ({
  loggerService: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }))
  }
}))

// Mock MCP API Service
vi.mock('../../services/MCPApiService', () => ({
  mcpApiService: {
    getAllServers: vi.fn(),
    createServer: vi.fn(),
    updateServer: vi.fn(),
    deleteServer: vi.fn(),
    toggleServer: vi.fn(),
    toggleTool: vi.fn(),
    getServerSession: vi.fn(),
    createServerSession: vi.fn(),
    deleteServerSession: vi.fn()
  }
}))

import { mcpApiService } from '../../services/MCPApiService'
import { mcpRoutes } from '../mcp'

// Test data
const mockServer: MCPServer = {
  id: 'test-server-1',
  name: 'Test MCP Server',
  type: 'stdio',
  description: 'A test MCP server',
  command: 'node',
  args: ['test-server.js'],
  env: { TEST_ENV: 'test' },
  isActive: false,
  disabledTools: [],
  disabledAutoApproveTools: [],
  headers: {},
  tags: ['test'],
  timeout: 60
}

const mockSession = {
  id: 'session-test-server-1-123456',
  serverId: 'test-server-1',
  serverName: 'Test MCP Server',
  isConnected: true,
  connectionTime: '2024-01-01T00:00:00.000Z',
  lastActivity: '2024-01-01T00:05:00.000Z'
}

describe('MCP Routes', () => {
  let app: Hono
  let mockMcpApiService: any

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.route('/', mcpRoutes)

    // Get the mocked instances
    mockMcpApiService = vi.mocked(mcpApiService)
  })

  describe('GET /servers', () => {
    it('should return all servers successfully', async () => {
      const mockServers = [mockServer]
      mockMcpApiService.getAllServers.mockResolvedValue(mockServers)

      const response = await app.request('/servers')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: mockServers
      })
      expect(mockMcpApiService.getAllServers).toHaveBeenCalledOnce()
    })

    it('should handle service errors', async () => {
      mockMcpApiService.getAllServers.mockRejectedValue(new Error('Service unavailable'))

      const response = await app.request('/servers')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data).toEqual({
        success: false,
        error: {
          message: 'Failed to retrieve MCP servers',
          type: 'service_unavailable',
          code: 'servers_unavailable'
        }
      })
      expect(mockMcpApiService.getAllServers).toHaveBeenCalledOnce()
    })
  })

  describe('POST /servers', () => {
    it('should create a new server successfully', async () => {
      const serverData = {
        name: 'New Test Server',
        type: 'stdio',
        description: 'A new test server'
      }
      const createdServer = { ...mockServer, ...serverData, id: 'new-server-id' }
      mockMcpApiService.createServer.mockResolvedValue(createdServer)

      const response = await app.request('/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual({
        success: true,
        data: createdServer
      })
      expect(mockMcpApiService.createServer).toHaveBeenCalledWith(serverData)
    })

    it('should return 400 when name is missing', async () => {
      const serverData = { type: 'stdio', description: 'Missing name' }

      const response = await app.request('/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({
        success: false,
        error: {
          message: 'Server name is required',
          type: 'invalid_request_error',
          code: 'missing_name'
        }
      })
      expect(mockMcpApiService.createServer).not.toHaveBeenCalled()
    })

    it('should handle duplicate server names', async () => {
      const serverData = { name: 'Duplicate Server', type: 'stdio' }
      mockMcpApiService.createServer.mockRejectedValue(new Error("Server with name 'Duplicate Server' already exists"))

      const response = await app.request('/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({
        success: false,
        error: {
          message: "Server with name 'Duplicate Server' already exists",
          type: 'server_error',
          code: 'creation_failed'
        }
      })
    })

    it('should handle validation errors', async () => {
      const serverData = { name: 'Invalid Server' }
      mockMcpApiService.createServer.mockRejectedValue(new Error('validation failed'))

      const response = await app.request('/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('validation failed')
    })
  })

  describe('PUT /servers/:id', () => {
    it('should update server successfully', async () => {
      const serverId = 'test-server-1'
      const updateData = { description: 'Updated description', isActive: true }
      const updatedServer = { ...mockServer, ...updateData }
      mockMcpApiService.updateServer.mockResolvedValue(updatedServer)

      const response = await app.request(`/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: updatedServer
      })
      expect(mockMcpApiService.updateServer).toHaveBeenCalledWith(serverId, updateData)
    })

    it('should return 400 when server ID is missing', async () => {
      const response = await app.request('/servers/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated' })
      })

      // This should return 404 because the route doesn't match without an ID
      expect(response.status).toBe(404)
    })

    it('should handle server not found', async () => {
      const serverId = 'nonexistent-server'
      const updateData = { description: 'Updated' }
      mockMcpApiService.updateServer.mockRejectedValue(new Error("Server with ID 'nonexistent-server' not found"))

      const response = await app.request(`/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("Server with ID 'nonexistent-server' not found")
    })
  })

  describe('DELETE /servers/:id', () => {
    it('should delete server successfully', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.deleteServer.mockResolvedValue(undefined)

      const response = await app.request(`/servers/${serverId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        message: 'MCP server deleted successfully'
      })
      expect(mockMcpApiService.deleteServer).toHaveBeenCalledWith(serverId)
    })

    it('should return 404 when server ID is missing', async () => {
      const response = await app.request('/servers/', {
        method: 'DELETE'
      })

      // This should return 404 because the route doesn't match without an ID
      expect(response.status).toBe(404)
    })

    it('should handle server not found', async () => {
      const serverId = 'nonexistent-server'
      mockMcpApiService.deleteServer.mockRejectedValue(new Error("Server with ID 'nonexistent-server' not found"))

      const response = await app.request(`/servers/${serverId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("Server with ID 'nonexistent-server' not found")
    })
  })

  describe('POST /servers/:id/toggle', () => {
    it('should toggle server successfully', async () => {
      const serverId = 'test-server-1'
      const toggledServer = { ...mockServer, isActive: true }
      mockMcpApiService.toggleServer.mockResolvedValue(toggledServer)

      const response = await app.request(`/servers/${serverId}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: toggledServer,
        message: 'Server activated successfully'
      })
      expect(mockMcpApiService.toggleServer).toHaveBeenCalledWith(serverId)
    })

    it('should show deactivated message when server is deactivated', async () => {
      const serverId = 'test-server-1'
      const toggledServer = { ...mockServer, isActive: false }
      mockMcpApiService.toggleServer.mockResolvedValue(toggledServer)

      const response = await app.request(`/servers/${serverId}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Server deactivated successfully')
    })

    it('should handle server not found', async () => {
      const serverId = 'nonexistent-server'
      mockMcpApiService.toggleServer.mockRejectedValue(new Error("Server with ID 'nonexistent-server' not found"))

      const response = await app.request(`/servers/${serverId}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /servers/:serverName/tools/:toolName/toggle', () => {
    it('should toggle tool successfully', async () => {
      const serverName = 'Test MCP Server'
      const toolName = 'test-tool'
      const toggleResult = {
        serverName,
        toolName,
        enabled: true
      }
      mockMcpApiService.toggleTool.mockResolvedValue(toggleResult)

      const response = await app.request(`/servers/${encodeURIComponent(serverName)}/tools/${toolName}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: toggleResult,
        message: `Tool ${toolName} enabled for server ${serverName}`
      })
      expect(mockMcpApiService.toggleTool).toHaveBeenCalledWith(serverName, toolName)
    })

    it('should show disabled message when tool is disabled', async () => {
      const serverName = 'Test MCP Server'
      const toolName = 'test-tool'
      const toggleResult = {
        serverName,
        toolName,
        enabled: false
      }
      mockMcpApiService.toggleTool.mockResolvedValue(toggleResult)

      const response = await app.request(`/servers/${encodeURIComponent(serverName)}/tools/${toolName}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(data.message).toBe(`Tool ${toolName} disabled for server ${serverName}`)
    })

    it('should handle whitespace parameters', async () => {
      const serverName = '  '
      const toolName = 'test-tool'
      mockMcpApiService.toggleTool.mockRejectedValue(new Error("Server with name '  ' not found"))

      const response = await app.request(`/servers/${encodeURIComponent(serverName)}/tools/${toolName}/toggle`, {
        method: 'POST'
      })

      // The route accepts the request but the service throws an error
      expect([404, 500]).toContain(response.status)
    })

    it('should handle server not found', async () => {
      const serverName = 'Nonexistent Server'
      const toolName = 'test-tool'
      mockMcpApiService.toggleTool.mockRejectedValue(new Error("Server with name 'Nonexistent Server' not found"))

      const response = await app.request(`/servers/${encodeURIComponent(serverName)}/tools/${toolName}/toggle`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('GET /servers/:id/session', () => {
    it('should get server session successfully', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.getServerSession.mockResolvedValue(mockSession)

      const response = await app.request(`/servers/${serverId}/session`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: mockSession
      })
      expect(mockMcpApiService.getServerSession).toHaveBeenCalledWith(serverId)
    })

    it('should handle whitespace server ID', async () => {
      const serverId = '  '
      mockMcpApiService.getServerSession.mockRejectedValue(new Error("No session found for server ID '  '"))

      const response = await app.request(`/servers/${encodeURIComponent(serverId)}/session`)

      // The route accepts the request but the service throws an error
      expect([404, 500]).toContain(response.status)
    })

    it('should handle session not found', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.getServerSession.mockRejectedValue(new Error("No session found for server ID 'test-server-1'"))

      const response = await app.request(`/servers/${serverId}/session`)
      const data = await response.json()

      // The actual error handling returns 500 for generic errors
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /servers/:id/session', () => {
    it('should create server session successfully', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.createServerSession.mockResolvedValue(mockSession)

      const response = await app.request(`/servers/${serverId}/session`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual({
        success: true,
        data: mockSession,
        message: 'Server session created successfully'
      })
      expect(mockMcpApiService.createServerSession).toHaveBeenCalledWith(serverId)
    })

    it('should handle whitespace server ID', async () => {
      const serverId = '  '
      mockMcpApiService.createServerSession.mockRejectedValue(new Error("Server with ID '  ' not found"))

      const response = await app.request(`/servers/${encodeURIComponent(serverId)}/session`, {
        method: 'POST'
      })

      // The route accepts the request but the service throws an error
      expect([404, 500]).toContain(response.status)
    })

    it('should handle server not found', async () => {
      const serverId = 'nonexistent-server'
      mockMcpApiService.createServerSession.mockRejectedValue(
        new Error("Server with ID 'nonexistent-server' not found")
      )

      const response = await app.request(`/servers/${serverId}/session`, {
        method: 'POST'
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('DELETE /servers/:id/session', () => {
    it('should delete server session successfully', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.deleteServerSession.mockResolvedValue(undefined)

      const response = await app.request(`/servers/${serverId}/session`, {
        method: 'DELETE'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        message: 'Server session deleted successfully'
      })
      expect(mockMcpApiService.deleteServerSession).toHaveBeenCalledWith(serverId)
    })

    it('should handle whitespace server ID', async () => {
      const serverId = '  '
      mockMcpApiService.deleteServerSession.mockRejectedValue(new Error("No session found for server ID '  '"))

      const response = await app.request(`/servers/${encodeURIComponent(serverId)}/session`, {
        method: 'DELETE'
      })

      // The route accepts the request but the service throws an error
      expect([404, 500]).toContain(response.status)
    })

    it('should handle session not found', async () => {
      const serverId = 'test-server-1'
      mockMcpApiService.deleteServerSession.mockRejectedValue(
        new Error("No session found for server ID 'test-server-1'")
      )

      const response = await app.request(`/servers/${serverId}/session`, {
        method: 'DELETE'
      })
      const data = await response.json()

      // The actual error handling returns 500 for generic errors
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })
})
