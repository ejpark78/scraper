const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { UrlUtils } = require('./src/utils/url');

// Load country registry to verify paths
const configPath = path.join(__dirname, 'config', 'country.json');
const countryMapping = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const listsDir = '/home/ejpark/workspace/linkedin/data/jobs/lists/html';
const files = fs.readdirSync(listsDir).filter(f => f.endsWith('.html'));

const uniqueJobs = new Map();

files.forEach(file => {
    const filePath = path.join(listsDir, file);
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(htmlContent);

    $('div.job-card-container').each((i, el) => {
        let jobId = $(el).attr('data-job-id');
        const titleLink = $(el).find('a.job-card-list__title--link, a.job-card-container__link').first();
        const href = titleLink.attr('href') || '';
        
        if (!jobId || !/^\d+$/.test(jobId)) {
            const m = href.match(/currentJobId=(\d+)/) || href.match(/\/view\/(\d+)/);
            if (m) {
                jobId = m[1];
            }
        }

        if (!jobId || !/^\d+$/.test(jobId)) {
            return;
        }

        const title = titleLink.text().replace(/\s+/g, ' ').trim();
        const company = $(el).find('.artdeco-entity-lockup__subtitle, .job-card-container__company-name').text().replace(/\s+/g, ' ').trim();
        
        let location = '';
        let workStyle = '';
        
        $(el).find('.job-card-container__metadata-wrapper li, span').each((j, item) => {
            const txt = $(item).text().replace(/\s+/g, ' ').trim();
            if (txt && !txt.includes('logo') && txt.length > 2 && txt.length < 100) {
                if (/\b(Hybrid|Remote|On-site|하이브리드|재택근무|상주)\b/i.test(txt)) {
                    workStyle = txt;
                } else if (txt.includes(',') && !location) {
                    location = txt;
                }
            }
        });

        if (!location) {
            const metadataText = $(el).find('.job-card-container__metadata-wrapper').text().replace(/\s+/g, ' ').trim();
            if (metadataText) location = metadataText;
        }

        if (!uniqueJobs.has(jobId)) {
            uniqueJobs.set(jobId, { jobId, title, company, location });
        }
    });
});

console.log(`Extracted total unique jobs: ${uniqueJobs.size}`);

console.log('\n--- Location Standardization Analysis ---');
let matchedCount = 0;
let unmatchedCount = 0;

uniqueJobs.forEach(job => {
    const stdLoc = UrlUtils.standardizeLocation(job.location);
    const isTarget = stdLoc === 'South Korea' || stdLoc === 'Korea' || stdLoc === 'United Arab Emirates' || stdLoc === 'Japan';
    
    if (isTarget) {
        matchedCount++;
        // console.log(`[PASS] ${job.location} -> ${stdLoc} (${job.title} at ${job.company})`);
    } else {
        unmatchedCount++;
        console.log(`[FAIL] ${job.location} -> ${stdLoc} (${job.title} at ${job.company})`);
    }
});

console.log('\nSummary:');
console.log(`  Passed (Target 3 Countries): ${matchedCount}`);
console.log(`  Failed (Other Locations):    ${unmatchedCount}`);
