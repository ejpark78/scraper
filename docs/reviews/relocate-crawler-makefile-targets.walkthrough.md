# Walkthrough: Crawler Makefile 타겟 이관 및 통합 포워딩 구성 결과 보고서

## 작업 결과 요약
- 루트 `Makefile`에 존재하던 모든 개별 사이트별 타겟과 `list`, `refresh-*` 같은 복합 타겟, 그리고 테스트/추출/디버그 세부 타겟들을 `apps/crawler/Makefile`로 온전히 이관하였습니다.
- 추가적으로, `rebuild`, `restart`, `clear-queue`, `grep-errors`, `dump-queue`, `fix-urls`, `get-queue-status` 및 `gm-%` 등의 크롤러 유틸리티/인프라성 타겟들도 포워딩 규칙으로 하나로 묶어 깔끔하게 병합 정돈하였습니다.
- 루트 `Makefile`에는 포워딩 게이트웨이 포트 룰만 남겨두어, 사용자가 루트 디렉토리에서 기존 명령어(`make gpt-list`, `make test-recursive SITE=yozm`, `make clear-queue`)를 입력하더라도 문제 없이 `apps/crawler/Makefile`로 패스되어 실행되도록 보장하였습니다.

## 변경 파일
- `[MODIFY]` [Makefile](file:///home/ejpark/workspace/scraper/Makefile)
- `[MODIFY]` [apps/crawler/Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile)

## 검증 결과
- 루트 디렉토리에서 이관된 타겟들이 여전히 정상 동작하며, 포워딩 계층을 거쳐 정상 실행됨을 확인하는 테스트를 거칩니다.
