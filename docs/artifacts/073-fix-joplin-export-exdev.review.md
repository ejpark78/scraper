# 🔍 코드 검토서 (073-fix-joplin-export-exdev.review.md)

> [!IMPORTANT]
> **Bugfix**: 서로 다른 마운트 볼륨 간의 파일 이동(rename) 제한으로 인한 EXDEV 에러를 해결하기 위한 버그 수정 작업입니다.

---

## 🛠️ 변경 전후 코드 대비

### 1. `apps/viewer/src/api/routes/exporter.ts`
임시 작업 디렉토리 `tempExportDir`의 베이스 디렉토리를 오버레이 파일 시스템 공간인 `/tmp`에서, 데이터 호스트 마운트 볼륨 디바이스 공간인 `/app/data/joplin/.tmp_export`로 변경하였습니다.

#### 변경 전 (Before)
```typescript
      const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
      const targetDir = path.join('/app/data/joplin', cleanFolderName);
      const tempExportDir = path.join('/tmp/joplin_export', cleanFolderName);
```

#### 변경 후 (After)
```typescript
      const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
      const targetDir = path.join('/app/data/joplin', cleanFolderName);
      const tempExportDir = path.join('/app/data/joplin/.tmp_export', cleanFolderName);
```

---

## 🛡️ 품질 검증 사항
- **EXDEV 제약 조건 해제**: 두 경로가 모두 동일 마운트 지점인 `/app/data` 내부이므로, 동일 파일 시스템 디바이스 내에서의 원자적 rename(`fs.renameSync`) 연산이 원활하게 성공하게 됩니다.
- **성능 이점**: 파일 시스템 경계를 가로지르지 않으므로 파일 복사 작업 없이 인덱스 메타데이터만 갱신하는 rename 연산으로 바뀌어, 폴더 이동 속도가 비약적으로 향상됩니다.
