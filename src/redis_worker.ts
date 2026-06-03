import * as os from 'os';

// JSON_LOG=true 환경 시 모든 console.log/error 출력을 가로채서 구조화된 JSON 포맷으로 강제 변환 (crawler, pipeline 등의 모든 로그 통합 수집 목적)
if (process.env.JSON_LOG === 'true') {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const hostname = os.hostname();

  const formatLog = (level: string, args: any[]) => {
    const timestamp = new Date().toISOString();

    // 만약 인자가 하나이고 이미 Logger 등에서 출력한 JSON 로그 객체라면 이중 래핑 방지
    if (args.length === 1 && typeof args[0] === 'string') {
      const trimmed = args[0].trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && parsed.timestamp && parsed.level) {
            return trimmed;
          }
        } catch (e) {
          // JSON 파싱 실패 시 일반 텍스트 포맷 진행
        }
      }
    }

    const message = args
      .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ')
      .replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d]*)*)?/g, ''); // ANSI 색상 코드 제거

    return JSON.stringify({
      timestamp,
      level,
      hostname,
      message
    });
  };

  console.log = (...args) => originalLog(formatLog('INFO', args));
  console.info = (...args) => originalInfo(formatLog('INFO', args));
  console.warn = (...args) => originalWarn(formatLog('WARN', args));
  console.error = (...args) => originalError(formatLog('ERROR', args));
}

import Redis from 'ioredis';
import { JobsScrapingPipeline } from './jobs/jobs_pipeline';
import { UrlUtils, Logger } from './utils';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'jobs_queue';
const CACHE_SET_KEY = 'completed_jobs';

async function main() {
  Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  
  redis.on('connect', () => Logger.info('Connected to Redis.'));
  redis.on('error', (err) => Logger.error('Redis connection error', err));

  // Initialize pipeline
  const pipeline = new JobsScrapingPipeline();

  Logger.info(`Worker started, listening to queue: ${QUEUE_KEY}`);

  while (true) {
    try {
      // 1. Fetch task from queue with a blocking POP (wait up to 5 seconds)
      const res = await redis.blpop(QUEUE_KEY, 5);
      if (!res) {
        continue;
      }

      const url = res[1].trim();
      if (!url) continue;

      const jobId = UrlUtils.extractJobId(url);
      if (!jobId) {
        Logger.warn(`Failed to parse jobId from URL`, { url });
        continue;
      }

      // 2. Check if already completed
      const isCompleted = await redis.sismember(CACHE_SET_KEY, jobId);
      if (isCompleted) {
        Logger.info(`Job already exists in completed list. Skipping.`, { jobId });
        continue;
      }

      Logger.info(`Processing Job ID: ${jobId}`, { jobId, url });

      // 3. Process task
      const resultId = await pipeline.processSingleUrl(url);

      if (resultId) {
        // 4. Mark as completed in Redis cache
        await redis.sadd(CACHE_SET_KEY, resultId);
        Logger.info(`Completed Job ID: ${jobId}`, { jobId });
      }
    } catch (err: any) {
      Logger.error(`Error processing task`, err);

      // Handle critical auth wall / login session expired errors (shutdown so we don't spam rate limits)
      if (err.message && (err.message.includes('세션 만료') || err.message.includes('Auth Wall') || err.message.includes('로그인 요청'))) {
        Logger.error(`Critical login failure. Shutting down worker.`, err);
        await redis.quit();
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  Logger.error('Fatal worker crash', err);
  process.exit(1);
});
