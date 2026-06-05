import { MongoDatabase } from '../database/mongo';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('🔄 [Fix Queue] Starting precision recovery of uncollected targets...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    try {
        const bronzeJobs = await mongo.getCollection('bronze.jobs');
        const jobUrlsColl = await mongo.getCollection('bronze.job_urls');

        // 1. config/config.json 파일 또는 환경 변수 GEOS에서 타겟 국가 목록 로드
        let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
        
        if (process.env.GEOS) {
            // GEOS="'South Korea', 'Japan'" 또는 "South Korea, Japan" 형태 파싱 및 따옴표 제거
            targetLocations = process.env.GEOS
                .split(',')
                .map((loc: string) => loc.replace(/['"]/g, '').trim());
            console.log('📌 Overridden targets via GEOS env:', targetLocations);
        } else {
            try {
                const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    if (config.search_targets) {
                        targetLocations = config.search_targets
                            .filter((t: any) => t.enabled !== false)
                            .map((t: any) => t.location);
                    }
                }
            } catch (e: any) {
                console.warn('⚠️  Could not load config.json, using default locations.', e.message);
            }
        }
        console.log('🎯 Target locations for recovery:', targetLocations);

        // 2. 이미 수집 완료된 Job ID 목록 추출
        const completedIds = await bronzeJobs.distinct('jobId');
        console.log(`📥 Loaded ${completedIds.length} already completed Job IDs.`);

        // 3. 미수집 잔여 타겟 선별 후 상태 재설정
        const result = await jobUrlsColl.updateMany(
            { 
                jobId: { $nin: completedIds }, 
                geo: { $in: targetLocations } 
            },
            { 
                $set: { pushedToRedis: false, status: 'new' } 
            }
        );

        console.log(`✨ Recovery complete! Modified Count: ${result.modifiedCount}`);
    } catch (err: any) {
        console.error('❌ Error during queue recovery:', err);
    } finally {
        await mongo.close();
        process.exit(0);
    }
}

main().catch(console.error);
