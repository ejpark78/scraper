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
    const shouldClean = args.includes('--clean') || args.includes('--reset') || args.includes('--reindex');
    let targetSiteKey = '';
    const siteIdx = args.indexOf('--site');
    if (siteIdx !== -1 && args[siteIdx + 1]) {
        targetSiteKey = args[siteIdx + 1];
    }

    console.log(`🚀 Starting Meilisearch Manager (Mode: ${shouldClean ? 'RESET/CLEAN REBUILD' : 'INCREMENTAL REFRESH'}, Site: ${targetSiteKey || 'ALL'})...`);

    const mongo = MongoDatabase.getInstance();
    const meili = MeiliSearchDatabase.getInstance();

    try {
        // Step 1: Ensure Meilisearch is reachable
        const isHealthy = await meili.isHealthy();
        if (!isHealthy) {
            throw new Error('Meilisearch service is not healthy or unreachable.');
        }
        console.log('✅ Meilisearch connection established.');

        let sites = getAllSites();
        if (targetSiteKey) {
            sites = sites.filter(s => s.key === targetSiteKey);
            if (sites.length === 0) {
                throw new Error(`Site "${targetSiteKey}" not found in SiteRegistry.`);
            }
        }

        // Step 2 & 3: Initialize settings and clean/reset indexes for each site
        for (const site of sites) {
            if (!site.targetLoader) continue;
            const indexName = `contents_${site.key}`;

            console.log(`⚙️ Setting up index configuration for "${indexName}"...`);
            await meili.updateSettings(indexName, {
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
            console.log(`✅ Index settings initialized successfully for "${indexName}".`);

            if (shouldClean) {
                console.log(`🧹 Clearing all documents from index "${indexName}"...`);
                await (meili as any).request(`/indexes/${indexName}/documents`, 'DELETE');
                console.log(`✅ Index "${indexName}" cleared successfully.`);
            }
        }

        // Step 4: Fetch MongoDB collections and synchronize documents
        await mongo.connect();
        
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
                const indexName = `contents_${site.key}`;
                const batchSize = 100;
                for (let i = 0; i < docs.length; i += batchSize) {
                    const batch = docs.slice(i, i + batchSize);
                    const meiliDocs = batch.map(doc => {
                        const docId = doc[site.targetLoader!.filterField] || doc.id || doc._id;
                        let publishedAt = doc.publishedAt || doc.collectedAt || doc.createdAt || doc.scrapedAt || null;
                        
                        if (!publishedAt) {
                            if (site.key === 'linkedin' && doc.description) {
                                const match = doc.description.match(/posted_date:\s*"([^"]+)"/) || doc.description.match(/\*\*포스팅 날짜 \(Posted Date\):\*\*\s*([^\n]+)/);
                                if (match) {
                                    publishedAt = match[1].trim();
                                }
                            } else if (site.key === 'geeknews' && (doc.markdown || doc.content)) {
                                const md = doc.markdown || doc.content || '';
                                const match = md.match(/\*\*작성일:\*\*\s*([^\n]+)/);
                                if (match && match[1].trim() !== '정보 없음') {
                                    publishedAt = match[1].trim();
                                }
                            }
                        }
                        
                        if (!publishedAt) {
                            publishedAt = doc.updatedAt || new Date().toISOString();
                        }

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
                            publishedAt: publishedAt,
                            updatedAt: doc.updatedAt || new Date().toISOString()
                        };
                    });

                    await meili.addDocuments(indexName, meiliDocs);
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
