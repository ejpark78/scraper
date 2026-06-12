/**
 * @file extract_yozm_3800.ts
 * @description Temporary script to find Yozm #3800 in MongoDB, write its HTML, and convert it to markdown.
 */

import { MongoDatabase } from '../database/mongo';
import { YozmConverter } from '../crawler/sites/yozm/Converter';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const db = MongoDatabase.getInstance();
  try {
    console.log('Connecting to database...');
    const col = await db.getCollection('bronze/yozm.html');

    console.log('Finding document by id "3800"...');
    let doc = await col.findOne({ id: '3800' });
    if (!doc) {
      console.log('Document not found by id "3800". Searching by title...');
      doc = await col.findOne({ title: { $regex: '자율 에이전트' } });
    }

    if (!doc) {
      console.error('Could not find article #3800 in MongoDB.');
      const allDocs = await col.find({}, { projection: { id: 1, title: 1 } }).limit(20).toArray();
      console.log('Sample docs in bronze/yozm.html:');
      console.log(allDocs);
      return;
    }

    console.log('Found document:', { id: doc.id, title: doc.title });

    // Let's print document keys to see where the html is
    console.log('Document keys:', Object.keys(doc));

    const htmlContent = doc.html || doc.htmlContent || doc.content || doc.rawHtml || doc.body;
    if (!htmlContent) {
      console.error('No HTML content field found in document!', doc);
      return;
    }

    const fixturesDir = path.join(__dirname, '../../tests/sites/yozm/fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const htmlPath = path.join(fixturesDir, '3800.html');
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    console.log(`Saved html to ${htmlPath}`);

    const converter = new YozmConverter();
    const result = await converter.convertHtmlToMarkdown(htmlContent, doc.id || '3800', doc.url || '');
    
    const mdPath = path.join(fixturesDir, '3800.expected.md');
    await converter.prettifyAndSave(result.rawContent, mdPath);
    console.log(`Saved md to ${mdPath}`);
    console.log(`MD content length: ${result.content.length}`);
    if (result.content === '(content extraction failed)' || result.content.length < 100) {
      console.warn('⚠️ WARNING: Content extraction seems to have failed or resulted in very short text!');
    }

  } catch (error) {
    console.error('Error in script:', error);
  } finally {
    await db.close();
  }
}

main();
