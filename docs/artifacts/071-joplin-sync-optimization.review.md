# 🔍 코드 검토서 (071-joplin-sync-optimization.review.md)

---

## 🛠️ 변경 전후 코드 대비

### 1. Joplin CLI 실행 환경 변수 변경 및 스트리밍 유틸 추가 (`apps/viewer/src/api/routes/exporter.ts`)
기존 임시 디렉토리 `/tmp`를 사용하던 것에서 볼륨 마운트 디렉토리 `/app/data/.joplin_profile`로 교체하여 증분 동기화(Incremental Sync) 속도를 극대화했으며, `spawn` 콘솔 데이터를 스트리밍하기 위해 `runCommandStream` 헬퍼 함수를 추가했습니다.

#### 변경 전 (Before)
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Joplin CLI 실행 시 홈 디렉토리 수동 지정 및 SSL 검증 완화 설정 적용
const joplinEnv = { 
  ...process.env, 
  HOME: '/tmp',
  NODE_TLS_REJECT_UNAUTHORIZED: '0'
};
```

#### 변경 후 (After)
```typescript
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Joplin CLI 실행용 영구 프로필 폴더 설정 및 SSL 검증 완화 설정 적용
const JOPLIN_PROFILE_DIR = '/app/data/.joplin_profile';
if (!fs.existsSync(JOPLIN_PROFILE_DIR)) {
  fs.mkdirSync(JOPLIN_PROFILE_DIR, { recursive: true });
}

const joplinEnv = { 
  ...process.env, 
  HOME: JOPLIN_PROFILE_DIR,
  NODE_TLS_REJECT_UNAUTHORIZED: '0'
};

function runCommandStream(
  command: string, 
  args: string[], 
  env: any, 
  onData: (data: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env });
    
    proc.stdout.on('data', (data) => {
      onData(data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      onData(data.toString());
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}
```

---

### 2. `/api/exporter/joplin/cli-sync` 스트리밍 API로 개편 (`apps/viewer/src/api/routes/exporter.ts`)
기존에 일괄 실행 후 JSON 전체 로그를 반환하던 것에서, `Transfer-Encoding: chunked` 스트리밍 방식으로 개편하여 `joplin sync` 및 `joplin export` 로그를 실시간으로 스트림 라이팅합니다.

#### 변경 전 (Before)
```typescript
router.post('/joplin/cli-sync', async (req: Request, res: Response) => {
  try {
    // ... joplin sync 구동 및 ls / 조회 후 전체 루프 실행
    // ...
    res.json({ 
      success: true, 
      message: `동기화 완료 및 ${exportedBooks.length}개 노트북이 마크다운으로 자동 저장되었습니다.`, 
      log: finalLog 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Joplin Server 동기화 도중 에러가 발생했습니다.' });
  }
});
```

#### 변경 후 (After)
```typescript
router.post('/joplin/cli-sync', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const writeLog = (type: 'info' | 'success' | 'error', message: string) => {
    res.write(JSON.stringify({ type, message }) + '\n');
  };

  try {
    // ... config 설정 ...
    // E2EE 복호화 설정 ...
    
    // sync를 spawn을 이용해 실시간 캡처 및 출력 스트리밍
    await runCommandStream('joplin', ['sync'], joplinEnv, (data) => {
      // 실시간 writeLog 전송
    });
    
    // 감지된 각 노트북별 루프 내보내기 시에도 실시간 spawn 캡처 스트리밍
    for (let i = 0; i < notebooksToExport.length; i++) {
       // runCommandStream('joplin', ['export', ...]) 수행 및 실시간 writeLog 전송
    }
    
    writeLog('success', `🎉 동기화 및 ${exportedBooks.length}개 노트북 마크다운 내보내기가 최종 완료되었습니다!`);
    res.end();
  } catch (error: any) {
    writeLog('error', `동기화 중 장애가 발생했습니다: ${error.message}`);
    res.end();
  }
});
```

---

### 3. 프론트엔드 ReadableStream 리더 연동 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)
전체 다운로드를 대기하던 AJAX 요청에서, `res.body.getReader()`를 사용해 백엔드가 스트리밍 전송해 주는 JSON 로그 라인을 실시간으로 파싱 및 누적 출력하도록 개편했습니다.

#### 변경 전 (Before)
```typescript
    const res = await fetch('/api/exporter/joplin/cli-sync', { ... });
    const result = await res.json();
    addLog('import', 'success', '✅ Joplin CLI 동기화가 성공적으로 완료되었습니다.');
    if (result.log) {
       result.log.split('\n').forEach(...);
    }
```

#### 변경 후 (After)
```typescript
    const res = await fetch('/api/exporter/joplin/cli-sync', { ... });
    if (!res.ok) throw new Error(...);
    if (!res.body) throw new Error(...);

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const logObj = JSON.parse(trimmed);
          addLog('import', logObj.type, logObj.message);
        } catch (jsonErr) {
          addLog('import', 'info', trimmed);
        }
      }
    }
```

---

## 🛡️ 안정성 및 품질 검증 사항
- **예외 복원력**: 스트리밍 루프 및 동기화 도중 예외가 터져도 `catch` 절에서 `res.end()`를 실행하므로 HTTP 응답 누수 현상이 생기지 않습니다.
- **메모리 버퍼링 해소**: `Transfer-Encoding: chunked`와 `res.write()`를 사용하여 로그를 디스크나 노드 메모리에 누적하지 않고 생기는 대로 브라우저로 쏘아냅니다.
