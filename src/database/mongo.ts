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

    public async getCollection<T extends Document = any>(name: string): Promise<Collection<T>> {
        const db = await this.connect();
        return db.collection<T>(name);
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
            // 🥉 Bronze Layer Indices
            await this.db.collection('bronze.jobs').createIndex({ jobId: 1 }, { unique: true });
            await this.db.collection('bronze.companies').createIndex({ companyId: 1 }, { unique: true });

            // 🥈 Silver Layer Indices
            await this.db.collection('silver.jobs').createIndex({ jobId: 1 }, { unique: true });
            await this.db.collection('silver.jobs').createIndex({ geo: 1 });
            await this.db.collection('silver.jobs').createIndex({ companyId: 1 });

            await this.db.collection('silver.companies').createIndex({ companyId: 1 }, { unique: true });

            console.log('📌 [MongoDB] All collection indexes successfully initialized.');
        } catch (e: any) {
            console.warn(`⚠️ [MongoDB] Index initialization failed: ${e.message}`);
        }
    }
}
