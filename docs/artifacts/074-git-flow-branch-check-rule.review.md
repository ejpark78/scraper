# 🔍 코드 검토서 (074-git-flow-branch-check-rule.review.md)

---

## 🛠️ 변경 전후 코드 대비

### 1. `AGENTS.md`
에이전트 제약 사항 16번에 세션 시작 시 브랜치 자가 검사 및 main 직접 제어 우회 의무를 상세 명시하였습니다.

#### 변경 전 (Before)
```markdown
16. **Git Flow 브랜치 전략 및 에이전트 행동 지침**: `main` 직접 수정 절대 금지, 브랜치 전환 전 `commit-changes.sh` 실행 완료 필수, 충돌 시 강제 푸시 금지 등 핵심 동작 룰을 준수합니다. 구체적인 브랜치 명명법과 커밋/머지 절차는 [Git Flow Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/git_flow.md)를 로드하여 준수해야 합니다.
```

#### 변경 후 (After)
```markdown
16. **Git Flow 브랜치 전략 및 에이전트 행동 지침**: `main` 직접 수정 절대 금지, 브랜치 전환 전 `commit-changes.sh` 실행 완료 필수, 충돌 시 강제 푸시 금지 등 핵심 동작 룰을 준수합니다. 특히 작업 세션 시작 시 반드시 현재 git 브랜치를 식별하고, `main` 브랜치일 경우 코드 수정을 시작하기 전에 브랜치 전환(`git checkout develop` 또는 `git checkout -b feature/*`)을 제안하고 사용자에게 경고해야 합니다. 구체적인 브랜치 명명법과 커밋/머지 절차는 [Git Flow Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/git_flow.md)를 로드하여 준수해야 합니다.
```

---

### 2. `.agents/rules/git_flow.md`
가이드라인의 `3. 작업 및 병합 절차` 바로 시작부에 `0. 세션 시작 시 브랜치 자가 진단` 단계를 추가하여 행동 강령을 명문화했습니다.

#### 변경 전 (Before)
```markdown
## 3. 작업 및 병합(Merge) 절차

1. **작업 시작 전**:
   - 로컬 환경의 `develop` 및 `main` 브랜치를 원격지 최신 상태로 갱신해야 합니다 (`git pull`).
```

#### 변경 후 (After)
```markdown
## 3. 작업 및 병합(Merge) 절차

0. **세션 시작 시 브랜치 자가 진단**:
   - 에이전트는 작업을 시작할 때 항상 현재 브랜치가 `main` 브랜치인지 파악합니다.
   - `main` 브랜치일 경우 코드 수정을 절대 진행하지 않고 사용자에게 경고한 후 `git checkout develop` 또는 신규 피처 브랜치 전환 승인을 즉시 유도합니다.
1. **작업 시작 전**:
   - 로컬 환경의 `develop` 및 `main` 브랜치를 원격지 최신 상태로 갱신해야 합니다 (`git pull`).
```

---

## 🛡️ 품질 검증 사항
- **글로벌 인스트럭션 강제화**: 이제 새로운 AI 에이전트 세션이나 트랙이 생성되어 기동하더라도 프롬프트 시작 단계에서 이 두 규칙이 로드되어 main 브랜치 기여를 자동 차단하는 능력을 가집니다.
- **안정적인 변경**: 소스 로직 변경이 아닌 규약 문서 수정이므로 테스트 중단이나 컴파일 빌드 없이 가이드라인 갱신만으로 즉각 보장됩니다.
