/**
 * @module server
 * @description Hybrid HTTP Express & Model Context Protocol (MCP) Server for LinkedIn Clipper.
 *              Serves the Vue frontend dashboard and lists collection, document details, and Redis queue status.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 *   - Access configurations only through Centralized AppConfig.
 *   - Strict typing (avoid any where possible).
 * @dependencies express, path, mongo, mongodb, AppConfig, ioredis, index.js
 * @lastUpdated 2026-06-13
 */

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
import { getAllSites } from '../crawler/core/SiteRegistry';
import { MeiliSearchDatabase } from '../database/meili';
import { AppConfig } from '../config/AppConfig';
import Redis from 'ioredis';

const app = express();
const PORT = AppConfig.PORT;
const redis = new Redis(AppConfig.REDIS_URL);
redis.on('error', (err) => console.error('[Redis Error]', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Serve downloaded images from site scrapers
const projectRoot = path.resolve(__dirname, '..', '..');
const sites = getAllSites();
for (const site of sites) {
  if (site.key) {
    app.use(`/${site.key}`, express.static(path.join(projectRoot, 'data', 'sites', site.key)));
  }
}

// Request logging middleware for debugging
app.use((req: Request, res: Response, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

const mongo = MongoDatabase.getInstance();

// 1. HTTP REST API
app.get('/api/collections', async (req: Request, res: Response) => {
  try {
    await mongo.connect();
    const client = (mongo as any).client; // Access private client via any
    if (!client) throw new Error('MongoDB client not initialized');

    const collections: any[] = [];
    
    // Special case for LinkedIn Jobs (Merged)
    const linkedinSite = sites.find(s => s.key === 'linkedin');
    collections.push({
      id: 'linkedin.jobs',
      name: 'LinkedIn Jobs',
      favicon: linkedinSite?.favicon || '',
    });

    // Dynamic fetch from Silver DB
    const silverDb = client.db('silver');
    const silverColls = await silverDb.listCollections({ name: /\.contents$/ }).toArray();
    
    for (const col of silverColls) {
      const name = col.name;
      if (name === 'linkedin.jobs') continue; // Handled by merged case
      
      // format: 'geeknews.contents' -> 'GeekNews'
      const siteName = name.split('.')[0];
      const displayName = siteName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/^\w/, (first: string) => first.toUpperCase());
      
      const site = sites.find(s => s.key === siteName);
      
      collections.push({
        id: `silver/${name}`,
        name: displayName,
        favicon: site?.favicon || '',
      });
    }
    
    // Add LinkedIn Companies if exists in silver
    const hasCompanies = (await silverDb.listCollections({ name: 'linkedin.companies' }).toArray()).length > 0;
    if (hasCompanies) {
      const companySite = sites.find(s => s.key === 'linkedin_company');
      collections.push({
        id: 'silver/linkedin.companies',
        name: 'LinkedIn Companies',
        favicon: companySite?.favicon || '',
      });
    }

    collections.sort((a, b) => a.name.localeCompare(b.name));

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

    let siteKey = '';
    if (collectionName === 'linkedin.jobs') {
      siteKey = 'linkedin';
    } else if (collectionName.startsWith('silver/')) {
      siteKey = collectionName.replace('silver/', '').split('.')[0];
    } else {
      siteKey = collectionName.split('.')[0];
    }

    const meili = MeiliSearchDatabase.getInstance();
    const filter = [`site = "${siteKey}"`];

    if (collectionName === 'linkedin.jobs') {
      const country = req.query.country as string || '';
      if (country) {
        filter.push(`geo = "${country}"`);
      }
    }

    const searchResults = await meili.search('contents', search, {
      filter,
      limit,
      offset: skip,
      sort: ['publishedAt:desc']
    });

    const mappedDocs = searchResults.hits.map(h => ({
      _id: h.docId,
      id: h.docId,
      jobId: h.site === 'linkedin' ? h.docId : undefined,
      title: h.title,
      companyName: h.companyName,
      site: h.site,
      url: h.url,
      geo: h.geo,
      location: h.location,
      publishedAt: h.publishedAt,
      collectedAt: h.publishedAt,
      updatedAt: h.updatedAt,
      hasSilver: true,
      hasBronze: true
    }));

    res.json({
      total: searchResults.estimatedTotalHits,
      page,
      limit,
      documents: mappedDocs
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
      const silverColl = await mongo.getCollection('silver/linkedin.jobs');
      const numId = parseInt(id, 10);
      const filter = isNaN(numId) ? { jobId: id } : { $or: [{ jobId: id }, { jobId: numId }] };
      const silverDoc = await silverColl.findOne(filter);

      if (!silverDoc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Return a lightweight document without bronze's rawHtml
      return res.json({
        isMerged: true,
        bronze: { jobId: silverDoc.jobId, url: silverDoc.url },
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

    // Omit stitching rawHtml here to make it fast
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for lazy loading raw HTML / JSON
app.get('/api/documents/:id/raw', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const collectionName = req.query.collection as string || 'linkedin.jobs';

    if (collectionName === 'linkedin.jobs') {
      const bronzeColl = await mongo.getCollection('bronze/linkedin.jobs');
      const numId = parseInt(id, 10);
      const filter = isNaN(numId) ? { jobId: id } : { $or: [{ jobId: id }, { jobId: numId }] };
      const bronzeDoc = await bronzeColl.findOne(filter);
      
      if (!bronzeDoc) {
        return res.status(404).json({ error: 'Raw HTML not found' });
      }
      return res.json({ rawHtml: bronzeDoc.rawHtml, rawJson: bronzeDoc.rawJson });
    }

    // Other collections
    const site = sites.find(s => s.targetLoader?.collectionName === collectionName);
    if (site && site.scraper?.collectionName) {
      const bronzeColl = await mongo.getCollection(site.scraper.collectionName);
      const updateFilterKey = site.scraper.updateFilterKey || 'id';
      
      const query: any = {};
      if (updateFilterKey !== 'id') {
        query.$or = [
          { [updateFilterKey]: id },
          { id: id }
        ];
      } else {
        query.id = id;
      }
      
      const bronzeDoc = await bronzeColl.findOne(query);
      if (bronzeDoc) {
        return res.json({ rawHtml: bronzeDoc.rawHtml, rawJson: bronzeDoc.rawJson });
      }
    }

    res.status(404).json({ error: 'Raw HTML not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Queue dashboard Type Interfaces
interface ScrapeTaskPayload {
  site: string;
  url: string;
  attempt: number;
  priority: string;
}

interface TransformTaskPayload {
  site: string;
  id: string;
  bronze_db: string;
  bronze_collection: string;
  bronze_id: string;
  timestamp: string;
}

interface DeadLetterPayload {
  site: string;
  url: string;
  error: string;
  failedAt: string;
}

interface QueueInfo {
  name: string;
  type: 'list' | 'set';
  length: number;
  items: ScrapeTaskPayload[] | string[];
}

interface QueueStatusPayload {
  queues: QueueInfo[];
  transformQueue: {
    length: number;
    siteCounts: Record<string, number>;
    items: TransformTaskPayload[];
  };
  activeProcessing: {
    length: number;
    items: string[];
  };
  deadLetter: {
    length: number;
    siteCounts: Record<string, number>;
    items: DeadLetterPayload[];
  };
}

interface AddQueueRequest {
  site: string;
  url: string;
  priority?: string;
}

// Queue dashboard API endpoints
app.get('/api/queues', async (req: Request, res: Response) => {
  try {
    const keys = await redis.keys('scrape_queue*');
    const queues: QueueInfo[] = [];
    
    keys.sort();
    
    for (const key of keys) {
      const type = await redis.type(key);
      if (type === 'list') {
        const length = await redis.llen(key);
        const rawItems = await redis.lrange(key, 0, 19);
        const items = rawItems.map((item): ScrapeTaskPayload => {
          try {
            return JSON.parse(item) as ScrapeTaskPayload;
          } catch {
            return { site: 'Unknown', url: item, attempt: 1, priority: 'medium' };
          }
        });
        queues.push({ name: key, type: 'list', length, items });
      } else if (type === 'set') {
        const length = await redis.scard(key);
        const rawItems = await redis.smembers(key);
        queues.push({ name: key, type: 'set', length, items: rawItems });
      }
    }
    
    const transformQueueLength = await redis.llen('transform_queue');
    const allTransformItems = await redis.lrange('transform_queue', 0, -1);
    const transformQueueSiteCounts: Record<string, number> = {};
    for (const item of allTransformItems) {
      try {
        const parsed = JSON.parse(item);
        const site = parsed.site || 'Unknown';
        transformQueueSiteCounts[site] = (transformQueueSiteCounts[site] || 0) + 1;
      } catch {
        transformQueueSiteCounts['Unknown'] = (transformQueueSiteCounts['Unknown'] || 0) + 1;
      }
    }
    const transformItems = allTransformItems.slice(0, 20).map((item): TransformTaskPayload => {
      try {
        return JSON.parse(item) as TransformTaskPayload;
      } catch {
        return {
          site: 'Unknown',
          id: item,
          bronze_db: 'bronze',
          bronze_collection: '',
          bronze_id: '',
          timestamp: new Date().toISOString()
        };
      }
    });
    
    const activeProcessingLength = await redis.scard('active_processing');
    const activeProcessingItems = await redis.smembers('active_processing');
    
    const deadLetterLength = await redis.llen('dead_letter_queue');
    const allDeadLetterItems = await redis.lrange('dead_letter_queue', 0, -1);
    const deadLetterSiteCounts: Record<string, number> = {};
    for (const item of allDeadLetterItems) {
      try {
        const parsed = JSON.parse(item);
        const site = parsed.site || 'Unknown';
        deadLetterSiteCounts[site] = (deadLetterSiteCounts[site] || 0) + 1;
      } catch {
        deadLetterSiteCounts['Unknown'] = (deadLetterSiteCounts['Unknown'] || 0) + 1;
      }
    }
    const deadLetterItems = allDeadLetterItems.slice(0, 50).map((item): DeadLetterPayload => {
      try {
        return JSON.parse(item) as DeadLetterPayload;
      } catch {
        return {
          site: 'Unknown',
          url: '',
          error: item,
          failedAt: new Date().toISOString()
        };
      }
    });
    
    const responsePayload: QueueStatusPayload = {
      queues,
      transformQueue: {
        length: transformQueueLength,
        siteCounts: transformQueueSiteCounts,
        items: transformItems
      },
      activeProcessing: {
        length: activeProcessingLength,
        items: activeProcessingItems
      },
      deadLetter: {
        length: deadLetterLength,
        siteCounts: deadLetterSiteCounts,
        items: deadLetterItems
      }
    };
    
    res.json(responsePayload);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queues/clear', async (req: Request, res: Response) => {
  try {
    const keys = await redis.keys('scrape_queue*');
    const keysToClear = [...keys];
    
    const activeProcessingExists = await redis.exists('active_processing');
    if (activeProcessingExists) {
      keysToClear.push('active_processing');
    }
    
    const deadLetterExists = await redis.exists('dead_letter_queue');
    if (deadLetterExists) {
      keysToClear.push('dead_letter_queue');
    }
    
    const transformQueueExists = await redis.exists('transform_queue');
    if (transformQueueExists) {
      keysToClear.push('transform_queue');
    }

    if (keysToClear.length === 0) {
      return res.json({ success: true, message: 'No queues found to clear', deletedCount: 0 });
    }

    const deletedCount = await redis.del(...keysToClear);
    res.json({ success: true, message: 'Successfully cleared queues', deletedCount });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queues/add', async (req: Request, res: Response) => {
  try {
    const { site, url, priority = 'medium' } = req.body as AddQueueRequest;
    if (!site || !url) {
      return res.status(400).json({ error: 'Site and URL are required' });
    }
    
    const allSites = getAllSites();
    const siteDesc = allSites.find(s => s.key === site);
    if (!siteDesc || !siteDesc.scraper) {
      return res.status(400).json({ error: `Unsupported or non-scraped site: ${site}` });
    }
    
    const queueName = `scrape_queue:${site}:${priority}`;
    const payload = JSON.stringify({
      site,
      url,
      attempt: 1,
      priority
    });
    
    await redis.rpush(queueName, payload);
    
    if (siteDesc.scraper.urlsCollectionName) {
      const urlsColl = await mongo.getCollection(siteDesc.scraper.urlsCollectionName as `${'bronze' | 'silver'}/${string}`);
      const id = siteDesc.scraper.extractId(url);
      if (id) {
        await urlsColl.updateOne(
          { id },
          {
            $set: {
              id,
              url,
              status: 'new',
              pushedToRedis: true,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }
    
    res.json({ success: true, queue: queueName, url });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({ error: err.message });
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
      let siteKey = '';
      if (collectionName === 'linkedin.jobs') {
        siteKey = 'linkedin';
      } else if (collectionName.startsWith('silver/')) {
        siteKey = collectionName.replace('silver/', '').split('.')[0];
      } else {
        siteKey = collectionName.split('.')[0];
      }

      const meili = MeiliSearchDatabase.getInstance();
      const searchResults = await meili.search('contents', search, {
        filter: [`site = "${siteKey}"`],
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
    await mongo.initIndexes();
    app.listen(PORT, () => {
      console.log(`🚀 [Server] Hybrid HTTP & MCP Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
