import { Hono } from 'hono'

import { loggerService } from '../../services/LoggerService'
import { mcpApiService } from '../services/MCPApiService'

const logger = loggerService.withContext('ApiServerMCPRoutes')

const app = new Hono()

// Get all MCP servers
app.get('/servers', async (c) => {
  try {
    logger.info('Get all MCP servers request received')

    const servers = await mcpApiService.getAllServers()

    return c.json({
      success: true,
      data: servers
    })
  } catch (error) {
    logger.error('Error fetching MCP servers:', error)
    return c.json(
      {
        success: false,
        error: {
          message: 'Failed to retrieve MCP servers',
          type: 'service_unavailable',
          code: 'servers_unavailable'
        }
      },
      503
    )
  }
})

// Create a new MCP server
app.post('/servers', async (c) => {
  try {
    const serverData = await c.req.json()

    logger.info('Create MCP server request received:', {
      name: serverData.name,
      type: serverData.type
    })

    // Validate required fields
    if (!serverData.name) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server name is required',
            type: 'invalid_request_error',
            code: 'missing_name'
          }
        },
        400
      )
    }

    const server = await mcpApiService.createServer(serverData)

    return c.json(
      {
        success: true,
        data: server
      },
      201
    )
  } catch (error) {
    logger.error('Error creating MCP server:', error)

    let statusCode: 500 | 409 | 400 = 500
    let errorMessage = 'Failed to create MCP server'

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        statusCode = 409
        errorMessage = error.message
      } else if (error.message.includes('validation')) {
        statusCode = 400
        errorMessage = error.message
      }
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'creation_failed'
        }
      },
      statusCode
    )
  }
})

// Update an existing MCP server
app.put('/servers/:id', async (c) => {
  try {
    const serverId = c.req.param('id')
    const updateData = await c.req.json()

    logger.info('Update MCP server request received:', {
      id: serverId,
      updates: Object.keys(updateData)
    })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    const server = await mcpApiService.updateServer(serverId, updateData)

    return c.json({
      success: true,
      data: server
    })
  } catch (error) {
    logger.error('Error updating MCP server:', error)

    let statusCode: 500 | 404 | 400 = 500
    let errorMessage = 'Failed to update MCP server'

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404
        errorMessage = error.message
      } else if (error.message.includes('validation')) {
        statusCode = 400
        errorMessage = error.message
      }
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'update_failed'
        }
      },
      statusCode
    )
  }
})

// Delete an MCP server
app.delete('/servers/:id', async (c) => {
  try {
    const serverId = c.req.param('id')

    logger.info('Delete MCP server request received:', { id: serverId })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    await mcpApiService.deleteServer(serverId)

    return c.json({
      success: true,
      message: 'MCP server deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting MCP server:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to delete MCP server'

    if (error instanceof Error && error.message.includes('not found')) {
      statusCode = 404
      errorMessage = error.message
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'deletion_failed'
        }
      },
      statusCode
    )
  }
})

// Toggle server active status
app.post('/servers/:id/toggle', async (c) => {
  try {
    const serverId = c.req.param('id')

    logger.info('Toggle MCP server request received:', { id: serverId })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    const server = await mcpApiService.toggleServer(serverId)

    return c.json({
      success: true,
      data: server,
      message: `Server ${server.isActive ? 'activated' : 'deactivated'} successfully`
    })
  } catch (error) {
    logger.error('Error toggling MCP server:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to toggle MCP server'

    if (error instanceof Error && error.message.includes('not found')) {
      statusCode = 404
      errorMessage = error.message
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'toggle_failed'
        }
      },
      statusCode
    )
  }
})

// Toggle tool for a specific server
app.post('/servers/:serverName/tools/:toolName/toggle', async (c) => {
  try {
    const serverName = c.req.param('serverName')
    const toolName = c.req.param('toolName')

    logger.info('Toggle tool request received:', {
      serverName,
      toolName
    })

    if (!serverName || !toolName) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server name and tool name are required',
            type: 'invalid_request_error',
            code: 'missing_parameters'
          }
        },
        400
      )
    }

    const result = await mcpApiService.toggleTool(serverName, toolName)

    return c.json({
      success: true,
      data: result,
      message: `Tool ${toolName} ${result.enabled ? 'enabled' : 'disabled'} for server ${serverName}`
    })
  } catch (error) {
    logger.error('Error toggling tool:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to toggle tool'

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404
        errorMessage = error.message
      }
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'tool_toggle_failed'
        }
      },
      statusCode
    )
  }
})

// Get server sessions
app.get('/servers/:id/session', async (c) => {
  try {
    const serverId = c.req.param('id')

    logger.info('Get server session request received:', { id: serverId })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    const session = await mcpApiService.getServerSession(serverId)

    return c.json({
      success: true,
      data: session
    })
  } catch (error) {
    logger.error('Error getting server session:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to get server session'

    if (error instanceof Error && error.message.includes('not found')) {
      statusCode = 404
      errorMessage = error.message
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'session_fetch_failed'
        }
      },
      statusCode
    )
  }
})

// Create/restart server session
app.post('/servers/:id/session', async (c) => {
  try {
    const serverId = c.req.param('id')

    logger.info('Create server session request received:', { id: serverId })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    const session = await mcpApiService.createServerSession(serverId)

    return c.json(
      {
        success: true,
        data: session,
        message: 'Server session created successfully'
      },
      201
    )
  } catch (error) {
    logger.error('Error creating server session:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to create server session'

    if (error instanceof Error && error.message.includes('not found')) {
      statusCode = 404
      errorMessage = error.message
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'session_creation_failed'
        }
      },
      statusCode
    )
  }
})

// Delete server session
app.delete('/servers/:id/session', async (c) => {
  try {
    const serverId = c.req.param('id')

    logger.info('Delete server session request received:', { id: serverId })

    if (!serverId) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Server ID is required',
            type: 'invalid_request_error',
            code: 'missing_id'
          }
        },
        400
      )
    }

    await mcpApiService.deleteServerSession(serverId)

    return c.json({
      success: true,
      message: 'Server session deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting server session:', error)

    let statusCode: 500 | 404 = 500
    let errorMessage = 'Failed to delete server session'

    if (error instanceof Error && error.message.includes('not found')) {
      statusCode = 404
      errorMessage = error.message
    }

    return c.json(
      {
        success: false,
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'session_deletion_failed'
        }
      },
      statusCode
    )
  }
})

export { app as mcpRoutes }
