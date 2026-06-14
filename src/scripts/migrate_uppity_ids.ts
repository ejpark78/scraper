/**
 * @file migrate_uppity_ids.ts
 * @description Migrates existing Base64 encoded URL IDs in MongoDB to MD5 hash IDs
 * for all uppity collections: bronze/uppity.html, bronze/uppity.urls, and silver/uppity.contents.
 * Resolves duplicates and ensures consistent ID indexing.
 */

import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';
import { AppConfig } from '../config/AppConfig';

function toMd5(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

async function migrateCollection(client: MongoClient, dbName: string, collName: string) {
    const db = client.db(dbName);
    const collection = db.collection(collName);
    
    console.log(`\n📦 Processing collection: ${dbName}.${collName}...`);
    
    // Project only id and url to avoid loading huge rawHtml fields
    const cursor = collection.find({}).project({ id: 1, url: 1 });
    
    let migrateCount = 0;
    let duplicateDeletedCount = 0;
    
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc) continue;
        if (!doc.url) {
            console.warn(`⚠️ Warning: Document _id: ${doc._id} has no url field. Skipping.`);
            continue;
        }
        
        const expectedMd5Id = toMd5(doc.url);
        
        // If the ID is not already the MD5 ID (e.g. it's Base64), we need to migrate it.
        if (doc.id !== expectedMd5Id) {
            const oldId = doc.id;
            
            // Check if a document with the expected MD5 ID already exists in the collection
            const duplicate = await collection.findOne({ id: expectedMd5Id });
            
            if (duplicate) {
                // If a duplicate exists, we remove the old Base64 document to avoid duplicate key errors.
                // We keep the newer/duplicate MD5 document.
                await collection.deleteOne({ _id: doc._id });
                duplicateDeletedCount++;
                console.log(`🗑️ Removed duplicate Base64 document for url: ${doc.url} (Old ID: ${oldId})`);
            } else {
                // If no duplicate exists, update the ID to the MD5 ID.
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { id: expectedMd5Id, updatedAt: new Date() } }
                );
                migrateCount++;
            }
        }
    }
    
    console.log(`✨ Finished ${dbName}.${collName}: Migrated ${migrateCount} IDs, deleted ${duplicateDeletedCount} duplicates.`);
}


async function main() {
    const mongoUrl = AppConfig.MONGO_URL;
    console.log(`🔌 Connecting to MongoDB at ${mongoUrl}...`);
    const client = new MongoClient(mongoUrl);
    
    try {
        await client.connect();
        
        // Migrate the three target collections
        await migrateCollection(client, 'bronze', 'uppity.html');
        await migrateCollection(client, 'bronze', 'uppity.urls');
        await migrateCollection(client, 'silver', 'uppity.contents');
        
        console.log('\n🎉 Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed with error:', err);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    main();
}
