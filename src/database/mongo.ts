import { MongoClient, Db, Collection } from 'mongodb';

export class MongoDatabase {
    private static instance: MongoDatabase;
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private mongoUrl: string;
    private dbName: string;

    private constructor() {
        // 컨테이너 내부일 경우 mongodb://mongodb:27017, 아닐 경우 127.0.0.1:27017 폴백
        this.mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
        this.dbName = process.env.MONGO_INITDB_DATABASE || 'linkedin';
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

            // 인덱스 초기화 실행
            await this.initIndexes();

            return this.db;
        } catch (err: any) {
            console.error(`❌ [MongoDB] Connection error: ${err.message}`);
            throw err;
        }
    }

    public async getCollection<T extends Document = any>(
        name: `${'bronze' | 'silver'}/${string}`
    ): Promise<Collection<T>> {
        await this.connect();
        
        const [dbName, collectionName] = name.split('/');
        if (!this.client) {
            throw new Error('[MongoDB] Client is not connected');
        }
        const targetDb = this.client.db(dbName);
        return targetDb.collection<T>(collectionName);
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
    private async initIndexes(): Promise<void> {
        if (!this.db) return;

        try {
            // 📁 Unified Active Collections Indices
            if (this.client) {
                const bronzeDb = this.client.db('bronze');
                await bronzeDb.collection('linkedin.jobs').createIndex({ jobId: 1 }, { unique: true });
                await bronzeDb.collection('linkedin.companies').createIndex({ companyId: 1 }, { unique: true });
                await bronzeDb.collection('linkedin.lists').createIndex({ listId: 1 });
                await bronzeDb.collection('linkedin.lists').createIndex({ collectedAt: 1 });
                await bronzeDb.collection('linkedin.job_urls').createIndex({ jobId: 1 });
                await bronzeDb.collection('linkedin.company_urls').createIndex({ companyId: 1 });
                
                await bronzeDb.collection('geeknews.html').createIndex({ id: 1 });
                await bronzeDb.collection('gpters.html').createIndex({ id: 1 }, { unique: true });
                await bronzeDb.collection('pytorch_kr.html').createIndex({ id: 1 });
                await bronzeDb.collection('pytorch_kr.lists').createIndex({ id: 1 });
                await bronzeDb.collection('pytorch_kr.lists').createIndex({ collectedAt: 1 });
                await bronzeDb.collection('pytorch_kr.urls').createIndex({ id: 1 });

                // 📁 Silver Active Collections Indices
                const silverDb = this.client.db('silver');
                await silverDb.collection('linkedin.jobs').createIndex({ jobId: 1 }, { unique: true });
                await silverDb.collection('linkedin.companies').createIndex({ companyId: 1 }, { unique: true });
                await silverDb.collection('geeknews.contents').createIndex({ id: 1 });
                await silverDb.collection('geeknews.contents').createIndex({ publishedAt: -1 });
                await silverDb.collection('geeknews.contents').createIndex(
                  { title: 'text', content: 'text', markdown: 'text', url: 'text', companyName: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1, companyName: 3 }, name: 'text_idx' }
                );
                await silverDb.collection('gpters.contents').createIndex({ id: 1 }, { unique: true });
                await silverDb.collection('gpters.contents').createIndex({ publishedAt: -1 });
                await silverDb.collection('gpters.contents').createIndex(
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
                await silverDb.collection('pytorch_kr.contents').createIndex({ id: 1 });
                await silverDb.collection('pytorch_kr.contents').createIndex({ publishedAt: -1 });
                await silverDb.collection('pytorch_kr.contents').createIndex(
                  { title: 'text', content: 'text', markdown: 'text', url: 'text' },
                  { weights: { title: 10, content: 5, markdown: 3, url: 1 }, name: 'text_idx' }
                );
                await silverDb.collection('linkedin.jobs').createIndex(
                  { title: 'text', companyName: 'text', description: 'text', markdown: 'text' },
                  { weights: { title: 10, companyName: 5, description: 3, markdown: 2 }, name: 'text_idx' }
                );
            }

            console.log('📌 [MongoDB] All collection indexes successfully initialized.');
        } catch (e: any) {
            console.warn(`⚠️ [MongoDB] Index initialization failed: ${e.message}`);
        }
    }
}
