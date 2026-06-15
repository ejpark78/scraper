/**
 * @file cleanup-uppity.ts
 * @description Cleans up invalid/list pages and duplicate URLs from MongoDB (bronze/uppity.html, bronze/uppity.urls, silver/uppity.contents) and Meilisearch.
 * Matches existing database documents against the updated urlFilter configuration and groups by URL to remove duplicate records.
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
        console.log(`📊 Total URLs in bronze/uppity.urls: ${allUrls.length}`);

        const urlFilter = descriptor.scraper?.urlFilter;
        if (!urlFilter) {
            throw new Error('urlFilter is not defined in site.config.ts');
        }

        const invalidIds: string[] = [];
        const invalidUrls: string[] = [];
        const validDocs: { id: string; url: string }[] = [];

        // Step 1: Detect invalid list/archive/pagination pages
        for (const item of allUrls) {
            if (!item.url) {
                invalidIds.push(item.id);
                continue;
            }

            if (!urlFilter(item.url)) {
                invalidIds.push(item.id);
                invalidUrls.push(item.url);
            } else {
                validDocs.push({ id: item.id, url: item.url });
            }
        }

        console.log(`❌ Found ${invalidIds.length} invalid/list URLs to clean up.`);
        if (invalidUrls.length > 0) {
            console.log('📋 Sample invalid URLs to delete:');
            invalidUrls.slice(0, 10).forEach(u => console.log(`  - ${u}`));
        }

        // Step 2: Detect duplicate articles in silver/uppity.contents (same URL, different IDs)
        console.log('🔍 Detecting duplicate documents in silver/uppity.contents...');
        const silverDocs = await silverContentsColl.find({}, { projection: { id: 1, url: 1 } }).toArray();
        
        // Group by url
        const urlGroups: Record<string, { id: string }[]> = {};
        for (const doc of silverDocs) {
            if (!doc.url) continue;
            if (!urlGroups[doc.url]) {
                urlGroups[doc.url] = [];
            }
            urlGroups[doc.url].push({ id: doc.id });
        }

        const duplicateIds: string[] = [];
        let duplicateUrlCount = 0;

        for (const [url, docs] of Object.entries(urlGroups)) {
            if (docs.length > 1) {
                duplicateUrlCount++;
                // Determine the canonical ID to keep: the one matching the hash of the URL itself
                const canonicalId = descriptor.scraper?.extractId?.(url);
                let keptId = '';
                
                const hasCanonical = docs.some(d => d.id === canonicalId);
                if (hasCanonical) {
                    keptId = canonicalId!;
                } else {
                    // Fallback to first document
                    keptId = docs[0].id;
                }

                // Mark other IDs as duplicates to delete
                for (const doc of docs) {
                    if (doc.id !== keptId) {
                        duplicateIds.push(doc.id);
                    }
                }
            }
        }

        console.log(`👯 Found ${duplicateUrlCount} duplicate URLs containing ${duplicateIds.length} redundant documents.`);

        const allIdsToDelete = Array.from(new Set([...invalidIds, ...duplicateIds]));
        console.log(`🧹 Combined total unique documents to delete across all layers: ${allIdsToDelete.length}`);

        if (allIdsToDelete.length === 0) {
            console.log('✨ No invalid or duplicate documents found. DB is already clean.');
            return;
        }

        // 1. Delete from bronze/uppity.urls
        console.log(`🗑️ Deleting from bronze/uppity.urls...`);
        const delUrlsRes = await bronzeUrlsColl.deleteMany({ id: { $in: allIdsToDelete } });
        console.log(`   └─ Deleted ${delUrlsRes.deletedCount} documents.`);

        // 2. Delete from bronze/uppity.html
        console.log(`🗑️ Deleting from bronze/uppity.html...`);
        const delHtmlRes = await bronzeHtmlColl.deleteMany({ id: { $in: allIdsToDelete } });
        console.log(`   └─ Deleted ${delHtmlRes.deletedCount} documents.`);

        // 3. Delete from silver/uppity.contents
        console.log(`🗑️ Deleting from silver/uppity.contents...`);
        const delContentsRes = await silverContentsColl.deleteMany({ id: { $in: allIdsToDelete } });
        console.log(`   └─ Deleted ${delContentsRes.deletedCount} documents.`);

        // 4. Delete from Meilisearch index contents_uppity
        console.log(`🗑️ Deleting from Meilisearch index: contents_uppity...`);
        let meiliDeleted = 0;
        let meiliErrors = 0;
        
        for (const id of allIdsToDelete) {
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
        console.log('🎉 Cleanup and Deduplication completed successfully!');
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
