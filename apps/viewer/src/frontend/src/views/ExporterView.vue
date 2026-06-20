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

const exportTarget = ref<'joplin' | 'obsidian'>('joplin');

// Joplin connection settings
const joplinUrl = ref<string>('http://127.0.0.1:41184');
const joplinToken = ref<string>('');

// Obsidian connection settings
const obsidianUrl = ref<string>('http://127.0.0.1:27123');
const obsidianKey = ref<string>('');

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

// Helper to sanitize filename (same logic as backend)
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

// Helper to download image from backend and upload it to Joplin as a resource
async function uploadImageToJoplin(apiUrl: string, token: string, bookPath: string, imagePath: string): Promise<string> {
  const imgUrl = `/api/exporter/image?pathName=${encodeURIComponent(bookPath)}&imagePath=${encodeURIComponent(imagePath)}`;
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) {
    throw new Error(`백엔드 이미지 로드 실패 (${imgRes.status})`);
  }
  const blob = await imgRes.blob();

  const formData = new FormData();
  const filename = imagePath.split('/').pop() || 'image.png';
  formData.append('data', blob, filename);
  formData.append('props', JSON.stringify({ title: filename }));

  const resUpload = await fetch(`${apiUrl}/resources?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: formData,
  });

  if (!resUpload.ok) {
    const errText = await resUpload.text();
    throw new Error(`Joplin 리소스 생성 실패 (${resUpload.status}): ${errText}`);
  }

  const resData = await resUpload.json();
  return resData.id;
}

async function startExport() {
  const bookPath = selectedBook.value;
  if (!bookPath) {
    alert('내보낼 서적을 선택해주세요.');
    return;
  }

  exporting.value = true;
  clearLog();
  addLog('info', `📖 "${bookPath}" 도서 데이터 로드 중...`);

  let book;
  try {
    const response = await fetch(`/api/exporter/book-content?pathName=${encodeURIComponent(bookPath)}`);
    if (!response.ok) {
      const errorText = await response.json();
      throw new Error(errorText.error || '도서 데이터 로드 실패');
    }
    book = await response.json();
    addLog('info', `📚 "${book.title}" 도서 로드 완료. (총 ${book.chapters.length}개 챕터)`);
  } catch (err: any) {
    addLog('error', `❌ 도서 로드 에러: ${err.message}`);
    exporting.value = false;
    return;
  }

  try {
    if (exportTarget.value === 'joplin') {
      const token = joplinToken.value.trim();
      const apiUrl = joplinUrl.value.trim();
      if (!token) throw new Error('Joplin API 토큰을 입력해주세요.');

      addLog('info', `🔗 Joplin 연결 확인 및 폴더 생성 시도...`);
      let folderId = '';
      try {
        const folderRes = await fetch(`${apiUrl}/folders?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: sanitizeFilename(book.title) }),
        });
        if (!folderRes.ok) {
          const errText = await folderRes.text();
          throw new Error(`폴더 생성 실패 (${folderRes.status}): ${errText}`);
        }
        const folderData = await folderRes.json();
        folderId = folderData.id;
        addLog('success', `📁 Joplin에 "${book.title}" 폴더 생성 완료 (ID: ${folderId})`);
      } catch (err: any) {
        throw new Error(`Joplin에 연결할 수 없습니다: ${err.message}\nJoplin 앱이 실행 중이고 웹 클리퍼가 활성화되어 있으며, API URL(${apiUrl})에 접근 가능한지 확인해주세요.`);
      }

      for (let i = book.chapters.length - 1; i >= 0; i--) {
        const chapter = book.chapters[i];
        const progress = `[${i + 1}/${book.chapters.length}]`;
        addLog('info', `${progress} 📝 Joplin에 "${chapter.title}" 노트 생성 중...`);

        let content = chapter.content;

        // 마크다운 이미지 정규식: ![title](images/...)
        const imgRegex = /!\[(.*?)\]\((images\/.*?)\)/g;
        const matches = [...content.matchAll(imgRegex)];
        
        if (matches.length > 0) {
          addLog('info', `${progress} 🖼️ 이미지 처리 중... (총 ${matches.length}개 이미지 감지됨)`);
          const imageCache = new Map<string, string>();
          for (const match of matches) {
            const rawMatch = match[0];
            const title = match[1];
            const imgPath = match[2];
            
            try {
              let resourceId = imageCache.get(imgPath);
              if (!resourceId) {
                resourceId = await uploadImageToJoplin(apiUrl, token, bookPath, imgPath);
                imageCache.set(imgPath, resourceId);
              }
              content = content.replace(rawMatch, `![${title}](:/${resourceId})`);
            } catch (imgErr: any) {
              addLog('error', `⚠️ 이미지 업로드 실패 (${imgPath}): ${imgErr.message}`);
            }
          }
        }

        const noteRes = await fetch(`${apiUrl}/notes?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: sanitizeFilename(chapter.title),
            body: content,
            parent_id: folderId,
          }),
        });

        if (!noteRes.ok) {
          const errText = await noteRes.text();
          addLog('error', `❌ ${progress} "${chapter.title}" 생성 실패: ${errText}`);
        } else {
          addLog('success', `✅ ${progress} "${chapter.title}" 생성 완료`);
        }
      }
      addLog('success', `🎉 Joplin 내보내기 작업이 성공적으로 완료되었습니다!`);

    } else {
      // Obsidian 내보내기
      const apiKey = obsidianKey.value.trim();
      const apiUrl = obsidianUrl.value.trim();
      if (!apiKey) throw new Error('Obsidian REST API 키를 입력해주세요.');

      const folderName = sanitizeFilename(book.title);
      addLog('info', `🔗 Obsidian 연결 확인 및 파일 전송 시도...`);

      for (let i = book.chapters.length - 1; i >= 0; i--) {
        const chapter = book.chapters[i];
        const progress = `[${i + 1}/${book.chapters.length}]`;
        const filename = `${sanitizeFilename(chapter.title)}.md`;
        const filePath = `/${folderName}/${filename}`;

        addLog('info', `${progress} 📝 Obsidian에 "${filePath}" 생성 중...`);
        try {
          const fileRes = await fetch(`${apiUrl}/vault${filePath}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'text/markdown',
              'Authorization': `Bearer ${apiKey}`
            },
            body: chapter.content,
          });

          if (!fileRes.ok) {
            const errText = await fileRes.text();
            addLog('error', `❌ ${progress} "${chapter.title}" 생성 실패 (${fileRes.status}): ${errText}`);
          } else {
            addLog('success', `✅ ${progress} "${chapter.title}" 생성 완료`);
          }
        } catch (err: any) {
          throw new Error(`Obsidian에 연결할 수 없습니다: ${err.message}\nObsidian Local REST API가 활성화되어 있고 API URL(${apiUrl}) 및 Key가 올바른지 확인해주세요.`);
        }
      }
      addLog('success', `🎉 Obsidian 내보내기 작업이 성공적으로 완료되었습니다!`);
    }
  } catch (err: any) {
    addLog('error', `❌ 내보내기 실패: ${err.message}`);
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
