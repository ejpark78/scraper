import * as fs from 'fs';
import * as path from 'path';
import { HtmlDebugger } from '../crawler/utils/HtmlDebugger';

function main() {
  const htmlPath = path.join(__dirname, '../../tests/sites/yozm/fixtures/3800.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('3800.html does not exist');
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');

  // Print parents of typo-contents16 to show why first parent selection fails
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  console.log('\n--- Trace Parents of First few typo-contents16 elements ---');
  $('.typo-contents16').slice(0, 5).each((idx: number, el: any) => {
    const parent = $(el).parent();
    console.log(`[${idx}] text length: ${$(el).text().trim().length}`);
    console.log(`    Parent tag: <${(parent[0] as any).name} id="${parent.attr('id') || ''}" class="${parent.attr('class') || ''}">`);
    const grand = parent.parent();
    if (grand.length) {
      console.log(`    Grandparent tag: <${(grand[0] as any).name} id="${grand.attr('id') || ''}" class="${grand.attr('class') || ''}">`);
    }
  });

  // Call the library-ized HtmlDebugger to display full analysis report
  HtmlDebugger.printAnalysisReport(html);
}

main();
