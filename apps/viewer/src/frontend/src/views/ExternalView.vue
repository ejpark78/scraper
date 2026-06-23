<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

defineProps<{
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

// UI Tabs: 'export' | 'import'
const activeTab = ref<'export' | 'import'>('export');

// Common Connection Settings
const connectionType = ref<'clipper' | 'server'>('clipper');
const joplinUrl = ref<string>('http://127.0.0.1:41184');
const joplinToken = ref<string>('');

// Joplin Server (CLI) specific inputs
const joplinEmail = ref<string>('');
const joplinPassword = ref<string>('');
const joplinEncryptionPassword = ref<string>('');
const isCliSyncing = ref<boolean>(false);

// Export Tab States
const availableBooks = ref<string[]>([]);
const loadingBooks = ref<boolean>(false);
const selectedBook = ref<string>('');
const exporting = ref<boolean>(false);
const exportLog = ref<{ type: 'info' | 'success' | 'error'; message: string; time: string }[]>([]);

// Import Tab States
const folders = ref<{ id: string; title: string }[]>([]);
const selectedFolder = ref<string>('');
const loadingFolders = ref<boolean>(false);
const importing = ref<boolean>(false);
const importLog = ref<{ type: 'info' | 'success' | 'error'; message: string; time: string }[]>([]);

onMounted(() => {
  // Load connection type
  const savedType = localStorage.getItem('joplin_conn_type') as 'clipper' | 'server';
  if (savedType) {
    connectionType.value = savedType;
    if (savedType === 'clipper') {
      joplinUrl.value = 'http://127.0.0.1:41184';
    } else {
      const savedUrl = localStorage.getItem('joplin_server_url');
      if (savedUrl) joplinUrl.value = savedUrl;
    }
  }

  const savedToken = localStorage.getItem('joplin_token');
  if (savedToken) joplinToken.value = savedToken;

  const savedEmail = localStorage.getItem('joplin_email');
  if (savedEmail) joplinEmail.value = savedEmail;

  fetchAvailableBooks();
});

// Watch settings and save to localStorage
watch(connectionType, (newVal) => {
  localStorage.setItem('joplin_conn_type', newVal);
  if (newVal === 'clipper') {
    joplinUrl.value = 'http://127.0.0.1:41184';
  } else {
    const savedUrl = localStorage.getItem('joplin_server_url');
    joplinUrl.value = savedUrl || 'https://notes.coala.pro';
  }
});

watch(joplinUrl, (newVal) => {
  if (connectionType.value === 'server') {
    localStorage.setItem('joplin_server_url', newVal);
  }
});

watch(joplinToken, (newVal) => {
  localStorage.setItem('joplin_token', newVal);
});

watch(joplinEmail, (newVal) => {
  localStorage.setItem('joplin_email', newVal);
});

// Helper for logger
function addLog(tab: 'export' | 'import', type: 'info' | 'success' | 'error', message: string) {
  const time = new Date().toLocaleTimeString('ko-KR');
  const targetLog = tab === 'export' ? exportLog : importLog;
  targetLog.value.unshift({ type, message, time });
}

function clearLog(tab: 'export' | 'import') {
  if (tab === 'export') exportLog.value = [];
  else importLog.value = [];
}

// ---------------- EXPORT LOGIC ----------------

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
    addLog('export', 'error', `책 목록 조회 에러: ${err.message}`);
  } finally {
    loadingBooks.value = false;
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

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
  clearLog('export');
  addLog('export', 'info', `📖 "${bookPath}" 도서 데이터 로드 중...`);

  let book;
  try {
    const response = await fetch(`/api/exporter/book-content?pathName=${encodeURIComponent(bookPath)}`);
    if (!response.ok) {
      const errorText = await response.json();
      throw new Error(errorText.error || '도서 데이터 로드 실패');
    }
    book = await response.json();
    addLog('export', 'info', `📚 "${book.title}" 도서 로드 완료. (총 ${book.chapters.length}개 챕터)`);
  } catch (err: any) {
    addLog('export', 'error', `❌ 도서 로드 에러: ${err.message}`);
    exporting.value = false;
    return;
  }

  try {
    const token = joplinToken.value.trim();
    const apiUrl = joplinUrl.value.trim();
    if (!token) throw new Error('Joplin API 토큰을 입력해주세요.');

    addLog('export', 'info', `🔗 Joplin 연결 확인 및 폴더 생성 시도 (${apiUrl})...`);
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
      addLog('export', 'success', `📁 Joplin에 "${book.title}" 폴더 생성 완료 (ID: ${folderId})`);
    } catch (err: any) {
      throw new Error(`Joplin에 연결할 수 없습니다: ${err.message}\nJoplin 앱이 실행 중이고 웹 클리퍼가 활성화되어 있으며, API URL이 올바른지 확인해주세요.`);
    }

    for (let i = book.chapters.length - 1; i >= 0; i--) {
      const chapter = book.chapters[i];
      const progress = `[${i + 1}/${book.chapters.length}]`;
      addLog('export', 'info', `${progress} 📝 Joplin에 "${chapter.title}" 노트 생성 중...`);

      let content = chapter.content;

      // 마크다운 이미지 업로드 처리
      const imgRegex = /!\[(.*?)\]\((images\/.*?)\)/g;
      const matches = [...content.matchAll(imgRegex)];
      
      if (matches.length > 0) {
        addLog('export', 'info', `${progress} 🖼️ 이미지 처리 중... (총 ${matches.length}개 이미지 감지됨)`);
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
            addLog('export', 'error', `⚠️ 이미지 업로드 실패 (${imgPath}): ${imgErr.message}`);
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
        addLog('export', 'error', `❌ ${progress} "${chapter.title}" 생성 실패: ${errText}`);
      } else {
        addLog('export', 'success', `✅ ${progress} "${chapter.title}" 생성 완료`);
      }
    }
    addLog('export', 'success', `🎉 Joplin 내보내기 작업이 성공적으로 완료되었습니다!`);
  } catch (err: any) {
    addLog('export', 'error', `❌ 내보내기 실패: ${err.message}`);
  } finally {
    exporting.value = false;
  }
}

const isCliTesting = ref<boolean>(false);

async function testJoplinCliConnection() {
  const apiUrl = joplinUrl.value.trim();
  const username = joplinEmail.value.trim();
  const password = joplinPassword.value;

  if (!apiUrl || !username || !password) {
    alert('Joplin Server URL, ID, 비밀번호를 모두 입력해주세요.');
    return;
  }

  isCliTesting.value = true;
  clearLog('import');
  addLog('import', 'info', `🔗 Joplin Server(${apiUrl}) 연결 테스트 시작...`);

  try {
    const res = await fetch('/api/exporter/joplin/cli-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, username, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '연결 테스트 실패');
    }

    const result = await res.json();
    addLog('import', 'success', `✅ ${result.message}`);
  } catch (err: any) {
    addLog('import', 'error', `❌ 연결 테스트 실패: ${err.message}`);
  } finally {
    isCliTesting.value = false;
  }
}

// ---------------- IMPORT LOGIC ----------------


async function syncJoplinCli() {
  const apiUrl = joplinUrl.value.trim();
  const username = joplinEmail.value.trim();
  const password = joplinPassword.value;
  const encryptionPassword = joplinEncryptionPassword.value;

  if (!apiUrl || !username || !password) {
    alert('Joplin Server URL, ID, 비밀번호를 모두 입력해주세요.');
    return;
  }

  isCliSyncing.value = true;
  clearLog('import');
  addLog('import', 'info', `🔄 Joplin Server(${apiUrl}) 연결 및 동기화 시작...`);

  try {
    const res = await fetch('/api/exporter/joplin/cli-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, username, password, encryptionPassword })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'CLI 동기화 요청 실패');
    }

    const result = await res.json();
    addLog('import', 'success', '✅ Joplin CLI 동기화가 성공적으로 완료되었습니다.');
    if (result.log) {
      // 로그를 라인 단위로 출력
      result.log.split('\n').forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed) {
          addLog('import', 'info', ` > ${trimmed}`);
        }
      });
    }
    
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

  try {
    let res;
    if (connectionType.value === 'server') {
      // CLI 방식
      res = await fetch('/api/exporter/joplin/cli-folders');
    } else {
      // 로컬 Clipper 방식
      const token = joplinToken.value.trim();
      const apiUrl = joplinUrl.value.trim();
      if (!token) throw new Error('Joplin API 토큰을 입력해주세요.');

      res = await fetch('/api/exporter/joplin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, token })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '폴더 목록 가져오기 실패');
    }

    const data = await res.json();
    folders.value = data.items || data;
    addLog('import', 'success', `✅ Joplin 노트북 ${folders.value.length}개 조회 완료.`);
    if (folders.value.length > 0) {
      // title이 있는 폴더 혹은 title 필드가 없는 경우 자체 파싱 결과의 title 활용
      selectedFolder.value = folders.value[0].title || folders.value[0].id;
    }
  } catch (err: any) {
    addLog('import', 'error', `❌ 폴더 조회 실패: ${err.message}`);
  } finally {
    loadingFolders.value = false;
  }
}

async function startImport() {
  const targetFolderVal = selectedFolder.value; // ID 또는 노트북 명
  if (!targetFolderVal) {
    alert('가져올 대상 폴더(노트북)를 선택해주세요.');
    return;
  }

  importing.value = true;
  clearLog('import');
  addLog('import', 'info', `📥 노트북 "${targetFolderVal}"의 모든 노트를 마크다운으로 추출하는 중...`);

  try {
    let res;
    if (connectionType.value === 'server') {
      // CLI 방식
      res = await fetch('/api/exporter/joplin/cli-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: targetFolderVal })
      });
    } else {
      // 로컬 Clipper 방식
      const token = joplinToken.value.trim();
      const apiUrl = joplinUrl.value.trim();
      const targetFolderObj = folders.value.find(f => f.id === targetFolderVal);
      const folderName = targetFolderObj ? targetFolderObj.title : 'ImportedFolder';

      res = await fetch('/api/exporter/joplin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, token, folderId: targetFolderVal, folderName })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '가져오기 프로세스 시작 실패');
    }

    const result = await res.json();
    if (result.success) {
      addLog('import', 'success', result.message || `🎉 성공적으로 노트를 임포트하여 마크다운으로 저장하였습니다.`);
    } else {
      addLog('import', 'error', `⚠️ 임포트 중 일부 에러가 발생했습니다: ${result.errors?.join(', ')}`);
    }
  } catch (err: any) {
    addLog('import', 'error', `❌ 가져오기 실패: ${err.message}`);
  } finally {
    importing.value = false;
  }
}

</script>

<template>
  <div class="dashboard-container exporter-view-layout" style="display: flex; flex-direction: column; flex: 1; height: 100%; overflow: hidden;">
    <!-- Main Header -->
    <header class="dashboard-header">
      <div class="dashboard-title-area">
        <button v-if="sidebarCollapsed" @click="emit('toggle-sidebar')" class="sidebar-expand" title="Expand Sidebar" style="margin-right: 8px;">☰</button>
        <span class="brand-icon" style="font-size:24px;">🔄</span>
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#fff;margin:0;">Joplin External 연동</h2>
          <p style="font-size:12px;color:var(--text-secondary);margin:0;">로컬 Web Clipper 및 자체 운영 Joplin Server와 연동하여 노트를 동적으로 가져오거나 내보냅니다.</p>
        </div>
      </div>
    </header>

    <!-- Sub Navigation Tabs & Connection Settings -->
    <div style="padding: 24px 24px 0 24px; display: flex; flex-direction: column; gap: 20px;">
      <!-- Connection Configuration Card -->
      <div class="queue-section-card" style="padding: 20px; display: grid; grid-template-columns: 200px 1fr 1fr; gap: 16px; align-items: flex-end; background: rgba(28, 30, 84, 0.6); border: 1px solid var(--border-color); box-shadow: var(--shadow-md); border-radius: 12px;">
        <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 11px; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🔌 연결 방식</label>
          <select 
            v-model="connectionType" 
            class="form-select" 
            style="width: 100%;"
          >
            <option value="clipper">Joplin 로컬 웹 클리퍼</option>
            <option value="server">자체 Joplin Server (CLI)</option>
          </select>
        </div>

        <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 11px; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🌐 Joplin API/Server URL</label>
          <input 
            type="text" 
            v-model="joplinUrl" 
            placeholder="http://127.0.0.1:41184" 
            class="form-input-text" 
            style="width: 100%;" 
          />
        </div>

        <!-- clipper 방식일 때는 Token 입력 -->
        <div v-if="connectionType === 'clipper'" class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 11px; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🔑 API 인증 토큰</label>
          <input 
            type="password" 
            v-model="joplinToken" 
            placeholder="인증 토큰 입력" 
            class="form-input-text" 
            style="width: 100%;"
          />
        </div>

        <!-- server (CLI) 방식일 때는 ID/PW 입력 -->
        <div v-else class="form-group" style="display: flex; flex-direction: column; gap: 8px; grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-size: 11px; color: var(--text-secondary); font-weight: 700;">👤 계정 이메일 (ID)</label>
            <input type="text" v-model="joplinEmail" placeholder="email@domain.com" class="form-input-text" />
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-size: 11px; color: var(--text-secondary); font-weight: 700;">🔒 계정 비밀번호</label>
            <input type="password" v-model="joplinPassword" placeholder="비밀번호" class="form-input-text" />
          </div>
        </div>
      </div>


      <!-- Feature Tab Controls -->
      <div class="tabs-nav" style="border-bottom: 2px solid var(--border-color); background: none; padding: 0; display: flex; gap: 8px;">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'export' }" 
          @click="activeTab = 'export'"
          style="padding: 10px 24px; font-weight: 600; font-size: 14px;"
        >
          📤 Joplin으로 내보내기 (Export)
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'import' }" 
          @click="activeTab = 'import'"
          style="padding: 10px 24px; font-weight: 600; font-size: 14px;"
        >
          📥 Joplin에서 가져오기 (Import)
        </button>
      </div>
    </div>

    <!-- Active Tab Panel View Content -->
    <div class="dashboard-content" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 20px 24px 24px 24px; min-height: 480px;">
      
      <!-- ================= TAB: EXPORT ================= -->
      <template v-if="activeTab === 'export'">
        <!-- Settings Form -->
        <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px; justify-content: space-between; height: 100%; box-sizing: border-box;">
          <div>
            <h3 style="margin: 0; color: #fff; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 16px;">📖 도서 업로드 설정</h3>
            
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">대상 서적 선택</label>
              <div v-if="loadingBooks" class="loading-text" style="font-size:12px; color:var(--text-muted);">도서 폴더 스캔 중...</div>
              <select v-else v-model="selectedBook" class="form-select" style="width: 100%;">
                <option v-for="book in availableBooks" :key="book" :value="book">{{ book }}</option>
              </select>
            </div>
            
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              선택한 마크다운 문서집을 Joplin 앱의 지정 폴더로 개별 노트화하여 내보냅니다. 이미지 자산이 있을 경우 자동으로 리소스로 처리하여 동기화합니다.
            </p>
          </div>

          <button 
            @click="startExport" 
            class="btn-primary" 
            :disabled="exporting"
            style="padding: 12px; width: 100%; font-weight: bold; font-size: 14px; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px;"
          >
            <span v-if="exporting" class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></span>
            <span>{{ exporting ? '노트 생성 중...' : '📤 내보내기 실행' }}</span>
          </button>
        </div>

        <!-- Logging Console -->
        <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; color: #fff;">📋 내보내기 로그</h3>
            <button @click="clearLog('export')" class="country-badge" style="padding: 4px 10px; font-size: 11px;">로그 지우기</button>
          </div>
          
          <div class="log-console" style="flex: 1; background: #0b0e14; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; overflow-y: auto; border: 1px solid #1a2333; min-height: 250px;">
            <div v-if="exportLog.length === 0" style="color: var(--text-muted); text-align: center; padding-top: 80px;">
              실행 진행 상세 로그가 여기에 실시간으로 표시됩니다.
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
      </template>

      <!-- ================= TAB: IMPORT ================= -->
      <template v-if="activeTab === 'import'">
        <!-- Settings Form -->
        <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px; justify-content: space-between; height: 100%; box-sizing: border-box;">
          <div>
            <h3 style="margin: 0; color: #fff; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 16px;">📖 Joplin 데이터 가져오기</h3>
            
            <!-- server 방식일 경우 동기화(Sync) 트리거 섹션 -->
            <div v-if="connectionType === 'server'" style="margin-bottom: 24px; padding: 12px; border-radius: 8px; background: rgba(0, 0, 0, 0.2); border: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 8px;">
              <h4 style="margin: 0 0 4px 0; font-size: 13px; color: #fff;">🔄 Step 1: Joplin Server 연동</h4>
              <p style="font-size: 11px; color: var(--text-muted); margin: 0 0 4px 0;">계정 설정을 통해 연결성을 확인하거나 동기화를 실행합니다.</p>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button 
                  @click="testJoplinCliConnection" 
                  class="btn-secondary" 
                  style="height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px;"
                  :disabled="isCliTesting || isCliSyncing"
                >
                  <span v-if="isCliTesting" class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
                  <span>{{ isCliTesting ? '테스트 중...' : '🔌 연결 테스트' }}</span>
                </button>
                <button 
                  @click="syncJoplinCli" 
                  class="btn-primary" 
                  style="height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0;"
                  :disabled="isCliTesting || isCliSyncing"
                >
                  <span v-if="isCliSyncing" class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
                  <span>{{ isCliSyncing ? '동기화 중...' : '🔄 동기화 실행' }}</span>
                </button>
              </div>
            </div>

            <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 20px;">
              <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">
                  {{ connectionType === 'server' ? 'Step 2: 대상 노트북(폴더) 선택' : '대상 노트북(폴더) 선택' }}
                </label>
                <div v-if="loadingFolders" class="loading-text" style="font-size:12px; color:var(--text-muted);">노트북 스캔 중...</div>
                <select v-else v-model="selectedFolder" class="form-select" style="width: 100%;">
                  <option v-if="folders.length === 0" value="">{{ connectionType === 'server' ? '동기화를 먼저 완료하거나 노트북을 조회해주세요.' : '조회된 노트북이 없습니다.' }}</option>
                  <option v-for="folder in folders" :key="folder.id" :value="connectionType === 'server' ? folder.title : folder.id">{{ folder.title }}</option>
                </select>
              </div>
              <button @click="loadJoplinFolders" class="btn-secondary" style="height: 38px;" :disabled="loadingFolders">
                조회/갱신
              </button>
            </div>

            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              선택한 Joplin 노트북 안의 모든 노트를 가져와 <strong>`data/joplin/[노트북명]/`</strong> 경로 아래에 마크다운 파일 형식으로 분할 저장합니다.
            </p>
          </div>

          <button 
            @click="startImport" 
            class="btn-primary" 
            :disabled="importing || !selectedFolder"
            style="padding: 12px; width: 100%; font-weight: bold; font-size: 14px; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px;"
          >
            <span v-if="importing" class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></span>
            <span>{{ importing ? '가져오는 중...' : '📥 가져오기 실행' }}</span>
          </button>
        </div>


        <!-- Logging Console -->
        <div class="queue-section-card" style="display: flex; flex-direction: column; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; color: #fff;">📋 가져오기 로그</h3>
            <button @click="clearLog('import')" class="country-badge" style="padding: 4px 10px; font-size: 11px;">로그 지우기</button>
          </div>
          
          <div class="log-console" style="flex: 1; background: #0b0e14; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; overflow-y: auto; border: 1px solid #1a2333; min-height: 250px;">
            <div v-if="importLog.length === 0" style="color: var(--text-muted); text-align: center; padding-top: 80px;">
              가져오기 세부 진행 정보가 여기에 실시간으로 표시됩니다.
            </div>
            <div 
              v-else
              v-for="(log, idx) in importLog" 
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
      </template>

    </div>
  </div>
</template>

<style>
/* Style block removed in favor of global style.css definitions */
</style>
