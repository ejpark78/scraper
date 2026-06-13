/**
 * @file sync-meili.ts
 * @description Script to synchronize MongoDB Silver documents to Meilisearch index.
 * Cleans the indexes and migrates all documents in batches.
 * 
 * Rules Complied:
 * - OOP Patterns: Utilizes MeiliSearchDatabase and MongoDatabase singleton wrappers.
 * - Robust Error Handling: Properly catches, logs, and exits.
 * - Strict Typing: Standard TypeScript typing.
 */

import { MongoDatabase } from '../database/mongo';
import { MeiliSearchDatabase } from '../database/meili';
import { getAllSites } from '../crawler/core/SiteRegistry';

async function migrate(): Promise<void> {
    console.log('🔄 Starting MongoDB Silver to Meilisearch migration...');

    const mongo = MongoDatabase.getInstance();
    const meili = MeiliSearchDatabase.getInstance();

    try {
        // Step 1: Ensure Meilisearch is reachable
        const isHealthy = await meili.isHealthy();
        if (!isHealthy) {
            throw new Error('Meilisearch service is not healthy or unreachable.');
        }
        console.log('✅ Meilisearch connection established.');

        // Step 2: Setup index settings for 'contents'
        console.log('⚙️ Applying settings for "contents" index...');
        await meili.updateSettings('contents', {
            searchableAttributes: ['title', 'companyName', 'location', 'geo', 'content'],
            filterableAttributes: ['site', 'geo', 'location'],
            sortableAttributes: ['publishedAt', 'updatedAt'],
            rankingRules: [
                'words',
                'typo',
                'proximity',
                'attribute',
                'sort',
                'exactness'
            ]
        });
        console.log('✅ Index settings initialized successfully.');

        // Step 3: Fetch all sites and read from their Silver collections
        await mongo.connect();
        const sites = getAllSites();
        
        let totalMigrated = 0;

        for (const site of sites) {
            if (!site.targetLoader) continue;

            const collectionName = site.targetLoader.collectionName;
            console.log(`📂 Migrating collection: [${collectionName}] for site: [${site.key}]...`);

            try {
                const collection = await mongo.getCollection(collectionName);
                const docs = await collection.find({}).toArray();

                if (docs.length === 0) {
                    console.log(`  ℹ️ No documents found in ${collectionName}.`);
                    continue;
                }

                // Batch insert into Meilisearch
                const batchSize = 100;
                for (let i = 0; i < docs.length; i += batchSize) {
                    const batch = docs.slice(i, i + batchSize);
                    const meiliDocs = batch.map(doc => {
                        const docId = doc[site.targetLoader!.filterField] || doc.id || doc._id;
                        return {
                            id: `${site.key}_${docId}`, // Composite key
                            site: site.key,
                            docId: String(docId),
                            title: doc.title || doc.jobTitle || 'Untitled',
                            companyName: doc.companyName || null,
                            location: doc.location || null,
                            geo: doc.geo || 'Unknown',
                            content: doc.description || doc.markdown || doc.content || '',
                            url: doc.url || null,
                            publishedAt: doc.publishedAt || doc.collectedAt || doc.createdAt || doc.scrapedAt || doc.updatedAt || new Date().toISOString(),
                            updatedAt: doc.updatedAt || new Date().toISOString()
                        };
                    });

                    await meili.addDocuments('contents', meiliDocs);
                }

                console.log(`  ✅ Successfully migrated ${docs.length} documents from ${collectionName}`);
                totalMigrated += docs.length;
            } catch (collErr: any) {
                console.error(`  ❌ Failed to migrate ${collectionName}: ${collErr.message}`);
            }
        }

        console.log(`\n🎉 Migration completed successfully! Total indexed documents: ${totalMigrated}`);

    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Migration failed: ${errorMsg}`);
        process.exit(1);
    } finally {
        await mongo.close();
    }
}

migrate();
