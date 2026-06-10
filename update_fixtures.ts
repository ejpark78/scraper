import * as fs from 'fs';
import * as path from 'path';
import { DailyDoseDSConverter } from './src/crawler/sites/dailydoseofds/Converter';

async function updateFixtures() {
    const converter = new DailyDoseDSConverter();
    const fixturesDir = path.join(__dirname, 'tests/sites/dailydoseofds/fixtures');
    const files = fs.readdirSync(fixturesDir);
    const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('archive'));

    console.log(`Updating fixtures in ${fixturesDir}...`);

    for (const file of htmlFiles) {
        const html = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
        const url = `https://www.dailydoseofds.com/${file.replace('.html', '')}`;
        const result = converter.convertHtmlToMarkdown(html, 'test-id', url);
        
        const expectedFileName = file.replace('.html', '.expected.md');
        fs.writeFileSync(path.join(fixturesDir, expectedFileName), result.rawContent);
        console.log(`✅ Updated ${expectedFileName}`);
    }
    console.log('🎉 All fixtures updated successfully!');
}

updateFixtures().catch(console.error);
