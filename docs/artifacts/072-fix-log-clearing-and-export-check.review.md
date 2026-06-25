# 🔍 코드 검토서 (072-fix-log-clearing-and-export-check.review.md)

> [!IMPORTANT]
> **Bugfix**: 동기화/내보내기 완료 후 로그창이 즉각 지워져 실제 에러를 판별할 수 없었던 UI 버그 수정 작업입니다.

---

## 🛠️ 변경 전후 코드 대비

### 1. `apps/viewer/src/frontend/src/views/ExternalView.vue`
노트북 로드 함수에 로그 클리어 제어용 파라미터 `shouldClear`를 도입하고, 동기화 프로세스 완료 시 `loadJoplinFolders(false)`를 호출해 에러 기록이 보존되도록 구현하였습니다.

#### 변경 전 (Before)
```typescript
    // 동기화 완료 후 노트북 목록 자동 로드
    await loadJoplinFolders();
  } catch (err: any) {
    addLog('import', 'error', `❌ CLI 동기화 실패: ${err.message}`);
  } finally {
    isCliSyncing.value = false;
  }
}

async function loadJoplinFolders() {
  loadingFolders.value = true;
  clearLog('import');
  addLog('import', 'info', `🔗 Joplin 노트북 목록을 가져오는 중... (${connectionType.value === 'server' ? 'CLI Local DB' : joplinUrl.value})`);
```

#### 변경 후 (After)
```typescript
    // 동기화 완료 후 노트북 목록 자동 로드 (로그 유지)
    await loadJoplinFolders(false);
  } catch (err: any) {
    addLog('import', 'error', `❌ CLI 동기화 실패: ${err.message}`);
  } finally {
    isCliSyncing.value = false;
  }
}

async function loadJoplinFolders(shouldClear = true) {
  loadingFolders.value = true;
  if (shouldClear) {
    clearLog('import');
  }
  addLog('import', 'info', `🔗 Joplin 노트북 목록을 가져오는 중... (${connectionType.value === 'server' ? 'CLI Local DB' : joplinUrl.value})`);
```

---

## 🛡️ 품질 검증 사항
- **이전 기능 호환성**: `shouldClear` 파라미터가 생략된 경우(예: 컴포넌트 마운트 시 최초 실행) 기본값 `true`가 적용되어 정상적으로 로그 창을 클리어합니다.
- **예외 발생 시 로그 유지성**: 동기화 구동 중 일부 노트북 백업 실패가 발생한 경우, 오류 상세 로그가 화면에 지속 유지되므로 사용자가 원인을 정확히 인지할 수 있습니다.
