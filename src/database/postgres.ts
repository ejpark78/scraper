import { Pool, PoolClient } from 'pg';

export class PostgresDatabase {
    private static instance: PostgresDatabase;
    private pool: Pool | null = null;
    private connectionString: string;

    private constructor() {
        // 컨테이너 내부일 경우 postgresql://clipper:clipper_pass@postgresql:5432/clipper_silver,
        // 아닐 경우 127.0.0.1 폴백 (포트 비노출로 실 사용은 컨테이너 내부 연동 위주)
        this.connectionString = process.env.DATABASE_URL || 'postgresql://clipper:clipper_pass@postgresql:5432/clipper_silver';
    }

    public static getInstance(): PostgresDatabase {
        if (!PostgresDatabase.instance) {
            PostgresDatabase.instance = new PostgresDatabase();
        }
        return PostgresDatabase.instance;
    }

    public connect(): void {
        if (this.pool) return;
        
        console.log('🔌 [PostgreSQL] Initializing connection pool...');
        this.pool = new Pool({
            connectionString: this.connectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            console.error('❌ [PostgreSQL] Unexpected error on idle client', err);
        });
    }

    public async query(text: string, params?: any[]): Promise<any> {
        this.connect();
        return this.pool!.query(text, params);
    }

    public async getClient(): Promise<PoolClient> {
        this.connect();
        return this.pool!.connect();
    }

    public async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('🔌 [PostgreSQL] Connection pool closed.');
        }
    }
}
