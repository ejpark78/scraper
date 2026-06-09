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

// Serve downloaded images from site scrapers
const projectRoot = path.resolve(__dirname, '..', '..');
app.use('/geeknews', express.static(path.join(projectRoot, 'data', 'sites', 'geeknews')));
app.use('/gpters', express.static(path.join(projectRoot, 'data', 'sites', 'gpters')));
app.use('/pytorch_kr', express.static(path.join(projectRoot, 'data', 'sites', 'pytorch_kr')));

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
      { id: 'linkedin.jobs', name: 'LinkedIn Jobs' },
      { id: 'silver/linkedin.companies', name: 'LinkedIn Companies' },
      { id: 'silver/geeknews.contents', name: 'GeekNews' },
      { id: 'silver/gpters.contents', name: 'GPters' },
      { id: 'silver/pytorch_kr.contents', name: 'PyTorch KR' }
    ];
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents', async (req: Request, res: Response) => {
  try {
    const collectionName = req.query.collection as string || 'linkedin.jobs';
    const search = req.query.search as string || '';
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '30', 10);
    const skip = (page - 1) * limit;

    // Special handling for merged 'linkedin.jobs' (lists documents based on bronze, stitched with silver)
    if (collectionName === 'linkedin.jobs') {
      const bronzeColl = await mongo.getCollection('bronze/linkedin.jobs');
      const silverColl = await mongo.getCollection('silver/linkedin.jobs');
      const country = req.query.country as string || '';
      
      let query: any = {};
      let total = 0;
      let hasPaginatedInSilver = false;
      
      if (country) {
        const countryRegex = new RegExp(country, 'i');
        const silverQuery: any = { location: countryRegex };
        
        if (search) {
          if (/^\d+$/.test(search)) {
            const numId = parseInt(search, 10);
            silverQuery.$or = [
              { jobId: search },
              { jobId: numId }
            ];
          } else {
            const regex = new RegExp(search, 'i');
            silverQuery.$or = [
              { title: regex },
              { companyName: regex },
              { description: regex },
              { markdown: regex },
              { jobId: regex }
            ];
          }
        }

        // Get true total count from Silver (very fast count)
        total = await silverColl.countDocuments(silverQuery);

        // Paginate in Silver to get exact 30 IDs for the current page
        const matchingSilverDocs = await silverColl.find(silverQuery)
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limit)
          .project({ jobId: 1 })
          .toArray();
        const matchingJobIds = matchingSilverDocs.map(d => d.jobId).filter(Boolean);
        
        query = { jobId: { $in: matchingJobIds } };
        hasPaginatedInSilver = true;
      } else if (search) {
        let silverQuery: any = {};
        const regex = new RegExp(search, 'i');
        if (/^\d+$/.test(search)) {
          const numId = parseInt(search, 10);
          silverQuery = {
            $or: [
              { jobId: search },
              { jobId: numId }
            ]
          };
        } else {
          silverQuery = {
            $or: [
              { title: regex },
              { companyName: regex },
              { description: regex },
              { markdown: regex },
              { jobId: regex }
            ]
          };
        }

        total = await silverColl.countDocuments(silverQuery);

        // Paginate in Silver to get exact 30 IDs for the current page
        const matchingSilverDocs = await silverColl.find(silverQuery)
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limit)
          .project({ jobId: 1 })
          .toArray();
        const matchingJobIds = matchingSilverDocs.map(d => d.jobId).filter(Boolean);
        
        if (/^\d+$/.test(search)) {
          const numId = parseInt(search, 10);
          query = {
            $or: [
              { jobId: search },
              { jobId: numId }
            ]
          };
        } else {
          query = { jobId: { $in: matchingJobIds } };
        }
        hasPaginatedInSilver = true;
      } else {
        total = await bronzeColl.estimatedDocumentCount();
      }

      // Query bronze docs
      const bronzeDocs = await (hasPaginatedInSilver
        ? bronzeColl.find(query)
            .project({
              _id: 1,
              jobId: 1,
              scrapedAt: 1,
              url: 1
            })
            .sort({ _id: -1 })
            .toArray()
        : bronzeColl.find(query)
            .project({
              _id: 1,
              jobId: 1,
              scrapedAt: 1,
              url: 1
            })
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit)
            .toArray()
      );

      // Stitch silver metadata
      const jobIds = bronzeDocs.map(d => d.jobId).filter(Boolean);
      const silverDocs = await silverColl.find({ jobId: { $in: jobIds } }).toArray();
      const silverMap = new Map(silverDocs.map(d => [d.jobId, d]));

      const combinedDocs = bronzeDocs.map(bDoc => {
        const sDoc = silverMap.get(bDoc.jobId);
        return {
          _id: bDoc._id,
          jobId: bDoc.jobId,
          title: sDoc ? (sDoc.title || sDoc.jobTitle) : `LinkedIn - #${bDoc.jobId}`,
          companyName: sDoc ? sDoc.companyName : 'Unknown Company',
          collectedAt: bDoc.scrapedAt || (sDoc ? sDoc.updatedAt : null),
          url: bDoc.url || (sDoc ? sDoc.url : null),
          hasSilver: !!sDoc,
          hasBronze: true
        };
      });

      return res.json({
        total,
        page,
        limit,
        documents: combinedDocs
      });
    }

    // Default handling for other collections
    const collection = await mongo.getCollection(collectionName as `${'bronze' | 'silver'}/${string}`);
    
    let query: any = {};
    if (search) {
      if (/^\d+$/.test(search)) {
        const numVal = parseInt(search, 10);
        query = {
          $or: [
            { id: search },
            { id: numVal },
            { jobId: search },
            { jobId: numVal },
            { topicId: search },
            { topicId: numVal },
            { postId: search },
            { postId: numVal }
          ]
        };
      } else {
        const regex = new RegExp(search, 'i');
        query = {
          $or: [
            { title: regex },
            { jobTitle: regex },
            { companyName: regex },
            { url: regex },
            { text: regex },
            { content: regex },
            { markdown: regex },
            { id: regex },
            { jobId: regex },
            { topicId: regex },
            { postId: regex }
          ]
        };
      }
    }

    const total = search ? await collection.countDocuments(query) : await collection.estimatedDocumentCount();
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
        updatedAt: 1,
        publishedAt: 1,
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
    const collectionName = req.query.collection as string || 'linkedin.jobs';

    if (collectionName === 'linkedin.jobs') {
      const bronzeColl = await mongo.getCollection('bronze/linkedin.jobs');
      const silverColl = await mongo.getCollection('silver/linkedin.jobs');
      
      let bronzeDoc: any = null;
      let silverDoc: any = null;

      if (ObjectId.isValid(id)) {
        bronzeDoc = await bronzeColl.findOne({ _id: new ObjectId(id) });
      } else {
        const numId = parseInt(id, 10);
        const filter = isNaN(numId) ? { jobId: id } : { $or: [{ jobId: id }, { jobId: numId }] };
        bronzeDoc = await bronzeColl.findOne(filter);
      }
      
      if (bronzeDoc && bronzeDoc.jobId) {
        const searchJobId = bronzeDoc.jobId.toString();
        const numJobId = parseInt(searchJobId, 10);
        silverDoc = await silverColl.findOne({
          $or: [
            { jobId: searchJobId },
            { jobId: numJobId }
          ]
        });
      } else {
        const numId = parseInt(id, 10);
        const silverFilter = isNaN(numId) ? { jobId: id } : { $or: [{ jobId: id }, { jobId: numId }] };
        silverDoc = await silverColl.findOne(silverFilter);
        if (silverDoc && silverDoc.jobId) {
          const searchJobId = silverDoc.jobId.toString();
          const numJobId = parseInt(searchJobId, 10);
          bronzeDoc = await bronzeColl.findOne({
            $or: [
              { jobId: searchJobId },
              { jobId: numJobId }
            ]
          });
        }
      }

      if (!bronzeDoc && !silverDoc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      return res.json({
        isMerged: true,
        bronze: bronzeDoc,
        silver: silverDoc
      });
    }

    const collection = await mongo.getCollection(collectionName as `${'bronze' | 'silver'}/${string}`);

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

    // Dynamically stitch rawHtml from Bronze layer for Silver collections
    if (!doc.rawHtml) {
      try {
        if (collectionName === 'silver/linkedin.jobs' && doc.jobId) {
          const bronzeColl = await mongo.getCollection('bronze/linkedin.jobs');
          const bronzeDoc = await bronzeColl.findOne({ jobId: doc.jobId });
          if (bronzeDoc && bronzeDoc.rawHtml) {
            doc.rawHtml = bronzeDoc.rawHtml;
            doc.scrapedAt = bronzeDoc.scrapedAt;
          }
        } else if (collectionName === 'silver/geeknews.contents' && doc.id) {
          const bronzeColl = await mongo.getCollection('bronze/geeknews.html');
          const bronzeDoc = await bronzeColl.findOne({ $or: [{ id: doc.id }, { topicId: doc.id }] });
          if (bronzeDoc && bronzeDoc.rawHtml) doc.rawHtml = bronzeDoc.rawHtml;
        } else if (collectionName === 'silver/gpters.contents' && doc.id) {
          const bronzeColl = await mongo.getCollection('bronze/gpters.html');
          const bronzeDoc = await bronzeColl.findOne({ $or: [{ id: doc.id }, { postId: doc.id }] });
          if (bronzeDoc && bronzeDoc.rawHtml) doc.rawHtml = bronzeDoc.rawHtml;
        } else if (collectionName === 'silver/pytorch_kr.contents' && doc.id) {
          const bronzeColl = await mongo.getCollection('bronze/pytorch_kr.html');
          const bronzeDoc = await bronzeColl.findOne({ $or: [{ id: doc.id }, { topicId: doc.id }] });
          if (bronzeDoc && bronzeDoc.rawHtml) {
            doc.rawHtml = bronzeDoc.rawHtml;
          }
        }
      } catch (stitchErr) {
        console.error(`[Stitch] Failed to attach rawHtml for ${collectionName}:`, stitchErr);
      }
    }

    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. MCP (Model Context Protocol) Server Integration
function registerMcpHandlers(server: Server) {
  // MCP: List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    if (request.params.name !== 'search_documents') {
      throw new Error(`Tool not found: ${request.params.name}`);
    }

    const collectionName = request.params.arguments?.collection as string;
    const search = request.params.arguments?.query as string;
    const limit = Number(request.params.arguments?.limit || 5);

    try {
      const collection = await mongo.getCollection(collectionName as `${'bronze' | 'silver'}/${string}`);
      const regex = new RegExp(search, 'i');
      const query = {
        $or: [
          { title: regex },
          { jobTitle: regex },
          { companyName: regex },
          { url: regex },
          { text: regex },
          { content: regex },
          { markdown: regex },
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
}

// MCP: SSE Transport endpoints
const activeSessions = new Map<string, { server: Server; transport: SSEServerTransport }>();

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
    res.status(400).send(`No active SSE connection for sessionId: ${sessionId}`);
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
