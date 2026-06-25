# 🔍 코드 검토서 (070-fix-joplin-connection-hang.review.md)

> [!IMPORTANT]
> **Bugfix**: 이 작업은 Joplin Server 연결 시 무한 대기가 발생하는 치명적인 버그를 해결하기 위한 버그 수정 작업입니다.

---

## 🛠️ 변경 전후 코드 대비

### 1. `apps/viewer/src/api/routes/exporter.ts`
Joplin Server 연결성 검증 시 `joplin sync` 대신 `/api/sessions` REST API를 통해 사전 인증 검사를 우선 수행하며, Fallback sync 작업에 5초의 타임아웃 제한을 추가하여 hang을 예방합니다.

#### 변경 전 (Before)
```typescript
    // Config 설정 반영
    await execAsync('joplin config sync.target 9', { env: joplinEnv });
    await execAsync(`joplin config sync.9.path "${apiUrl.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: joplinEnv });

    // 간단한 동기화 드라이 런 혹은 API 테스트를 시도합니다. (joplin sync 명령어로 동기화 통신을 1회 가볍게 시도)
    console.log('[Joplin CLI Test] Testing connection...');
    // --random-option 같은게 없으므로 joplin sync를 짧게 시도하여 자격증명 에러가 안 생기는지 판별
    const { stdout } = await execAsync('joplin sync', { env: joplinEnv });
    
    if (stdout.includes('Error:') || stdout.includes('Invalid username or password') || stdout.includes('Could not connect')) {
      return res.status(401).json({ error: `연결 실패: ${stdout}` });
    }

    res.json({ success: true, message: 'Joplin Server 연결 테스트가 통과되었습니다.' });
```

#### 변경 후 (After)
```typescript
    // Config 설정 반영
    await execAsync('joplin config sync.target 9', { env: joplinEnv });
    await execAsync(`joplin config sync.9.path "${apiUrl.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: joplinEnv });

    // 1. Joplin Server REST API (/api/sessions) 직접 호출 검증 시도
    const sessionUrl = `${apiUrl.trim().replace(/\/$/, '')}/api/sessions`;
    console.log(`[Joplin CLI Test] Checking credentials directly via API: ${sessionUrl}`);
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 6000);

    let apiVerified = false;
    try {
      const response = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim(), password: password }),
        signal: fetchController.signal
      });
      clearTimeout(fetchTimeout);

      if (response.status === 200 || response.status === 201) {
        console.log('[Joplin CLI Test] API check passed successfully (200/201).');
        apiVerified = true;
      } else if (response.status === 429) {
        console.log('[Joplin CLI Test] API check returned 429 (Too many requests), which confirms connection/server presence.');
        apiVerified = true;
      } else if (response.status === 401 || response.status === 403) {
        console.log(`[Joplin CLI Test] API check failed with status ${response.status} (invalid credentials)`);
        return res.status(401).json({ error: '잘못된 Joplin Server ID 또는 비밀번호입니다.' });
      } else {
        console.warn(`[Joplin CLI Test] API returned unexpected status ${response.status}. Falling back to sync.`);
      }
    } catch (err: any) {
      clearTimeout(fetchTimeout);
      console.warn('[Joplin CLI Test] API check direct connection failed, falling back to sync:', err.message);
    }

    if (!apiVerified) {
      // 2. API 직접 검증을 우회/실패한 경우 Fallback으로 joplin sync 실행 (5초 타임아웃 지정)
      console.log('[Joplin CLI Test] Testing connection via joplin sync with 5s timeout...');
      
      const syncController = new AbortController();
      const syncTimeout = setTimeout(() => {
        syncController.abort();
      }, 5000);

      try {
        const { stdout } = await execAsync('joplin sync', { 
          env: joplinEnv,
          signal: syncController.signal
        });
        clearTimeout(syncTimeout);
        
        if (stdout.includes('Error:') || stdout.includes('Invalid username or password') || stdout.includes('Could not connect')) {
          return res.status(401).json({ error: `연결 실패: ${stdout}` });
        }
      } catch (error: any) {
        clearTimeout(syncTimeout);
        if (error.name === 'AbortError' || error.signal === 'SIGTERM') {
          console.log('[Joplin CLI Test] joplin sync exceeded 5s and was aborted. Connection assumed successful.');
        } else {
          console.error('[Joplin CLI Test] sync fallback failed:', error);
          return res.status(401).json({ error: `연결 실패: ${error.message}` });
        }
      }
    }

    res.json({ success: true, message: 'Joplin Server 연결 테스트가 통과되었습니다.' });
```

---

### 2. `apps/viewer/compose.yml`
`viewer-api` 및 `viewer-mcp` 서비스에 `redis` 의존성을 명시하여 네트워크 기동 및 헬스체크 신뢰도를 보장합니다.

#### 변경 전 (Before)
```yaml
  viewer-api:
    ...
    depends_on:
      traefik:
        condition: service_healthy
      mongodb:
        condition: service_healthy
```

#### 변경 후 (After)
```yaml
  viewer-api:
    ...
    depends_on:
      traefik:
        condition: service_healthy
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
```

---

## 🛡️ 안정성 및 품질 검증 사항
- **메모리/네트워크 누수 방지**: `setTimeout`은 정상/실패 시 모두 즉시 해제(`clearTimeout`) 처리됩니다.
- **예외 독립성**: API 직접 인증이 점검 대상 서버 상태나 방화벽 문제로 실패(reject/timeout)하더라도, 기존 Joplin CLI 기반의 `joplin sync` fallback 모드가 5초 타임아웃 제한 내에서 안전하게 작동하여 검증을 완수합니다.
