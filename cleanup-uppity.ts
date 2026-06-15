/**
 * @file cleanup-uppity.ts
 * @description Cleans up invalid/list pages from MongoDB (bronze/uppity.html, bronze/uppity.urls, silver/uppity.contents) and Meilisearch.
 * Matches existing database documents against the updated urlFilter configuration.
 * @constraints
 *   - Follows strict OOP patterns and clean error/connection handling.
 * @dependencies MongoDatabase, MeiliSearchDatabase, descriptor
 * @lastUpdated 2026-06-15
 */

import { MongoDatabase } from './src/database/mongo';
import { MeiliSearchDatabase } from './src/database/meili';
import { descriptor } from './src/crawler/sites/uppity/site.config';

class UppityCleanup {
    private mongo = MongoDatabase.getInstance();
    private meili = MeiliSearchDatabase.getInstance();

    public async run(): Promise<void> {
        console.log('🔌 Connecting to MongoDB...');
        await this.mongo.connect();

        const bronzeUrlsColl = await this.mongo.getCollection('bronze/uppity.urls');
        const bronzeHtmlColl = await this.mongo.getCollection('bronze/uppity.html');
        const silverContentsColl = await this.mongo.getCollection('silver/uppity.contents');

        console.log('🔍 Fetching all URLs from bronze/uppity.urls...');
        const allUrls = await bronzeUrlsColl.find({}, { projection: { id: 1, url: 1 } }).toArray();
        console.log(`📊 Total URLs in database: ${allUrls.length}`);

        const urlFilter = descriptor.scraper?.urlFilter;
        if (!urlFilter) {
            throw new Error('urlFilter is not defined in site.config.ts');
        }

        const invalidIds: string[] = [];
        const invalidUrls: string[] = [];

        for (const item of allUrls) {
            if (!item.url) {
                invalidIds.push(item.id);
                continue;
            }

            // If the urlFilter evaluates to false, it is an invalid target (list, pagination, category, etc.)
            if (!urlFilter(item.url)) {
                invalidIds.push(item.id);
                invalidUrls.push(item.url);
            }
        }

        console.log(`❌ Found ${invalidIds.length} invalid/list URLs to clean up.`);

        if (invalidIds.length === 0) {
            console.log('✨ No invalid URLs found. DB is already clean.');
            return;
        }

        // Display sample invalid URLs
        console.log('📋 Sample invalid URLs to delete:');
        invalidUrls.slice(0, 10).forEach(u => console.log(`  - ${u}`));

        // 1. Delete from bronze/uppity.urls
        console.log(`🗑️ Deleting from bronze/uppity.urls...`);
        const delUrlsRes = await bronzeUrlsColl.deleteMany({ id: { $in: invalidIds } });
        console.log(`   └─ Deleted ${delUrlsRes.deletedCount} documents.`);

        // 2. Delete from bronze/uppity.html
        console.log(`🗑️ Deleting from bronze/uppity.html...`);
        const delHtmlRes = await bronzeHtmlColl.deleteMany({ id: { $in: invalidIds } });
        console.log(`   └─ Deleted ${delHtmlRes.deletedCount} documents.`);

        // 3. Delete from silver/uppity.contents
        console.log(`🗑️ Deleting from silver/uppity.contents...`);
        const delContentsRes = await silverContentsColl.deleteMany({ id: { $in: invalidIds } });
        console.log(`   └─ Deleted ${delContentsRes.deletedCount} documents.`);

        // 4. Delete from Meilisearch index contents_uppity
        console.log(`🗑️ Deleting from Meilisearch index: contents_uppity...`);
        let meiliDeleted = 0;
        let meiliErrors = 0;
        
        for (const id of invalidIds) {
            try {
                // Composite key structure used in IndexerWorker.ts: `${site}_${id}`
                const compositeId = `uppity_${id}`;
                await this.meili.deleteDocument('contents_uppity', compositeId);
                meiliDeleted++;
            } catch (err: any) {
                // If it wasn't indexed in the first place, Meilisearch returns 404
                if (err.message && err.message.includes('404')) {
                    continue;
                }
                meiliErrors++;
            }
        }
        console.log(`   └─ Deleted from Meilisearch: ${meiliDeleted} documents (unindexed/404 skipped). Errors: ${meiliErrors}`);
        console.log('🎉 Cleanup completed successfully!');
    }

    public async close(): Promise<void> {
        await this.mongo.close();
    }
}

if (require.main === module) {
    (async () => {
        const cleanup = new UppityCleanup();
        try {
            await cleanup.run();
        } catch (e: any) {
            console.error(`❌ Cleanup execution failed: ${e.message}`, e);
        } finally {
            await cleanup.close();
        }
    })();
}
