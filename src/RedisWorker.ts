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
import { JobsScrapingPipeline } from './sites/linkedin/jobs/Pipeline';
import { GeekNewsContents } from './sites/geeknews/Contents';
import { PyTorchKRContents } from './sites/pytorch_kr/Contents';
import { GptersContents } from './sites/gpters/Contents';
import { UrlUtils, Logger } from './utils';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUES = ['jobs_queue', 'geeknews_queue', 'pytorch_kr_queue', 'gpters_queue'];

function getCacheKeyForQueue(queue: string): string {
  return queue === 'jobs_queue' ? 'completed_jobs' : 'completed_news';
}

function extractIdFromUrl(queue: string, url: string): string {
  if (queue === 'jobs_queue') {
    return UrlUtils.extractJobId(url) || '';
  } else if (queue === 'geeknews_queue') {
    if (url.includes('id=')) return url.split('id=').pop()!.split('&')[0];
  } else if (queue === 'pytorch_kr_queue') {
    const match = url.match(/\/(\d+)(?:\?|$)/);
    if (match) return match[1];
  } else if (queue === 'gpters_queue') {
    const parts = url.split('-');
    return parts[parts.length - 1] || '';
  }
  return '';
}

async function main() {
  Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  
  redis.on('connect', () => Logger.info('Connected to Redis.'));
  redis.on('error', (err) => Logger.error('Redis connection error', err));

  // Initialize pipelines
  const pipelines: Record<string, any> = {
    'jobs_queue': new JobsScrapingPipeline(),
    'geeknews_queue': new GeekNewsContents(),
    'pytorch_kr_queue': new PyTorchKRContents(),
    'gpters_queue': new GptersContents()
  };

  Logger.info(`Worker started, listening to queues: ${QUEUES.join(', ')}`);

  while (true) {
    try {
      // 1. Fetch task from any queue with a blocking POP (wait up to 5 seconds)
      const res = await redis.blpop(...QUEUES, 5);
      if (!res) {
        continue;
      }

      const poppedQueue = res[0];
      const url = res[1].trim();
      if (!url) continue;

      const cacheSetKey = getCacheKeyForQueue(poppedQueue);
      const id = extractIdFromUrl(poppedQueue, url);
      if (!id) {
        Logger.warn(`Failed to parse ID from URL in queue ${poppedQueue}`, { url });
        continue;
      }

      // 2. Check if already completed
      const isCompleted = await redis.sismember(cacheSetKey, id);
      if (isCompleted) {
        Logger.info(`Item already exists in completed list for ${poppedQueue}. Skipping.`, { id });
        continue;
      }

      Logger.info(`[Queue: ${poppedQueue}] Processing ID: ${id}`, { id, url });

      // 3. Process task via correct pipeline
      const pipeline = pipelines[poppedQueue];
      if (!pipeline) {
        Logger.error(`No pipeline registered for queue ${poppedQueue}`);
        continue;
      }

      const resultId = await pipeline.processSingleUrl(url, redis);

      if (resultId) {
        // 4. Mark as completed in Redis cache
        await redis.sadd(cacheSetKey, resultId);
        Logger.info(`Completed ID: ${id} on queue ${poppedQueue}`, { id });
      }
    } catch (err: any) {
      Logger.error(`Error processing task`, err);

      // Handle critical auth wall / login session expired errors for LinkedIn (shutdown so we don't spam rate limits)
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

