<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

defineProps<{
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

// State
const availableBooks = ref<string[]>([]);
const loadingBooks = ref<boolean>(false);
const selectedBook = ref<string>('');
const customPath = ref<string>('');

const exportTarget = ref<'joplin' | 'obsidian'>('joplin');

// Joplin connection settings
const joplinUrl = ref<string>('http://host.docker.internal:41184');
const joplinToken = ref<string>('');

// Obsidian connection settings
const obsidianUrl = ref<string>('http://host.docker.internal:27123');
const obsidianKey = ref<string>('');

// Export Options
const addFrontmatter = ref<boolean>(true);
const createIndex = ref<boolean>(true);

// Action Status
const exporting = ref<boolean>(false);
const exportLog = ref<{ type: 'info' | 'success' | 'error'; message: string; time: string }[]>([]);

onMounted(() => {
  fetchAvailableBooks();
  
  // Load configuration from localStorage
  const savedJoplinUrl = localStorage.getItem('exporter_joplin_url');
  if (savedJoplinUrl) joplinUrl.value = savedJoplinUrl;
  
  const savedJoplinToken = localStorage.getItem('exporter_joplin_token');
  if (savedJoplinToken) joplinToken.value = savedJoplinToken;
  
  const savedObsidianUrl = localStorage.getItem('exporter_obsidian_url');
  if (savedObsidianUrl) obsidianUrl.value = savedObsidianUrl;
  
  const savedObsidianKey = localStorage.getItem('exporter_obsidian_key');
  if (savedObsidianKey) obsidianKey.value = savedObsidianKey;
});

// Save settings changes to localStorage automatically
watch(joplinUrl, (newVal) => localStorage.setItem('exporter_joplin_url', newVal));
watch(joplinToken, (newVal) => localStorage.setItem('exporter_joplin_token', newVal));
watch(obsidianUrl, (newVal) => localStorage.setItem('exporter_obsidian_url', newVal));
watch(obsidianKey, (newVal) => localStorage.setItem('exporter_obsidian_key', newVal));

// Methods
async function fetchAvailableBooks() {
  loadingBooks.value = true;
  try {
    const response = await fetch('/api/exporter/books');
    if (!response.ok) throw new Error('책 목록을 조회하지 못했습니다.');
    availableBooks.value = await response.json();
    if (availableBooks.value.length > 0) {
      selectedBook.value = availableBooks.value[0];
    }
  } catch (err: any) {
    addLog('error', `책 목록 조회 에러: ${err.message}`);
  } finally {
    loadingBooks.value = false;
  }
}

function addLog(type: 'info' | 'success' | 'error', message: string) {
  const time = new Date().toLocaleTimeString('ko-KR');
  exportLog.value.unshift({ type, message, time });
}

function clearLog() {
  exportLog.value = [];
}

async function startExport() {
  const bookPath = customPath.value.trim() || selectedBook.value;
  if (!bookPath) {
    alert('내보낼 서적을 선택하거나 경로를 직접 입력해주세요.');
    return;
  }

  exporting.value = true;
  clearLog();
  addLog('info', `📖 "${bookPath}" 내보내기 작업 요청 시작...`);

  try {
    const payload = {
      target: exportTarget.value,
      pathName: bookPath,
      token: exportTarget.value === 'joplin' ? joplinToken.value.trim() : undefined,
      key: exportTarget.value === 'obsidian' ? obsidianKey.value.trim() : undefined,
      addFrontmatter: addFrontmatter.value,
      createIndex: createIndex.value,
    };

    // Override Env parameters dynamic post to backend
    // Since backend requests Joplin / Obsidian REST API, we must pass API keys.
    const response = await fetch('/api/exporter/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      addLog('success', `✅ 내보내기 성공: ${result.message}`);
    } else {
      addLog('error', `❌ 내보내기 실패: ${result.error || '알 수 없는 에러가 발생했습니다.'}`);
    }
  } catch (err: any) {
    addLog('error', `❌ 네트워크 통신 오류: ${err.message}`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="dashboard-container exporter-view-layout" style="display: flex; flex-direction: column; flex: 1; height: 100%; overflow: hidden;">
    <header class="dashboard-header">
      <div class="dashboard-title-area">
        <button v-if="sidebarCollapsed" @click="emit('toggle-sidebar')" class="sidebar-expand" title="Expand Sidebar" style="margin-right: 8px;">☰</button>
        <span class="brand-icon" style="font-size:24px;">📥</span>
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#fff;margin:0;">서적 Exporter</h2>
          <p style="font-size:12px;color:var(--text-secondary);margin:0;">로컬 수집 도서 및 마크다운 문서를 외부 노트 도구(Joplin, Obsidian)로 직접 밀어넣습니다.</p>
        </div>
      </div>
      <div class="dashboard-actions">
        <button @click="fetchAvailableBooks" class="btn-secondary" :disabled="loadingBooks">
          <span>🔄</span> 책 목록 새로고침
        </button>
      </div>
    </header>

    <div class="dashboard-content" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px; min-height: 675px;">
      <!-- Left Panel: Settings Form -->
      <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px; height: 100%; box-sizing: border-box; min-height: 615px;">
        <h3 style="margin: 0; color: #fff; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 16px;">⚙️ 내보내기 설정</h3>
        
        <!-- Scrollable settings options -->
        <div class="settings-scroll-area" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-right: 8px; margin-bottom: 16px;">
          <!-- Book Selection -->
          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">1. 대상 서적 선택</label>
            <div v-if="loadingBooks" class="loading-text" style="font-size:12px; color:var(--text-muted);">도서 폴더 스캔 중...</div>
            <select v-else v-model="selectedBook" class="form-select" style="width: 100%;">
              <option v-for="book in availableBooks" :key="book" :value="book">{{ book }}</option>
            </select>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">또는 아래에 전체 경로를 직접 지정할 수 있습니다:</div>
            <input type="text" v-model="customPath" placeholder="/app/data/ebook/output/서적폴더명" class="form-input-text" style="width: 100%;">
          </div>

          <!-- Target Platform Tabs -->
          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">2. 대상 플랫폼 지정</label>
            <div class="tabs-nav" style="background: #181c25; border-radius: 6px; padding: 4px; display: flex; gap: 4px;">
              <button 
                type="button" 
                class="tab-btn" 
                :class="{ active: exportTarget === 'joplin' }" 
                @click="exportTarget = 'joplin'"
                style="flex: 1; text-align: center; padding: 8px; font-size: 12px; border-radius: 4px; height: auto;"
              >
                Joplin 노트
              </button>
              <button 
                type="button" 
                class="tab-btn" 
                :class="{ active: exportTarget === 'obsidian' }" 
                @click="exportTarget = 'obsidian'"
                style="flex: 1; text-align: center; padding: 8px; font-size: 12px; border-radius: 4px; height: auto;"
              >
                Obsidian 보관소
              </button>
            </div>
          </div>

          <!-- Target Specific Connection Fields -->
          <div v-if="exportTarget === 'joplin'" class="target-settings-pane" style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; color: var(--text-secondary);">Joplin Webclipper API URL</label>
              <input type="text" v-model="joplinUrl" placeholder="http://host.docker.internal:41184" class="form-input-text" style="width: 100%; font-size: 12px;">
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; color: var(--text-secondary);">Joplin API 웹클리퍼 토큰</label>
              <input type="password" v-model="joplinToken" placeholder="클리퍼 인증 토큰 입력" class="form-input-text" style="width: 100%; font-size: 12px;">
            </div>
          </div>

          <div v-else class="target-settings-pane" style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; color: var(--text-secondary);">Obsidian REST API URL</label>
              <input type="text" v-model="obsidianUrl" placeholder="http://host.docker.internal:27123" class="form-input-text" style="width: 100%; font-size: 12px;">
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; color: var(--text-secondary);">Obsidian Local REST API 키</label>
              <input type="password" v-model="obsidianKey" placeholder="Local REST API 키 입력" class="form-input-text" style="width: 100%; font-size: 12px;">
            </div>
          </div>

          <!-- Export Options checkboxes -->
          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">3. 변환 옵션</label>
            <div style="display: flex; gap: 16px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #fff;">
                <input type="checkbox" v-model="addFrontmatter"> Frontmatter 자동 추가
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #fff;">
                <input type="checkbox" v-model="createIndex"> INDEX 파일 자동 생성
              </label>
            </div>
          </div>
        </div>

        <!-- Run Trigger -->
        <button 
          @click="startExport" 
          class="btn-primary" 
          :disabled="exporting"
          style="padding: 12px; width: 100%; font-weight: bold; font-size: 14px; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <span v-if="exporting" class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></span>
          <span>{{ exporting ? '내보내는 중...' : '📥 노트로 내보내기 실행' }}</span>
        </button>
      </div>

      <!-- Right Panel: Run Console logs -->
      <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #fff;">📋 진행 콘솔 로그</h3>
          <button @click="clearLog" class="country-badge" style="padding: 4px 10px; font-size: 11px;">로그 지우기</button>
        </div>
        
        <div class="log-console" style="flex: 1; background: #0b0e14; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; overflow-y: auto; border: 1px solid #1a2333; max-height: 480px; min-height: 320px;">
          <div v-if="exportLog.length === 0" style="color: var(--text-muted); text-align: center; padding-top: 80px;">
            설정을 확인하고 내보내기를 누르면 이곳에 실행 진행 상세가 표시됩니다.
          </div>
          <div 
            v-else
            v-for="(log, idx) in exportLog" 
            :key="idx" 
            style="margin-bottom: 6px; line-height: 1.5; display: flex; gap: 8px;"
            :style="{ 
              color: log.type === 'success' ? '#4ade80' : log.type === 'error' ? '#f87171' : '#60a5fa'
            }"
          >
            <span style="color: var(--text-muted); flex-shrink: 0;">[{{ log.time }}]</span>
            <span style="white-space: pre-wrap; word-break: break-all;">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
