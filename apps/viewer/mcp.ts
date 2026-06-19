/**
 * @module mcp
 * @description Model Context Protocol (MCP) Server Integration for LinkedIn Clipper.
 *              Exposes search tools and handles SSE connections.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 *   - Access configurations only through Centralized AppConfig.
 * @dependencies express, @modelcontextprotocol/sdk, MeiliSearchDatabase
 * @lastUpdated 2026-06-15
 */

import { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MeiliSearchDatabase } from './database/meili';
import { getIndexName, getSiteKeyFromCollection } from './crawler/core/SiteRegistry';

function registerMcpHandlers(server: Server) {
  // MCP: List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_documents',
          description: 'Search documents (LinkedIn jobs, geeknews, gpters, pytorch_kr, aicasebook) stored in MongoDB',
          inputSchema: {
            type: 'object',
            properties: {
              collection: {
                type: 'string',
                description: 'The collection name to query (e.g. bronze/linkedin.jobs, bronze/geeknews.html, bronze/gpters.html, bronze/pytorch_kr.html)',
              },
              query: {
                type: 'string',
                description: 'Keyword search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default 5)',
              },
            },
            required: ['collection', 'query'],
          },
        },
      ],
    };
  });

  // MCP: Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    if (request.params.name !== 'search_documents') {
      throw new Error(`Tool not found: ${request.params.name}`);
    }

    const collectionName = request.params.arguments?.collection as string;
    const search = request.params.arguments?.query as string;
    const limit = Number(request.params.arguments?.limit || 5);

    try {
      const siteKey = getSiteKeyFromCollection(collectionName);
      const meili = MeiliSearchDatabase.getInstance();
      const indexName = getIndexName(siteKey);
      const searchResults = await meili.search(indexName, search, {
        limit
      });

      // Map results to text output
      const formattedResults = searchResults.hits.map(doc => {
        const title = doc.title || 'Untitled';
        const company = doc.companyName || 'Unknown Company';
        const url = doc.url || 'No URL';
        const body = doc.content || '(No body content)';
        return `### Title: ${title}\nCompany: ${company}\nURL: ${url}\nID: ${doc.docId || doc.id}\n---\n${body.substring(0, 1000)}...\n\n`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: formattedResults || 'No documents matched the search query.',
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching documents: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

const activeSessions = new Map<string, { server: Server; transport: SSEServerTransport }>();

export function setupMcpServer(app: Express) {
  app.get('/sse', async (req: Request, res: Response) => {
    console.log('🔌 [MCP] SSE Connection initiated');
    
    const transportInstance = new SSEServerTransport('/messages', res);
    const sessionServer = new Server(
      {
        name: 'linkedin-clipper-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    registerMcpHandlers(sessionServer);

    try {
      await sessionServer.connect(transportInstance);
      const sessionId = transportInstance.sessionId;
      activeSessions.set(sessionId, { server: sessionServer, transport: transportInstance });
      console.log(`✅ [MCP] SSE Session established: ${sessionId}. Total sessions: ${activeSessions.size}`);

      res.on('close', async () => {
        console.log(`🔌 [MCP] SSE Session closed: ${sessionId}`);
        try {
          await sessionServer.close();
        } catch (e) {
          // Ignore close error
        }
        activeSessions.delete(sessionId);
      });
    } catch (err: any) {
      console.error(`⚠️ [MCP] SSE connect error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });

  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const session = activeSessions.get(sessionId);
    if (session) {
      await session.transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(404).end();
    }
  });
}
