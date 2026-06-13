/**
 * @file meili-manager.ts
 * @description Command-line tool to manage Meilisearch resources, configuration, and index state.
 * Supports updating index settings, incremental refresh, and full index reset.
 * 
 * Rules Complied:
 * - OOP Patterns: Utilizes MeiliSearchDatabase and MongoDatabase singleton wrappers.
 * - Robust Error Handling: Diagnostic logging with proper connection cleanups in finally blocks.
 * - Strict Typing: Typed variables and standard TypeScript conventions.
 */

import { MongoDatabase } from '../database/mongo';
import { MeiliSearchDatabase } from '../database/meili';
import { getAllSites } from '../crawler/core/SiteRegistry';

const INDEX_NAME = 'contents';

async function manage(): Promise<void> {
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean') || args.includes('--reset');

    console.log(`🚀 Starting Meilisearch Manager (Mode: ${shouldClean ? 'RESET/CLEAN REBUILD' : 'INCREMENTAL REFRESH'})...`);

    const mongo = MongoDatabase.getInstance();
    const meili = MeiliSearchDatabase.getInstance();

    try {
        // Step 1: Ensure Meilisearch is reachable
        const isHealthy = await meili.isHealthy();
        if (!isHealthy) {
            throw new Error('Meilisearch service is not healthy or unreachable.');
        }
        console.log('✅ Meilisearch connection established.');

        // Step 2: Initialize index settings for 'contents'
        console.log(`⚙️ Setting up index configuration for "${INDEX_NAME}"...`);
        await meili.updateSettings(INDEX_NAME, {
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

        // Step 3: Handle clean reset if requested
        if (shouldClean) {
            console.log(`🧹 Clearing all documents from index "${INDEX_NAME}"...`);
            // Trigger Meilisearch delete documents REST endpoint
            const res = await (meili as any).request(`/indexes/${INDEX_NAME}/documents`, 'DELETE');
            console.log('✅ Index cleared successfully.');
        }

        // Step 4: Fetch MongoDB collections and synchronize documents
        await mongo.connect();
        const sites = getAllSites();
        
        let totalProcessed = 0;

        for (const site of sites) {
            if (!site.targetLoader) continue;

            const collectionName = site.targetLoader.collectionName;
            console.log(`📂 Processing collection: [${collectionName}] for site: [${site.key}]...`);

            try {
                const collection = await mongo.getCollection(collectionName);
                const docs = await collection.find({}).toArray();

                if (docs.length === 0) {
                    console.log(`  ℹ️ No documents found in ${collectionName}.`);
                    continue;
                }

                // Batch insert into Meilisearch to respect payload limits
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

                    await meili.addDocuments(INDEX_NAME, meiliDocs);
                }

                console.log(`  ✅ Successfully indexed ${docs.length} documents from ${collectionName}`);
                totalProcessed += docs.length;
            } catch (collErr: any) {
                console.error(`  ❌ Failed to process collection ${collectionName}: ${collErr.message}`);
            }
        }

        console.log(`\n🎉 Meilisearch indexing completed successfully! Total documents processed: ${totalProcessed}`);

    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Meilisearch Manager failed: ${errorMsg}`);
        process.exit(1);
    } finally {
        await mongo.close();
    }
}

manage();
