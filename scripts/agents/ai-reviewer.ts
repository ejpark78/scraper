import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

/**
 * 🤖 ai-reviewer.ts
 *
 * 로컬 git diff를 로드하고, docs/prompts/review_checklist.md 와
 * AGENTS.md 내 규칙을 활용하여 AI 코드 리뷰 보고서를 작성합니다.
 */

async function main() {
  const diffFilePath = process.argv[2];
  if (!diffFilePath || !fs.existsSync(diffFilePath)) {
    console.error('❌ Error: Git diff temporary file not provided or not found.');
    process.exit(1);
  }

  const diffContent = fs.readFileSync(diffFilePath, 'utf-8');
  if (diffContent.trim().length === 0) {
    console.log('✨ No code changes to review.');
    process.exit(0);
  }

  const rootDir = path.resolve(__dirname, '../..');
  const checklistPath = path.join(rootDir, 'docs/prompts/review_checklist.md');
  const agentsRulePath = path.join(rootDir, 'AGENTS.md');

  let checklist = '';
  if (fs.existsSync(checklistPath)) {
    checklist = fs.readFileSync(checklistPath, 'utf-8');
  }

  let agentsRule = '';
  if (fs.existsSync(agentsRulePath)) {
    agentsRule = fs.readFileSync(agentsRulePath, 'utf-8');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is not defined.');
    process.exit(1);
  }

  console.log('🧠 Sending code changes to Gemini for review...');

  const systemInstruction = `
당신은 최고의 10x Senior Full-Stack TypeScript/Python Engineer이자 코드 품질 감사자(QA)입니다.
제시된 코드 변경 내역(Git Diff)을 분석하고, 프로젝트의 설계 규칙(AGENTS.md) 및 품질 체크리스트(review_checklist.md)를 준수하는지 꼼꼼하게 검토해주세요.

[검토 및 보고 형식]
1. ⚠️ 발견된 경고/문제점 (없다면 "없음")
   - STRICT TYPING 위반 (any 사용 여부 등)
   - Connection Leak 가능성 (MongoDB, Redis, Redis Namespace 등 closing/quit 누락)
   - DRY 원칙 및 아키텍처 규칙 위반 (예: process.env에 직접 접근 등)
   - 보안 이슈 (.env 내용 노출, API Key 하드코딩 등)
2. 💡 개선 권장 사항 (코드 개선 제안)
3. 🎯 종합 판정: [통과], [보완 권장], [재작성 필요] 중 하나로 표시하고 짧은 요약 작성.

모든 의견과 보고서는 개발자가 이해하기 쉽도록 친절한 한국어로 작성하십시오.
  `;

  const prompt = `
[프로젝트 규칙 및 지침 (AGENTS.md)]
${agentsRule}

[품질 체크리스트 (review_checklist.md)]
${checklist}

[코드 변경 내역 (Git Diff)]
${diffContent}

위 변경 사항에 대해 정밀 코드 리뷰를 진행하고 보고서를 작성해줘.
  `;

  try {
    const report = await callGeminiAPI(apiKey, systemInstruction, prompt);
    console.log('\n==================================================');
    console.log('📝 AI CODE REVIEW REPORT');
    console.log('==================================================');
    console.log(report);
    console.log('==================================================\n');

    // 보고서를 로컬 파일로 임시 저장
    const reportPath = path.join(rootDir, 'docs/artifacts/review-report.md');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`💾 Review report saved to: ${reportPath}\n`);
  } catch (error: any) {
    console.error('❌ Error occurred while contacting Gemini API:', error.message || error);
    process.exit(1);
  }
}

function callGeminiAPI(apiKey: string, systemInstruction: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Gemini 1.5 Flash 모델 사용
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const data = JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(url, options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(responseBody);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve(text);
            } else {
              reject(new Error('Invalid response structure from Gemini API: ' + responseBody));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`API returned status ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
