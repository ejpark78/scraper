/**
 * @module List
 * @description Core functionality or script runner for List.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies mongo, BaseListService
 * @lastUpdated 2026-06-11
 */

import { Document } from 'mongodb';
import { MongoDatabase } from '../../../database/mongo';
import { BaseListService } from '../../core/BaseListService';

interface PyTorchListDocument extends Document {
    _id: string;
    collectedAt: Date;
}

class PyTorchKRList extends BaseListService {
    constructor() {
        super({
            site: 'pytorch_kr',
            displayName: 'PyTorch KR',
            cacheSetKey: 'completed_news',
            bronzeHtmlCollection: 'bronze/pytorch_kr.html',
            urlsCollection: 'bronze/pytorch_kr.urls',
        });
    }

    public async run(page: number = 1): Promise<number> {
        const sleepSec = parseInt(process.env.LIST_SLACK || '3', 10);
        if (sleepSec > 0) {
            console.log(`💤 [대기] PyTorch KR 목록 수집 전 ${sleepSec}초 대기 중...`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }

        const url = `https://discuss.pytorch.kr/latest.json?no_definitions=true&page=${page}`;
        console.log(`🌐 [PyTorch KR List] Fetching index JSON: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch PyTorch KR index. Status: ${response.status}`);
        }

        const data = await response.json();
        const topics = data.topic_list?.topics || [];
        console.log(`🔍 [PyTorch KR List] Found ${topics.length} topics on index page.`);

        const dbInstance = MongoDatabase.getInstance();

        await this.seedCache();

        let queuedCount = 0;

        for (const topic of topics) {
            const id = String(topic.id);
            const slug = topic.slug;
            const title = topic.title;

            if (!id || !slug) continue;

            try {
                const pytorchListsColl = await dbInstance.getCollection<PyTorchListDocument>('bronze/pytorch_kr.lists');
                const cleanTopic = { ...topic };
                delete (cleanTopic as any)._id;
                await pytorchListsColl.updateOne(
                    { _id: `${slug}_${id}` },
                    {
                        $set: {
                            ...cleanTopic,
                            collectedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            } catch (dbErr: any) {
                console.error(`⚠️ Failed to save topic list snapshot to MongoDB: ${dbErr.message}`);
            }

            const detailUrl = `https://discuss.pytorch.kr/t/${slug}/${id}`;

            if (await this.processItem(id, detailUrl, title)) {
                queuedCount++;
            }
        }

        console.log(`🎉 [PyTorch KR List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new PyTorchKRList();
        try {
            await list.init();
            const arg = process.argv[2] || '1';

            if (arg.includes('-')) {
                const [startStr, endStr] = arg.split('-');
                const start = parseInt(startStr, 10) || 1;
                const end = parseInt(endStr, 10) || start;
                console.log(`🚀 [PyTorch KR List] Running page range: ${start} to ${end}`);

                for (let p = start; p <= end; p++) {
                    console.log(`\n📄 [PyTorch KR List] Processing page ${p}/${end}...`);
                    await list.run(p);
                }
            } else {
                const page = parseInt(arg, 10) || 1;
                await list.run(page);
            }
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
