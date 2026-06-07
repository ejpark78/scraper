import express, { Request, Response } from 'express';
import path from 'path';
import { MongoDatabase } from '../database/mongo';
import { ObjectId } from 'mongodb';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware for debugging
app.use((req: Request, res: Response, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

const mongo = MongoDatabase.getInstance();

// 1. HTTP REST API
app.get('/api/collections', async (req: Request, res: Response) => {
  try {
    const collections = [
      { id: 'bronze/linkedin.jobs', name: 'LinkedIn Jobs' },
      { id: 'bronze/linkedin.companies', name: 'LinkedIn Companies' },
      { id: 'bronze/geeknews.html', name: 'GeekNews Raw HTML' },
      { id: 'bronze/gpters.html', name: 'GPters Raw HTML' },
      { id: 'bronze/pytorch_kr.html', name: 'PyTorch KR Raw HTML' }
    ];
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents', async (req: Request, res: Response) => {
  try {
    const collectionName = req.query.collection as string || 'bronze/linkedin.jobs';
    const search = req.query.search as string || '';
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '30', 10);
    const skip = (page - 1) * limit;

    const collection = await mongo.getCollection(collectionName);
    
    let query: any = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query = {
        $or: [
          { title: regex },
          { jobTitle: regex },
          { companyName: regex },
          { url: regex },
          { text: regex },
          { content: regex },
          { id: regex },
          { jobId: regex },
          { topicId: regex },
          { postId: regex }
        ]
      };
    }

    const total = await collection.countDocuments(query);
    const docs = await collection.find(query)
      .project({
        _id: 1,
        title: 1,
        jobTitle: 1,
        companyName: 1,
        site: 1,
        url: 1,
        collectedAt: 1,
        createdAt: 1,
        scrapedAt: 1,
        jobId: 1,
        id: 1,
        topicId: 1,
        postId: 1
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      total,
      page,
      limit,
      documents: docs
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const collectionName = req.query.collection as string || 'bronze/linkedin.jobs';
    const collection = await mongo.getCollection(collectionName);

    let filter: any = {};
    if (ObjectId.isValid(id)) {
      filter = { $or: [{ _id: new ObjectId(id) }, { id: id }, { jobId: id }, { topicId: id }, { postId: id }] };
    } else {
      filter = { $or: [{ id: id }, { jobId: id }, { topicId: id }, { postId: id }, { _id: id }] };
    }

    const doc = await collection.findOne(filter);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. MCP (Model Context Protocol) Server Integration
const mcpServer = new Server(
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

// MCP: List tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_documents',
        description: 'Search documents (LinkedIn jobs, geeknews, gpters, pytorch_kr) stored in MongoDB',
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
mcpServer.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  if (request.params.name !== 'search_documents') {
    throw new Error(`Tool not found: ${request.params.name}`);
  }

  const collectionName = request.params.arguments?.collection as string;
  const search = request.params.arguments?.query as string;
  const limit = Number(request.params.arguments?.limit || 5);

  try {
    const collection = await mongo.getCollection(collectionName);
    const regex = new RegExp(search, 'i');
    const query = {
      $or: [
        { title: regex },
        { jobTitle: regex },
        { companyName: regex },
        { url: regex },
        { text: regex },
        { content: regex },
        { id: regex },
        { jobId: regex },
        { topicId: regex },
        { postId: regex }
      ]
    };

    const docs = await collection.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    // Map results to text output
    const formattedResults = docs.map(doc => {
      const title = doc.title || doc.jobTitle || 'Untitled';
      const company = doc.companyName || 'Unknown Company';
      const url = doc.url || 'No URL';
      const body = doc.markdown || doc.text || doc.content || '(No body content)';
      return `### Title: ${title}\nCompany: ${company}\nURL: ${url}\nID: ${doc.id || doc.jobId || doc._id}\n---\n${body.substring(0, 1000)}...\n\n`;
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

// MCP: SSE Transport endpoints
let transport: SSEServerTransport | null = null;

app.get('/sse', async (req: Request, res: Response) => {
  console.log('🔌 [MCP] SSE Connection initiated');
  transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);
});

app.post('/messages', async (req: Request, res: Response) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No active SSE connection');
  }
});

// Connect to MongoDB and start the server
async function start() {
  try {
    await mongo.connect();
    app.listen(PORT, () => {
      console.log(`🚀 [Server] Hybrid HTTP & MCP Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
