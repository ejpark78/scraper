/**
 * @file App.vue
 * @description Vue dashboard application for LinkedIn Clipper, including document viewer and Redis queue status dashboard.
 * @constraints
 *   - Strictly typed parameters, avoid loose 'any' declarations where possible.
 *   - Clean aesthetics matching modern space-dark design principles.
 * @dependencies Vue, marked, prismjs, AppConfig-based APIs
 */

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';

// Core State Types
interface Collection {
  id: string;
  name: string;
  favicon?: string;
}

interface ScrapeTask {
  site: string;
  url: string;
  attempt: number;
  priority: string;
}

interface TransformTask {
  site: string;
  id: string;
  bronze_db: string;
  bronze_collection: string;
  bronze_id: string;
  timestamp: string;
}

interface DeadLetterTask {
  site: string;
  url: string;
  error: string;
  failedAt: string;
}

interface QueueInfo {
  name: string;
  type: string;
  length: number;
  items: ScrapeTask[];
}

interface QueueStatusPayload {
  queues: QueueInfo[];
  transformQueue: {
    length: number;
    items: TransformTask[];
  };
  activeProcessing: {
    length: number;
    items: string[];
  };
  deadLetter: {
    length: number;
    items: DeadLetterTask[];
  };
}

interface DocumentMeta {
  _id: string;
  id: string;
  jobId?: string;
  title: string;
  companyName?: string;
  site?: string;
  url?: string;
  geo?: string;
  location?: string;
  publishedAt?: string;
  collectedAt?: string;
  updatedAt?: string;
}

interface ActiveDoc {
  id: string;
  silver: any;
  bronze: {
    jobId?: string;
    url?: string;
    rawHtml?: string;
    rawJson?: any;
  };
}

// State
const collections = ref<Collection[]>([]);
const currentCollection = ref<string>('');
const searchQuery = ref<string>('');
const searchInputVal = ref<string>('');
const currentCountry = ref<string>('');
const currentPage = ref<number>(1);
const limit = 30;

const documents = ref<DocumentMeta[]>([]);
const totalDocuments = ref<number>(0);
const loadingDocs = ref<boolean>(false);

const selectedDoc = ref<ActiveDoc | null>(null);
const activeTab = ref<string>('tab-rendered');
const loadingRaw = ref<boolean>(false);

const sidebarCollapsed = ref<boolean>(false);
const isDraggingCountry = ref<boolean>(false);

// Dashboard State
const queueData = ref<QueueStatusPayload>({
  queues: [],
  transformQueue: { length: 0, items: [] },
  activeProcessing: { length: 0, items: [] },
  deadLetter: { length: 0, items: [] }
});
const loadingQueues = ref<boolean>(false);
const addUrlSite = ref<string>('linkedin');
const addUrlVal = ref<string>('');
const addUrlPriority = ref<string>('medium');
const addingUrl = ref<boolean>(false);
const addUrlSuccess = ref<string>('');
const addUrlError = ref<string>('');

// Dead Letter & Refresh states
const deadLetterFilter = ref<string>('All');
const refreshFeedback = ref<boolean>(false);

// Country badges list for LinkedIn Jobs
const countries = [
  { name: '🌎 All', value: '' },
  { name: '🇯🇵 Japan', value: 'Japan' },
  { name: '🇦🇪 UAE', value: 'United Arab Emirates' },
  { name: '🇦🇹 Austria', value: 'Austria' },
  { name: '🇰🇷 Korea', value: 'South Korea' },
  { name: '🇩🇪 Germany', value: 'Germany' },
  { name: '🇨🇦 Canada', value: 'Canada' },
];

// Computed
const totalPages = computed(() => Math.max(1, Math.ceil(totalDocuments.value / limit)));

const deadLetterSites = computed(() => {
  const sites = queueData.value.deadLetter.items.map(item => item.site);
  const uniqueSites = Array.from(new Set(sites)).filter(Boolean);
  return ['All', ...uniqueSites];
});

const filteredDeadLetterItems = computed(() => {
  if (deadLetterFilter.value === 'All') {
    return queueData.value.deadLetter.items;
  }
  return queueData.value.deadLetter.items.filter(item => item.site === deadLetterFilter.value);
});

const renderedMarkdownHtml = computed(() => {
  if (!selectedDoc.value) return '';
  const silver = selectedDoc.value.silver;
  const mdContent = silver.markdown || silver.description || silver.content || '';
  if (mdContent) {
    const cleanedMd = cleanMarkdownContent(mdContent);
    // Strip comments/discussion section for cleaner rendering
    const commentMatch = cleanedMd.match(/## 💬 댓글|## 💬 Discussion|## 💬 Comments/i);
    const displayMd = commentMatch ? cleanedMd.substring(0, cleanedMd.indexOf(commentMatch[0])).trim() : cleanedMd;
    const metaTable = generateMetaTableMarkdown(silver, selectedDoc.value.bronze, currentCollection.value);
    return marked.parse(displayMd + '\n\n' + metaTable) as string;
  } else if (selectedDoc.value.bronze.rawHtml) {
    return '<blockquote>No markdown parsed from Silver layer yet. Showing raw HTML source instead. Use Bronze (HTML) tab for preview.</blockquote>';
  } else {
    return '<p class="empty-text">No markdown or description content available.</p>';
  }
});

const markdownCodeContent = computed(() => {
  if (!selectedDoc.value) return '';
  let mdContent = selectedDoc.value.silver.markdown || selectedDoc.value.silver.description || selectedDoc.value.silver.content || '';
  if (mdContent) {
    const cleanedMd = cleanMarkdownContent(mdContent);
    const noHtml = cleanedMd.replace(/<[^>]*>/g, '');
    const metaTable = generateMetaTableMarkdown(selectedDoc.value.silver, selectedDoc.value.bronze, currentCollection.value);
    mdContent = noHtml + '\n' + metaTable;
  }
  return mdContent || 'No markdown content available.';
});

const silverJsonContent = computed(() => {
  if (!selectedDoc.value) return '';
  return JSON.stringify(selectedDoc.value.silver, null, 2);
});

const bronzeJsonContent = computed(() => {
  if (!selectedDoc.value) return '';
  return JSON.stringify(selectedDoc.value.bronze, null, 2);
});

// Watch for search input changes (Debounce)
let searchTimeout: any = null;
watch(searchInputVal, (newVal) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery.value = newVal;
    currentPage.value = 1;
  }, 350);
});

// Watch for query parameters and load documents
watch([currentCollection, searchQuery, currentCountry, currentPage], () => {
  if (currentCollection.value && currentCollection.value !== '__dashboard__') {
    fetchDocuments();
  } else if (currentCollection.value === '__dashboard__') {
    fetchQueues();
  }
});

// Lifecycle
onMounted(() => {
  fetchCollections();
});

// APIs
async function fetchCollections() {
  try {
    const response = await fetch('/api/collections');
    collections.value = await response.json();
    if (collections.value.length > 0) {
      selectCollection(collections.value[0].id);
    }
  } catch (error) {
    console.error('Error loading collections:', error);
  }
}

async function fetchDocuments() {
  loadingDocs.value = true;
  selectedDoc.value = null; // Reset details panel
  
  try {
    const url = `/api/documents?collection=${encodeURIComponent(currentCollection.value)}&search=${encodeURIComponent(searchQuery.value)}&page=${currentPage.value}&limit=${limit}&country=${encodeURIComponent(currentCountry.value)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    documents.value = data.documents || [];
    totalDocuments.value = data.total || 0;
  } catch (error) {
    console.error('Error loading documents:', error);
  } finally {
    loadingDocs.value = false;
  }
}

async function selectDocument(doc: DocumentMeta) {
  const docId = doc._id || doc.id || doc.jobId;
  if (!docId) return;

  try {
    const response = await fetch(`/api/documents/${docId}?collection=${encodeURIComponent(currentCollection.value)}`);
    const docData = await response.json();

    let silver = {};
    let bronze = {};
    if (docData.isMerged) {
      silver = docData.silver || {};
      bronze = docData.bronze || {};
    } else {
      silver = docData;
      bronze = docData;
    }

    selectedDoc.value = {
      id: docId,
      silver,
      bronze
    };

    activeTab.value = 'tab-rendered';
  } catch (error) {
    console.error('Error loading document detail:', error);
  }
}

async function fetchRawContent() {
  if (!selectedDoc.value || loadingRaw.value) return;
  if (selectedDoc.value.bronze.rawHtml || selectedDoc.value.bronze.rawJson) return; // Already loaded

  loadingRaw.value = true;
  try {
    const response = await fetch(`/api/documents/${selectedDoc.value.id}/raw?collection=${encodeURIComponent(currentCollection.value)}`);
    const rawData = await response.json();
    selectedDoc.value.bronze.rawHtml = rawData.rawHtml;
    selectedDoc.value.bronze.rawJson = rawData.rawJson;
  } catch (error) {
    console.error('Error loading raw content:', error);
  } finally {
    loadingRaw.value = false;
  }
}

// Watch active tab to trigger lazy load for raw HTML/JSON
watch(activeTab, (newTab) => {
  if (newTab === 'tab-html' || newTab === 'tab-bronze-json') {
    fetchRawContent().then(() => {
      triggerHighlighting();
    });
  } else {
    triggerHighlighting();
  }
});

function triggerHighlighting() {
  setTimeout(() => {
    Prism.highlightAll();
  }, 50);
}

// Helpers
async function fetchQueues() {
  loadingQueues.value = true;
  refreshFeedback.value = true;
  setTimeout(() => {
    refreshFeedback.value = false;
  }, 600);
  try {
    const response = await fetch('/api/queues');
    queueData.value = await response.json();
  } catch (error) {
    console.error('Error loading queues status:', error);
  } finally {
    loadingQueues.value = false;
  }
}

async function clearQueues() {
  if (!confirm('Are you sure you want to clear all queues in Redis? This will stop active scraping and transform tasks.')) {
    return;
  }
  try {
    const response = await fetch('/api/queues/clear', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      alert(`Queues cleared successfully. Deleted keys count: ${result.deletedCount}`);
      await fetchQueues();
    } else {
      alert(`Failed to clear queues: ${result.error}`);
    }
  } catch (error: any) {
    alert(`Error clearing queues: ${error.message}`);
  }
}

async function addUrlQueue() {
  if (!addUrlVal.value.trim()) {
    addUrlError.value = 'URL is required';
    return;
  }
  
  addingUrl.value = true;
  addUrlSuccess.value = '';
  addUrlError.value = '';
  
  try {
    const response = await fetch('/api/queues/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        site: addUrlSite.value,
        url: addUrlVal.value.trim(),
        priority: addUrlPriority.value
      })
    });
    const result = await response.json();
    if (result.success) {
      addUrlSuccess.value = `Successfully queued URL to ${result.queue}`;
      addUrlVal.value = '';
      await fetchQueues();
    } else {
      addUrlError.value = result.error || 'Failed to add URL to queue';
    }
  } catch (error: any) {
    addUrlError.value = `Error adding URL: ${error.message}`;
  } finally {
    addingUrl.value = false;
  }
}

function selectDashboard() {
  currentCollection.value = '__dashboard__';
}

function selectCollection(id: string) {
  currentCollection.value = id;
  currentPage.value = 1;
  currentCountry.value = '';
}

function getSiteNameFromCollection(col: string) {
  if (col.includes('geeknews')) return 'GeekNews';
  if (col.includes('gpters')) return 'GPters';
  if (col.includes('pytorch')) return 'PyTorch KR';
  if (col.includes('linkedin')) return 'LinkedIn';
  return 'Database';
}

function formatCollectedDate(dateVal?: string) {
  if (!dateVal) return 'N/A';
  const dateObj = new Date(dateVal);
  return dateObj.toLocaleString('ko-KR');
}

function cleanMarkdownContent(mdContent: string) {
  if (!mdContent) return '';
  let cleaned = mdContent.trim();
  
  if (cleaned.startsWith('---')) {
    const nextDashes = cleaned.indexOf('---', 3);
    if (nextDashes !== -1) {
      cleaned = cleaned.substring(nextDashes + 3).trim();
    }
  }
  
  const jdMatch = cleaned.match(/## 📝 JD/i);
  if (jdMatch) {
    const jdIndex = cleaned.indexOf(jdMatch[0]);
    cleaned = cleaned.substring(jdIndex).trim();
  }
  return cleaned;
}

function generateMetaTableMarkdown(silver: any, bronze: any, collection: string) {
  const rows = [];
  
  const title = silver.title || silver.jobTitle || '';
  if (title) rows.push(`| **Title (제목)** | ${title} |`);
  
  const company = silver.companyName || '';
  if (company) rows.push(`| **Company (회사)** | ${company} |`);
  
  const loc = silver.location || '';
  if (loc) rows.push(`| **Location (위치)** | ${loc} |`);
  
  const docId = silver.jobId || silver.id || silver.topicId || silver.postId || bronze.jobId || '';
  if (docId) rows.push(`| **Document ID** | \`${docId}\` |`);
  
  const source = getSiteNameFromCollection(collection);
  rows.push(`| **Source (출처)** | ${source} (\`${collection}\`) |`);
  
  const space = silver.spaceName || '';
  if (space) rows.push(`| **Space (스페이스)** | ${space} |`);
  
  const url = bronze.url || silver.url || '';
  if (url) rows.push(`| **URL** | [Link ↗](${url}) |`);
  
  const dateVal = silver.updatedAt || silver.collectedAt || silver.createdAt || bronze.scrapedAt;
  if (dateVal) {
    const formattedDate = new Date(dateVal).toLocaleString('ko-KR');
    rows.push(`| **Date (수집일)** | ${formattedDate} |`);
  }
  
  if (rows.length === 0) return '';
  return `\n\n---\n\n### 📋 LLM Wiki Metadata\n\n| Key (속성) | Value (값) |\n| :--- | :--- |\n${rows.join('\n')}\n`;
}

function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

const iframeSrcDoc = computed(() => {
  if (!selectedDoc.value) return '';
  if (loadingRaw.value) {
    return `<body style="background:#0f131a;color:#9ca3af;font-family:sans-serif;padding:20px;text-align:center;"><h3>Loading raw HTML...</h3></body>`;
  }
  const bronze = selectedDoc.value.bronze;
  if (bronze.rawHtml) {
    const raw = bronze.rawHtml;
    const isJsonStr = typeof raw === 'string' && /^\s*[{[]/.test(raw);
    let displayHtml = raw;
    if (isJsonStr) {
      try {
        const parsed = JSON.parse(raw);
        const fieldsMap: any = {};
        if (Array.isArray(parsed.fields)) {
          for (const f of parsed.fields) fieldsMap[f.key] = f.value;
        }
        displayHtml = (fieldsMap.content || parsed.shortContent || raw).replace(/\\(["nrt\\])/g, (_: string, c: string) => {
          const map: Record<string, string> = { '"': '"', 'n': '\n', 'r': '\r', 't': '\t', '\\': '\\' };
          return map[c] || _;
        });
      } catch {}
    }
    const hasMainOutlet = displayHtml.includes('id="main-outlet"');
    const hasComments = displayHtml.includes('id="discourse-comments"');
    const hasItempropText = displayHtml.includes('itemprop="text"');
    const isSpaShell = (hasMainOutlet || hasComments) && !hasItempropText;
    if (isSpaShell) {
      return `<body style="background:#0f131a;color:#9ca3af;font-family:sans-serif;padding:30px;text-align:center;">
        <h3>⚠️ Bronze HTML is a Discourse SPA shell</h3>
        <p style="max-width:500px;margin:20px auto;line-height:1.6;">
          The raw HTML was collected as a JavaScript-rendered SPA page without actual post content.
          Use the <strong>Silver (Rendered)</strong> or <strong>Silver (JSON)</strong> tabs to view the extracted markdown content.
        </p>
      </body>`;
    } else {
      return displayHtml;
    }
  } else if (bronze.rawJson) {
    const prettyJson = JSON.stringify(bronze.rawJson, null, 2);
    return `<body style="background:#0f131a;color:#e2e8f0;font-family:monospace;padding:20px;font-size:12px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(prettyJson)}</body>`;
  }
  return `<body style="background:#0f131a;color:#9ca3af;font-family:sans-serif;padding:20px;text-align:center;"><h3>No original HTML preview available</h3></body>`;
});
</script>

<template>
  <div class="app-container" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'dashboard-active': currentCollection === '__dashboard__' }">
    <!-- 1. Left Sidebar: Collections -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">🛸</span>
        <h2>Antigravity</h2>
        <button @click="sidebarCollapsed = true" class="sidebar-toggle" title="Collapse Sidebar">◀</button>
      </div>
      <div class="section-title">Collections</div>
      <ul class="collection-list">
        <li v-if="collections.length === 0" class="loading-text">Loading collections...</li>
        <li 
          v-for="col in collections" 
          :key="col.id" 
          class="collection-item"
          :class="{ active: currentCollection === col.id }"
          @click="selectCollection(col.id)"
        >
          <img v-if="col.favicon" :src="col.favicon" class="collection-favicon" alt="" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;border-radius:3px;display:inline-block;" />
          <span style="vertical-align:middle;">{{ col.name }}</span>
        </li>
      </ul>
      <div class="section-title" style="margin-top:20px;">Operations</div>
      <ul class="collection-list" style="flex:none;">
        <li 
          class="collection-item"
          :class="{ active: currentCollection === '__dashboard__' }"
          @click="selectDashboard"
        >
          <span style="vertical-align:middle;margin-right:8px;font-size:16px;">📊</span>
          <span style="vertical-align:middle;">Queue Dashboard</span>
        </li>
      </ul>
      <div class="sidebar-footer">
        <span class="mcp-status">
          <span class="status-dot green"></span>
          MCP Server Ready
        </span>
      </div>
    </aside>

    <!-- 2. Middle Panel: Document list & Search -->
    <section v-if="currentCollection !== '__dashboard__'" class="list-panel">
      <div class="search-header">
        <button v-if="sidebarCollapsed" @click="sidebarCollapsed = false" class="sidebar-expand" title="Expand Sidebar">☰</button>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" v-model="searchInputVal" placeholder="Search documents..." autocomplete="off">
        </div>
      </div>
      
      <!-- Country Filter (Only for LinkedIn Jobs) -->
      <div v-if="currentCollection === 'linkedin.jobs'" class="country-filters" :class="{ dragging: isDraggingCountry }">
        <button 
          v-for="country in countries" 
          :key="country.value"
          class="country-badge" 
          :class="{ active: currentCountry === country.value }"
          @click="currentCountry = country.value"
        >
          {{ country.name }}
        </button>
      </div>

      <div class="list-container">
        <div class="document-list">
          <div v-if="loadingDocs" class="loading-container">
            <div class="spinner"></div>
            <div>Loading documents...</div>
          </div>
          <div v-else-if="documents.length === 0" class="empty-state">No documents found</div>
          <div 
            v-else
            v-for="doc in documents" 
            :key="doc._id || doc.id"
            class="doc-card"
            :class="{ active: selectedDoc?.id === (doc._id || doc.id) }"
            @click="selectDocument(doc)"
          >
            <h4>{{ doc.title }}</h4>
            <div class="doc-card-meta">
              <span class="doc-tag">{{ doc.companyName || getSiteNameFromCollection(currentCollection) }}</span>
              <span class="doc-time">{{ formatCollectedDate(doc.publishedAt || doc.collectedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination">
          <button :disabled="currentPage <= 1" @click="currentPage--" class="page-btn">◀</button>
          <span id="page-indicator">Page {{ currentPage }} of {{ totalPages }}</span>
          <button :disabled="currentPage >= totalPages" @click="currentPage++" class="page-btn">▶</button>
        </div>
      </div>
    </section>

    <!-- 3. Right Panel: Document details (Tabs) or Dashboard -->
    <main class="detail-panel" style="flex:1;">
      <!-- Queue Dashboard View -->
      <div v-if="currentCollection === '__dashboard__'" class="dashboard-container">
        <header class="dashboard-header">
          <div class="dashboard-title-area">
            <span class="brand-icon" style="font-size:24px;">📊</span>
            <div>
              <h2 style="font-size:18px;font-weight:700;color:#fff;margin:0;">수집 큐 대시보드</h2>
              <p style="font-size:12px;color:var(--text-secondary);margin:0;">Redis의 작업 대기/진행 큐 현황을 모니터링합니다.</p>
            </div>
          </div>
          <div class="dashboard-actions">
            <button @click="fetchQueues" class="btn-secondary" :disabled="loadingQueues">
              <span :style="{ display: 'inline-block', transition: 'transform 0.6s ease', transform: refreshFeedback ? 'rotate(360deg)' : 'none' }">🔄</span>
              {{ loadingQueues ? '갱신 중...' : '새로고침' }}
            </button>
            <button @click="clearQueues" class="btn-danger">
              <span>🧹</span> 큐 전체 비우기
            </button>
          </div>
        </header>

        <div class="dashboard-content">
          <!-- Summary Metrics Cards -->
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">수집 대기 중 (Scraping)</span>
              <span class="metric-value">
                {{ queueData.queues.reduce((acc: number, q: any) => acc + (q.type === 'list' ? q.length : 0), 0).toLocaleString('ko-KR') }}
              </span>
              <span class="metric-sub">scrape_queue:* 합계</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">변환 대기 중 (Transforming)</span>
              <span class="metric-value">{{ queueData.transformQueue.length.toLocaleString('ko-KR') }}</span>
              <span class="metric-sub">transform_queue 대기 문서</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">현재 수집 중 (Active)</span>
              <span class="metric-value">{{ queueData.activeProcessing.length.toLocaleString('ko-KR') }}</span>
              <span class="metric-sub">active_processing 활성 세트</span>
            </div>
            <div class="metric-card" style="border-color: rgba(239, 68, 68, 0.2);">
              <span class="metric-label" style="color: #f87171;">수집 실패 (Dead)</span>
              <span class="metric-value" style="color: #ef4444;">{{ queueData.deadLetter.length.toLocaleString('ko-KR') }}</span>
              <span class="metric-sub">dead_letter_queue 등록 건수</span>
            </div>
          </div>

          <!-- Quick URL Add Section -->
          <div class="add-url-panel">
            <h3 style="font-size:14px;font-weight:600;color:#fff;margin:0;">🚀 수집 큐에 URL 수동 등록</h3>
            <div class="add-url-form">
              <select v-model="addUrlSite" class="form-select">
                <option value="linkedin">LinkedIn Jobs</option>
                <option value="geeknews">GeekNews</option>
                <option value="gpters_news">GPters News</option>
                <option value="pytorch_kr">PyTorch KR</option>
                <option value="aicasebook">AICasebook</option>
                <option value="yozm">Yozm IT</option>
              </select>
              <select v-model="addUrlPriority" class="form-select">
                <option value="high">🔥 High</option>
                <option value="medium">⚡ Medium</option>
                <option value="low">💤 Low</option>
              </select>
              <input type="text" v-model="addUrlVal" placeholder="수집할 URL을 입력하세요 (e.g. https://www.linkedin.com/jobs/view/...)" class="form-input-text">
              <button @click="addUrlQueue" class="btn-primary" :disabled="addingUrl">
                {{ addingUrl ? '등록 중...' : '큐에 추가' }}
              </button>
            </div>
            <p v-if="addUrlSuccess" style="color:#10b981;font-size:12px;margin-top:8px;font-weight:500;">{{ addUrlSuccess }}</p>
            <p v-if="addUrlError" style="color:#ef4444;font-size:12px;margin-top:8px;font-weight:500;">{{ addUrlError }}</p>
          </div>

          <!-- Queues Tables Grid -->
          <div class="queues-grid">
            <!-- Scrape Queues Detailed Status -->
            <div class="queue-section-card">
              <div class="card-header">
                <h3>📥 스크레이퍼 대기 큐 (Scrape Queues)</h3>
              </div>
              <div class="card-body">
                <div v-if="queueData.queues.length === 0" class="empty-state" style="height:100px;">대기 중인 수집 큐가 없습니다.</div>
                <div v-else class="queue-table-container">
                  <table class="dashboard-table">
                    <thead>
                      <tr>
                        <th>큐 이름</th>
                        <th>유형</th>
                        <th>대기 건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="q in queueData.queues" :key="q.name">
                        <td style="font-weight:600;color:#fff;">{{ q.name }}</td>
                        <td>{{ q.type }}</td>
                        <td>
                          <span :class="['badge-priority', q.name.split(':').pop() || 'low']">{{ q.length.toLocaleString('ko-KR') }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Transform Queue Detailed Status -->
            <div class="queue-section-card">
              <div class="card-header">
                <h3>🔄 변환 대기 큐 (Transform Queue)</h3>
                <span class="meta-tag">{{ queueData.transformQueue.length.toLocaleString('ko-KR') }}</span>
              </div>
              <div class="card-body">
                <div v-if="queueData.transformQueue.items.length === 0" class="empty-state" style="height:100px;">현재 대기 중인 변환 작업이 없습니다.</div>
                <div v-else class="queue-table-container">
                  <table class="dashboard-table">
                    <thead>
                      <tr>
                        <th style="width:25%;">사이트</th>
                        <th style="width:40%;">문서 ID</th>
                        <th style="width:35%;">수집 시각</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in queueData.transformQueue.items" :key="item.id">
                        <td style="font-weight:600;color:#fff;">{{ item.site }}</td>
                        <td style="word-break:break-all;font-family:monospace;font-size:12px;">{{ item.id }}</td>
                        <td style="font-size:11px;">{{ formatCollectedDate(item.timestamp) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 12px; border-top: 1px dashed var(--border-color); padding-top: 8px; line-height: 1.4;">
                  💡 HTML 수집(Scrape) 완료 후, 실시간으로 Markdown/JSON 형태의 Silver 데이터로 변환되기를 기다리고 있는 항목들입니다.
                </div>
              </div>
            </div>
          </div>

          <!-- Dead Letter Queue (Failed Tasks) -->
          <div class="queue-section-card" style="max-height: 600px;">
            <div class="card-header" style="border-top: 2px solid #ef4444; flex-direction: column; align-items: stretch; gap: 12px; height: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color:#f87171;">⚠️ 최종 수집 실패 목록 (Dead Letter Queue)</h3>
                <span class="badge-priority high">{{ filteredDeadLetterItems.length.toLocaleString('ko-KR') }}</span>
              </div>
              <!-- Site Badges Filters -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                <button 
                  v-for="site in deadLetterSites" 
                  :key="site"
                  class="country-badge" 
                  :class="{ active: deadLetterFilter === site }"
                  @click="deadLetterFilter = site"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  {{ site }}
                </button>
              </div>
            </div>
            <div class="card-body">
              <div v-if="filteredDeadLetterItems.length === 0" class="empty-state" style="height:150px;">선택한 필터의 실패 데이터가 없습니다. 깨끗합니다! ✨</div>
              <div v-else class="queue-table-container">
                <table class="dashboard-table">
                  <thead>
                    <tr>
                      <th style="width:12%;">사이트</th>
                      <th style="width:38%;">실패 URL</th>
                      <th style="width:35%;">실패 사유</th>
                      <th style="width:15%;">실패 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in filteredDeadLetterItems" :key="idx">
                      <td style="font-weight:600;">{{ item.site }}</td>
                      <td style="word-break:break-all;font-family:monospace;font-size:12px;">
                        <a :href="item.url" target="_blank" style="color:var(--primary);text-decoration:none;">{{ item.url }}</a>
                      </td>
                      <td class="dead-letter-reason" style="word-break:break-all;">{{ item.error }}</td>
                      <td style="font-size:11px;">{{ formatCollectedDate(item.failedAt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Normal Document Empty/Selected View -->
      <div v-else-if="!selectedDoc" class="detail-empty">
        <div class="empty-art">📬</div>
        <h3>No Document Selected</h3>
        <p>Click a document from the list to view its contents, markdown, and original source HTML.</p>
      </div>

      <div v-else class="detail-content">
        <header class="detail-header">
          <h2>{{ selectedDoc.silver.title || selectedDoc.silver.jobTitle }}</h2>
          <div class="doc-meta-info">
            <span class="meta-tag">{{ selectedDoc.silver.companyName || getSiteNameFromCollection(currentCollection) }}</span>
            <span class="meta-tag">{{ formatCollectedDate(selectedDoc.silver.publishedAt || selectedDoc.silver.updatedAt) }}</span>
            <a v-if="selectedDoc.silver.url" :href="selectedDoc.silver.url" target="_blank" class="meta-link">Reference URL ↗</a>
          </div>
        </header>

        <nav class="tabs-nav">
          <button class="tab-btn" :class="{ active: activeTab === 'tab-rendered' }" @click="activeTab = 'tab-rendered'">Silver (Rendered)</button>
          <button class="tab-btn" :class="{ active: activeTab === 'tab-markdown' }" @click="activeTab = 'tab-markdown'">Silver (Markdown)</button>
          <button class="tab-btn" :class="{ active: activeTab === 'tab-silver-json' }" @click="activeTab = 'tab-silver-json'">Silver (JSON)</button>
          <button class="tab-btn" :class="{ active: activeTab === 'tab-html' }" @click="activeTab = 'tab-html'">Bronze (HTML)</button>
          <button class="tab-btn" :class="{ active: activeTab === 'tab-bronze-json' }" @click="activeTab = 'tab-bronze-json'">Bronze (JSON)</button>
        </nav>

        <div class="tab-panes">
          <!-- Rendered Pane -->
          <div v-if="activeTab === 'tab-rendered'" class="tab-pane active markdown-body" v-html="renderedMarkdownHtml"></div>
          
          <!-- Markdown Code Pane -->
          <div v-if="activeTab === 'tab-markdown'" class="tab-pane active">
            <pre><code class="language-markdown">{{ markdownCodeContent }}</code></pre>
          </div>
          
          <!-- Silver JSON Pane -->
          <div v-if="activeTab === 'tab-silver-json'" class="tab-pane active">
            <pre><code class="language-json">{{ silverJsonContent }}</code></pre>
          </div>
          
          <!-- HTML Preview Pane -->
          <div v-if="activeTab === 'tab-html'" class="tab-pane active">
            <iframe class="html-preview" :srcdoc="iframeSrcDoc"></iframe>
          </div>
          
          <!-- Bronze JSON Pane -->
          <div v-if="activeTab === 'tab-bronze-json'" class="tab-pane active">
            <pre><code class="language-json">{{ bronzeJsonContent }}</code></pre>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
