const fs = require('fs');
const { LinkedInMarkdownConverter } = require('./src/markdown_converter');

const htmlPath = 'data/jobs/html/Abu Dhabi/2026-06-02/4422105720.html';
const html = fs.readFileSync(htmlPath, 'utf-8');

const converter = new LinkedInMarkdownConverter();
const meta = converter.convertHtmlToMarkdown(html, htmlPath);

console.log('--- Metadata ---');
console.log('jobTitle:', meta.jobTitle);
console.log('company:', meta.company);
console.log('location:', meta.rawLocation);
console.log('locationDirName:', meta.locationDirName);
console.log('--- Raw Content ---');
console.log(meta.rawContent);
