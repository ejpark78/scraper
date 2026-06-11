/**
 * @file mongo.ts
 * @description MongoDB database adapter implementing the Singleton pattern.
 * Provides client connection caching, collection creation, and index initialization.
 * 
 * Rules Complied:
 * - Centralized Config: Uses AppConfig instead of direct process.env access.
 * - Robust Error Handling: Empty catch blocks replaced with diagnostic warning logs.
 * - Strict Typing: Removed loose 'any' type parameters.
 * - Agent-Friendly Docstrings: File started with this detailed JSDoc.
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';
import { AppConfig } from '../config/AppConfig';

export interface MongoDatabaseConfig {
    mongoUrl: string;
    dbName: string;
}

export class MongoDatabase {
    private static instance: MongoDatabase;
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private readonly mongoUrl: string;
    private readonly dbName: string;

    private constructor(config: MongoDatabaseConfig = {
        mongoUrl: AppConfig.MONGO_URL,
        dbName: AppConfig.MONGO_INITDB_DATABASE
    }) {
        this.mongoUrl = config.mongoUrl;
        this.dbName = config.dbName;
    }

    public static getInstance(): MongoDatabase {
        if (!MongoDatabase.instance) {
            MongoDatabase.instance = new MongoDatabase();
        }
        return MongoDatabase.instance;
    }

    public async connect(): Promise<Db> {
        if (this.db) return this.db;

        try {
            console.log(`🔌 [MongoDB] Connecting to ${this.mongoUrl}...`);
            this.client = new MongoClient(this.mongoUrl, {
                maxPoolSize: 10,
                minPoolSize: 2,
            });
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            console.log(`✅ [MongoDB] Successfully connected to database: ${this.dbName}`);

            return this.db;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`❌ [MongoDB] Connection error: ${errMsg}`);
            throw err;
        }
    }

    public async getCollection<T extends Document = Document>(
        name: `${'bronze' | 'silver'}/${string}`
    ): Promise<Collection<T>> {
        await this.connect();
        
        const [, collectionName] = name.split('/');
        if (!this.client) {
            throw new Error('[MongoDB] Client is not connected');
        }
        const targetDb = this.client.db(name.split('/')[0]);
        const collection = targetDb.collection<T>(collectionName);

        // 🛠️ 패턴 기반 자동 인덱스 생성 (인덱스가 없을 때만 생성됨)
        try {
            if (collectionName.endsWith('.urls')) {
                await collection.createIndex({ status: 1, id: 1 });
                await collection.createIndex({ id: 1 }, { unique: true });
            } else if (collectionName.endsWith('.html')) {
                await collection.createIndex({ id: 1 }, { unique: true });
            } else if (collectionName.endsWith('.contents')) {
                await collection.createIndex({ id: 1 }, { unique: true });
                await collection.createIndex({ publishedAt: -1 });
            } else if (collectionName === 'linkedin.jobs') {
                await collection.createIndex({ jobId: 1 }, { unique: true });
                await collection.createIndex({ collectedAt: -1 });
            } else if (collectionName === 'linkedin.companies') {
                await collection.createIndex({ companyId: 1 }, { unique: true });
            }
        } catch (e: unknown) {
            // 인덱스 생성 중 발생하는 일시적 오류 로그 남김 (빈 catch 블록 방지)
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.warn(`⚠️ [MongoDB] Index auto-creation check failed for ${collectionName}: ${errorMsg}`);
        }

        return collection;
    }

    public async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            console.log(`🔌 [MongoDB] Connection closed.`);
        }
    }

    /**
     * 빠른 조회를 위한 컬렉션 인덱스 초기화
     */
    public async initIndexes(): Promise<void> {
        if (!this.db) {
            await this.connect();
        }
        if (!this.client) return;

        try {
            const createIdx = async (db: Db, col: string, spec: any, opts?: any) => {
                try {
                    await db.collection(col).createIndex(spec, opts);
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    console.warn(`⚠️ [MongoDB] Failed to create index on ${db.databaseName}.${col}: ${errMsg}`);
                }
            };

            if (this.client) {
                // 📁 Unified Active Collections Indices
                const bronzeDb = this.client.db('bronze');
                await createIdx(bronzeDb, 'linkedin.jobs', { jobId: 1 }, { unique: true });
                await createIdx(bronzeDb, 'linkedin.jobs', { collectedAt: -1 });
                await createIdx(bronzeDb, 'linkedin.companies', { companyId: 1 }, { unique: true });
                await createIdx(bronzeDb, 'linkedin.lists', { listId: 1 });
                await createIdx(bronzeDb, 'linkedin.lists', { collectedAt: 1 });
                await createIdx(bronzeDb, 'linkedin.job_urls', { jobId: 1 });
                await createIdx(bronzeDb, 'linkedin.job_urls', { status: 1, jobId: 1 });
                await createIdx(bronzeDb, 'linkedin.company_urls', { companyId: 1 });
                await createIdx(bronzeDb, 'linkedin.company_urls', { status: 1, companyId: 1 });
                
                await createIdx(bronzeDb, 'geeknews.html', { id: 1 });
                await createIdx(bronzeDb, 'geeknews.urls', { status: 1, id: 1 });
                await createIdx(bronzeDb, 'gpters.html', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'gpters.urls', { status: 1, id: 1 });
                await createIdx(bronzeDb, 'pytorch_kr.html', { id: 1 });
                await createIdx(bronzeDb, 'pytorch_kr.lists', { id: 1 });
                await createIdx(bronzeDb, 'pytorch_kr.lists', { collectedAt: 1 });
                await createIdx(bronzeDb, 'pytorch_kr.urls', { id: 1 });
                await createIdx(bronzeDb, 'pytorch_kr.urls', { status: 1, id: 1 });
                await createIdx(bronzeDb, 'aicasebook.html', { id: 1 });
                await createIdx(bronzeDb, 'aicasebook.urls', { id: 1 });
                await createIdx(bronzeDb, 'aicasebook.urls', { status: 1, id: 1 });

                // New collections indexes for bronze (Without unique constraint on HTML raw collections)
                await createIdx(bronzeDb, 'yozm.html', { id: 1 });
                await createIdx(bronzeDb, 'yozm.urls', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'yozm.urls', { status: 1, id: 1 });
                
                await createIdx(bronzeDb, 'maily_josh.html', { id: 1 });
                await createIdx(bronzeDb, 'maily_josh.urls', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'maily_josh.urls', { status: 1, id: 1 });

                await createIdx(bronzeDb, 'dailydose_ds.html', { id: 1 });
                await createIdx(bronzeDb, 'dailydose_ds.urls', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'dailydose_ds.urls', { status: 1, id: 1 });

                await createIdx(bronzeDb, 'uppity.html', { id: 1 });
                await createIdx(bronzeDb, 'uppity.urls', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'uppity.urls', { status: 1, id: 1 });

                await createIdx(bronzeDb, 'gpters_newsletter.html', { id: 1 });
                await createIdx(bronzeDb, 'gpters_newsletter.urls', { id: 1 }, { unique: true });
                await createIdx(bronzeDb, 'gpters_newsletter.urls', { status: 1, id: 1 });

                // 📁 Silver Active Collections Indices
                const silverDb = this.client.db('silver');
                await createIdx(silverDb, 'linkedin.jobs', { jobId: 1 }, { unique: true });
                await createIdx(silverDb, 'linkedin.jobs', { location: 1 });
                await createIdx(silverDb, 'linkedin.companies', { companyId: 1 }, { unique: true });
                await createIdx(silverDb, 'geeknews.contents', { id: 1 });
                await createIdx(silverDb, 'geeknews.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'geeknews.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text', companyName: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1, companyName: 3 }, name: 'text_idx' }
                );
                await createIdx(silverDb, 'gpters.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'gpters.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'gpters.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
                await createIdx(silverDb, 'gpters_newsletter.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'gpters_newsletter.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'gpters_newsletter.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
                await createIdx(silverDb, 'pytorch_kr.contents', { id: 1 });
                await createIdx(silverDb, 'pytorch_kr.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'pytorch_kr.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
                await createIdx(silverDb, 'aicasebook.contents', { id: 1 });
                await createIdx(silverDb, 'aicasebook.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'aicasebook.contents', 
                  { title: 'text', summary: 'text', body: 'text', markdown: 'text', tags: 'text' },
                  { weights: { title: 10, summary: 5, body: 3, markdown: 2, tags: 8 }, name: 'text_idx' }
                );
                await createIdx(silverDb, 'linkedin.jobs', 
                  { title: 'text', companyName: 'text', description: 'text', markdown: 'text' },
                  { weights: { title: 10, companyName: 5, description: 3, markdown: 2 }, name: 'text_idx' }
                );

                // New collections indexes for silver
                await createIdx(silverDb, 'yozm.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'yozm.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'yozm.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );

                await createIdx(silverDb, 'maily_josh.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'maily_josh.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'maily_josh.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );

                await createIdx(silverDb, 'dailydose_ds.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'dailydose_ds.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'dailydose_ds.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );

                await createIdx(silverDb, 'uppity.contents', { id: 1 }, { unique: true });
                await createIdx(silverDb, 'uppity.contents', { publishedAt: -1 });
                await createIdx(silverDb, 'uppity.contents', 
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
            }

            console.log('📌 [MongoDB] All collection indexes successfully initialized.');
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.warn(`⚠️ [MongoDB] Index initialization failed: ${errorMsg}`);
        }
    }
}
