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

interface ConvertTask {
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
  convertQueue: {
    length: number;
    siteCounts: Record<string, number>;
    items: ConvertTask[];
  };
  indexQueue: {
    length: number;
    siteCounts: Record<string, number>;
    items: any[];
  };
  activeProcessing: {
    length: number;
    items: string[];
  };
  deadLetter: {
    length: number;
    siteCounts: Record<string, number>;
    items: DeadLetterTask[];
  };
  siteStats?: Record<string, { silverCount: number; meiliCount: number; htmlCount: number; urlsCount: number }>;
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
const errorMessage = ref<string>('');

const selectedDoc = ref<ActiveDoc | null>(null);
const activeTab = ref<string>('tab-rendered');
const loadingRaw = ref<boolean>(false);
const loadingRawDetail = ref<boolean>(false);
let detailAbortController: AbortController | null = null;

const sidebarCollapsed = ref<boolean>(false);
const isDraggingCountry = ref<boolean>(false);

// Dashboard State
const queueData = ref<QueueStatusPayload>({
  queues: [],
  convertQueue: { length: 0, siteCounts: {}, items: [] },
  indexQueue: { length: 0, siteCounts: {}, items: [] },
  activeProcessing: { length: 0, items: [] },
  deadLetter: { length: 0, siteCounts: {}, items: [] }
});
const queueDeltas = ref({
  scraping: 0,
  converting: 0,
  indexing: 0,
  active: 0,
  dead: 0
});
const hasPreviousData = ref(false);
const loadingQueues = ref<boolean>(false);
const siteStats = ref<Record<string, { name: string; silverCount: number; meiliCount: number; htmlCount: number; urlsCount: number }> | null>(null);
const loadingSiteStats = ref<boolean>(false);
const addUrlSite = ref<string>('linkedin');
const addUrlVal = ref<string>('');
const addUrlPriority = ref<string>('medium');
const addingUrl = ref<boolean>(false);
const addUrlSuccess = ref<string>('');
const addUrlError = ref<string>('');

// Error Logs states
const errorLogs = ref<any[]>([]);
const totalErrorLogs = ref<number>(0);
const errorSiteCounts = ref<Record<string, number>>({});
const errorServiceCounts = ref<Record<string, number>>({});
const errorFilter = ref<string>('All');
const errorLevelFilter = ref<string>('All');
const errorServiceFilter = ref<string>('All');
const errorPage = ref<number>(1);
const totalErrorPages = ref<number>(1);
const loadingErrors = ref<boolean>(false);
const refreshFeedback = ref<boolean>(false);
const logSearchVal = ref<string>('');
const logSearchQuery = ref<string>('');

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

const errorServices = computed(() => {
  const services = Object.keys(errorServiceCounts.value);
  return ['All', ...services];
});



const convertQueueCounts = computed(() => {
  return Object.entries(queueData.value.convertQueue.siteCounts)
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count);
});

const indexQueueCounts = computed(() => {
  return Object.entries(queueData.value.indexQueue?.siteCounts || {})
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count);
});

const totalScrapingCount = computed(() => {
  return queueData.value.queues.reduce((acc: number, q: any) => acc + (q.type === 'list' ? q.length : 0), 0);
});

const totalAllQueuesCount = computed(() => {
  return totalScrapingCount.value + queueData.value.convertQueue.length + (queueData.value.indexQueue?.length || 0);
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

const originalUrl = computed(() => {
  if (!selectedDoc.value) return '';
  return selectedDoc.value.silver?.url || selectedDoc.value.bronze?.url || '';
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
    fetchErrors();
  }
});

watch(errorFilter, () => {
  errorPage.value = 1;
  fetchErrors();
});

watch(errorLevelFilter, () => {
  errorPage.value = 1;
  fetchErrors();
});

watch(errorServiceFilter, () => {
  errorPage.value = 1;
  fetchErrors();
});

watch(errorPage, () => {
  fetchErrors();
});

let logSearchTimeout: any = null;
watch(logSearchVal, (newVal) => {
  clearTimeout(logSearchTimeout);
  logSearchTimeout = setTimeout(() => {
    logSearchQuery.value = newVal;
    errorPage.value = 1;
  }, 350);
});

watch(logSearchQuery, () => {
  fetchErrors();
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
  documents.value = [];     // Clear stale documents immediately
  totalDocuments.value = 0; // Clear total count
  errorMessage.value = '';  // Clear previous error message
  
  try {
    const url = `/api/documents?collection=${encodeURIComponent(currentCollection.value)}&search=${encodeURIComponent(searchQuery.value)}&page=${currentPage.value}&limit=${limit}&country=${encodeURIComponent(currentCountry.value)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    documents.value = data.documents || [];
    totalDocuments.value = data.total || 0;
  } catch (error: any) {
    console.error('Error loading documents:', error);
    errorMessage.value = error.message || '문서를 불러오는 중 오류가 발생했습니다.';
    documents.value = [];
    totalDocuments.value = 0;
  } finally {
    loadingDocs.value = false;
  }
}

async function selectDocument(doc: DocumentMeta) {
  const docId = doc._id || doc.id || doc.jobId;
  if (!docId) return;

  // 1. Cancel previous pending details fetch if any
  if (detailAbortController) {
    detailAbortController.abort();
  }
  detailAbortController = new AbortController();
  const { signal } = detailAbortController;

  // 2. Render Silver content instantly using the existing search result item metadata
  selectedDoc.value = {
    id: docId,
    silver: { ...doc },
    bronze: {
      jobId: doc.jobId,
      url: doc.url,
      rawHtml: '',
      rawJson: null
    }
  };
  activeTab.value = 'tab-rendered';
  loadingRawDetail.value = true;

  // 3. Fetch full document details in the background with abort signal
  try {
    const response = await fetch(`/api/documents/${docId}?collection=${encodeURIComponent(currentCollection.value)}`, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load details: ${response.status}`);
    }
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

    // Preserve the ID but update with the full backend response
    if (selectedDoc.value && selectedDoc.value.id === docId) {
      selectedDoc.value.silver = { ...selectedDoc.value.silver, ...silver };
      selectedDoc.value.bronze = { ...selectedDoc.value.bronze, ...bronze };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Quietly ignore since it's a user-initiated request cancellation
      return;
    }
    console.error('Error loading document detail asynchronously:', error);
  } finally {
    // Only set loading to false if this was the active request
    if (!signal.aborted) {
      loadingRawDetail.value = false;
      triggerHighlighting();
    }
  }
}

async function fetchRawContent() {
  if (!selectedDoc.value || loadingRaw.value) return;
  // If we already have HTML/JSON, don't refetch
  if (selectedDoc.value.bronze.rawHtml || selectedDoc.value.bronze.rawJson) return;

  loadingRaw.value = true;
  try {
    const response = await fetch(`/api/documents/${selectedDoc.value.id}/raw?collection=${encodeURIComponent(currentCollection.value)}`);
    const rawData = await response.json();
    if (selectedDoc.value) {
      selectedDoc.value.bronze.rawHtml = rawData.rawHtml;
      selectedDoc.value.bronze.rawJson = rawData.rawJson;
    }
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
    const newData = await response.json();
    
    if (hasPreviousData.value) {
      const prevScraping = queueData.value.queues.reduce((acc: number, q: any) => acc + (q.type === 'list' ? q.length : 0), 0);
      const newScraping = newData.queues.reduce((acc: number, q: any) => acc + (q.type === 'list' ? q.length : 0), 0);
      
      const prevConverting = queueData.value.convertQueue.length;
      const newConverting = newData.convertQueue.length;

      const prevIndexing = queueData.value.indexQueue?.length || 0;
      const newIndexing = newData.indexQueue?.length || 0;
      
      const prevActive = queueData.value.activeProcessing.length;
      const newActive = newData.activeProcessing.length;
      
      const prevDead = queueData.value.deadLetter.length;
      const newDead = newData.deadLetter.length;
      
      queueDeltas.value = {
        scraping: newScraping - prevScraping,
        converting: newConverting - prevConverting,
        indexing: newIndexing - prevIndexing,
        active: newActive - prevActive,
        dead: newDead - prevDead
      };
    } else {
      hasPreviousData.value = true;
    }
    
    queueData.value = newData;
  } catch (error) {
    console.error('Error loading queues status:', error);
  } finally {
    loadingQueues.value = false;
  }
}

async function fetchSiteStats() {
  loadingSiteStats.value = true;
  try {
    const response = await fetch('/api/site-stats');
    const data = await response.json();
    siteStats.value = data;
  } catch (err) {
    console.error('Error fetching site stats:', err);
  } finally {
    loadingSiteStats.value = false;
  }
}

async function fetchErrors() {
  loadingErrors.value = true;
  try {
    const response = await fetch(`/api/errors?site=${errorFilter.value}&level=${errorLevelFilter.value}&service=${errorServiceFilter.value}&page=${errorPage.value}&search=${encodeURIComponent(logSearchQuery.value)}`);
    const data = await response.json();
    errorLogs.value = data.errors || [];
    totalErrorLogs.value = data.totalCount || 0;
    errorSiteCounts.value = data.siteCounts || {};
    errorServiceCounts.value = data.serviceCounts || {};
    totalErrorPages.value = data.totalPages || 1;
  } catch (err) {
    console.error('Error fetching error logs:', err);
  } finally {
    loadingErrors.value = false;
  }
}

async function clearQueues() {
  if (!confirm('Are you sure you want to clear all queues in Redis? This will stop active scraping and convert tasks.')) {
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
  // Try dynamic lookup in loaded collections list
  const found = collections.value.find(c => c.id === col || c.id === `silver/${col}` || col === `silver/${c.id}`);
  if (found) return found.name;
  
  // Dynamic fallback: remove paths/extensions and perform capitalization
  const clean = col.replace(/^silver\//, '').replace(/\.(jobs|companies|contents)$/, '');
  return clean
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (first: string) => first.toUpperCase());
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
      <div class="section-title" style="margin-top:10px;">Operations</div>
      <ul class="collection-list" style="flex:none;">
        <li 
          class="collection-item"
          :class="{ active: currentCollection === '__dashboard__' }"
          @click="selectDashboard"
        >
          <span style="vertical-align:middle;margin-right:8px;font-size:16px;">📊</span>
          <span style="vertical-align:middle;">Dashboard</span>
        </li>
      </ul>
      <div class="section-title" style="margin-top:20px;">Collections</div>
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
          <div v-else-if="errorMessage" class="error-banner" style="padding: 20px; text-align: center; color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; margin: 10px;">
            <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
            <h4 style="margin: 0 0 4px; color: #ef4444;">API 요청 실패</h4>
            <p style="margin: 0; font-size: 11px; opacity: 0.8; font-family: monospace; word-break: break-all;">{{ errorMessage }}</p>
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
            <button v-if="sidebarCollapsed" @click="sidebarCollapsed = false" class="sidebar-expand" title="Expand Sidebar" style="margin-right: 4px;">☰</button>
            <span class="brand-icon" style="font-size:24px;">📊</span>
            <div>
              <h2 style="font-size:18px;font-weight:700;color:#fff;margin:0;">대시보드</h2>
              <p style="font-size:12px;color:var(--text-secondary);margin:0;">수집 및 가공 현황과 Redis의 작업 대기/진행 큐 현황을 모니터링합니다.</p>
            </div>
          </div>
          <div class="dashboard-actions">
            <button @click="() => { fetchQueues(); fetchErrors(); }" class="btn-secondary" :disabled="loadingQueues || loadingErrors">
              <span :style="{ display: 'inline-block', transition: 'transform 0.6s ease', transform: refreshFeedback ? 'rotate(360deg)' : 'none' }">🔄</span>
              {{ loadingQueues || loadingErrors ? '갱신 중...' : '새로고침' }}
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
                <span v-if="hasPreviousData && queueDeltas.scraping !== 0" :style="{ fontSize: '13px', marginLeft: '6px', fontWeight: '500', color: queueDeltas.scraping > 0 ? '#f87171' : '#4ade80' }">
                  ({{ queueDeltas.scraping > 0 ? '+' : '' }}{{ queueDeltas.scraping.toLocaleString('ko-KR') }})
                </span>
              </span>
              <span class="metric-sub">scrape_queue:* 합계</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">변환 대기 중 (Converting)</span>
              <span class="metric-value">
                {{ queueData.convertQueue.length.toLocaleString('ko-KR') }}
                <span v-if="hasPreviousData && queueDeltas.converting !== 0" :style="{ fontSize: '13px', marginLeft: '6px', fontWeight: '500', color: queueDeltas.converting > 0 ? '#f87171' : '#4ade80' }">
                  ({{ queueDeltas.converting > 0 ? '+' : '' }}{{ queueDeltas.converting.toLocaleString('ko-KR') }})
                </span>
              </span>
              <span class="metric-sub">convert_queue 대기 문서</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">인덱싱 대기 중 (Indexing)</span>
              <span class="metric-value">
                {{ (queueData.indexQueue?.length || 0).toLocaleString('ko-KR') }}
                <span v-if="hasPreviousData && queueDeltas.indexing !== 0" :style="{ fontSize: '13px', marginLeft: '6px', fontWeight: '500', color: queueDeltas.indexing > 0 ? '#f87171' : '#4ade80' }">
                  ({{ queueDeltas.indexing > 0 ? '+' : '' }}{{ queueDeltas.indexing.toLocaleString('ko-KR') }})
                </span>
              </span>
              <span class="metric-sub">index_queue 대기 문서</span>
            </div>

            <div class="metric-card" style="border-color: rgba(239, 68, 68, 0.2);">
              <span class="metric-label" style="color: #f87171;">수집 실패 (Dead)</span>
              <span class="metric-value" style="color: #ef4444;">
                {{ queueData.deadLetter.length.toLocaleString('ko-KR') }}
                <span v-if="hasPreviousData && queueDeltas.dead !== 0" :style="{ fontSize: '13px', marginLeft: '6px', fontWeight: '500', color: queueDeltas.dead > 0 ? '#ef4444' : '#4ade80' }">
                  ({{ queueDeltas.dead > 0 ? '+' : '' }}{{ queueDeltas.dead.toLocaleString('ko-KR') }})
                </span>
              </span>
              <span class="metric-sub">dead_letter_queue 등록 건수</span>
            </div>
          </div>

          <!-- Site Content Stats (MongoDB vs Meilisearch Index Compare) -->
          <div class="queue-section-card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
              <h3 style="margin: 0;">📦 사이트별 콘텐츠 수집 및 인덱싱 현황</h3>
              <button 
                @click="fetchSiteStats" 
                class="btn-secondary" 
                :disabled="loadingSiteStats"
                style="padding: 4px 10px; font-size: 11px; display: flex; align-items: center; gap: 4px; height: 26px;"
              >
                <span>🔄 {{ loadingSiteStats ? '조회 중...' : '수량 조회/새로고침' }}</span>
              </button>
            </div>
            <div class="card-body">
              <div v-if="!siteStats && !loadingSiteStats" class="empty-state" style="height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px;">
                <span style="color: var(--text-muted); font-size: 12px;">수집 및 인덱싱 수량이 계산되지 않았습니다.</span>
                <button @click="fetchSiteStats" class="btn-primary" style="padding: 6px 12px; font-size: 11px; height: 30px;">수량 계산하기</button>
              </div>
              <div v-else-if="loadingSiteStats && !siteStats" class="loading-container" style="height: 120px;">
                <div class="spinner"></div>
                <span style="color: var(--text-muted); font-size: 12px;">데이터베이스에서 수량을 계산 중입니다. 잠시만 기다려주세요...</span>
              </div>
              <div class="queue-table-container" v-else-if="siteStats">
                <table class="dashboard-table" style="font-size: 11px; width: 100%;">
                  <thead>
                    <tr>
                      <th style="width: 28%; text-align: left;">사이트 이름</th>
                      <th style="width: 18%; text-align: center;">Bronze URLs (대상)</th>
                      <th style="width: 18%; text-align: center;">Bronze HTML (다운로드)</th>
                      <th style="width: 18%; text-align: center;">Silver DB (정제)</th>
                      <th style="width: 18%; text-align: center;">Meilisearch (인덱스)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(stats, siteKey) in siteStats" :key="siteKey">
                      <td style="font-weight: 600; color: #fff; text-align: left;">
                        {{ stats.name }} <span style="font-size: 10px; color: var(--text-muted); font-weight: normal; margin-left: 4px;">({{ siteKey }})</span>
                      </td>
                      <td style="text-align: center; font-weight: 500;">
                        <span class="badge-priority low" style="padding: 3px 6px; font-size: 10px; background-color: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2);">{{ stats.urlsCount ? stats.urlsCount.toLocaleString('ko-KR') : 0 }} 건</span>
                      </td>
                      <td style="text-align: center; font-weight: 500;">
                        <span class="badge-priority low" style="padding: 3px 6px; font-size: 10px; background-color: rgba(168, 85, 247, 0.1); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.2);">{{ stats.htmlCount ? stats.htmlCount.toLocaleString('ko-KR') : 0 }} 건</span>
                      </td>
                      <td style="text-align: center; font-weight: 500;">
                        <span class="badge-priority low" style="padding: 3px 8px; font-size: 11px;">{{ stats.silverCount.toLocaleString('ko-KR') }} 건</span>
                      </td>
                      <td style="text-align: center; font-weight: 500;">
                        <span class="badge-priority medium" style="padding: 3px 8px; font-size: 11px;">{{ stats.meiliCount.toLocaleString('ko-KR') }} 건</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Quick URL Add Section -->
          <div class="add-url-panel">
            <h3 style="font-size:14px;font-weight:600;color:#fff;margin:0;">🚀 수집 큐에 URL 수동 등록</h3>
            <div class="add-url-form">
              <select v-model="addUrlSite" class="form-select">
                <option value="linkedin">LinkedIn Jobs</option>
                <option value="geeknews">GeekNews</option>
                <option value="gpters">GPters News</option>
                <option value="gpters_newsletter">GPters Newsletter</option>
                <option value="pytorch_kr">PyTorch KR</option>
                <option value="aicasebook">AICasebook</option>
                <option value="yozm">Yozm IT</option>
                <option value="uppity">Uppity</option>
                <option value="dailydose_ds">Daily Dose of DS</option>
                <option value="maily_josh">Maily Josh</option>
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

          <!-- Queues Tables Monitor -->
          <div class="queue-section-card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3>📥 대기 큐 모니터 (Active Queues)</h3>
              <span class="meta-tag">총 {{ totalAllQueuesCount.toLocaleString('ko-KR') }} 건 대기 중</span>
            </div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                <!-- Scrape Queues Column -->
                <div>
                  <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                    <span>📥 Scrape Queues</span>
                    <span class="meta-tag" style="font-size: 10px;">{{ totalScrapingCount.toLocaleString('ko-KR') }}</span>
                  </h4>
                  <div v-if="queueData.queues.length === 0" class="empty-state" style="height: 100px;">대기 중인 수집 큐가 없습니다.</div>
                  <div v-else class="queue-table-container">
                    <table class="dashboard-table" style="font-size: 11px;">
                      <thead>
                        <tr>
                          <th>큐 이름</th>
                          <th>대기 건수</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="q in queueData.queues" :key="q.name">
                          <td style="font-weight: 600; color: #fff;">{{ q.name.replace('scrape_queue:', '') }}</td>
                          <td>
                            <span :class="['badge-priority', q.name.split(':').pop() || 'low']" style="font-size: 10px; padding: 2px 6px;">{{ q.length.toLocaleString('ko-KR') }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Convert Queue Column -->
                <div>
                  <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                    <span>🔄 Convert Queue</span>
                    <span class="meta-tag" style="font-size: 10px;">{{ queueData.convertQueue.length.toLocaleString('ko-KR') }}</span>
                  </h4>
                  <div v-if="convertQueueCounts.length === 0" class="empty-state" style="height: 100px;">대기 중인 변환 작업이 없습니다.</div>
                  <div v-else class="queue-table-container">
                    <table class="dashboard-table" style="font-size: 11px;">
                      <thead>
                        <tr>
                          <th>사이트</th>
                          <th>대기 건수</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in convertQueueCounts" :key="item.site">
                          <td style="font-weight: 600; color: #fff;">{{ item.site }}</td>
                          <td>
                            <span class="badge-priority medium" style="font-size: 10px; padding: 2px 6px;">{{ item.count.toLocaleString('ko-KR') }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Index Queue Column -->
                <div>
                  <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                    <span>🔍 Index Queue</span>
                    <span class="meta-tag" style="font-size: 10px;">{{ (queueData.indexQueue?.length || 0).toLocaleString('ko-KR') }}</span>
                  </h4>
                  <div v-if="indexQueueCounts.length === 0" class="empty-state" style="height: 100px;">대기 중인 인덱싱 작업이 없습니다.</div>
                  <div v-else class="queue-table-container">
                    <table class="dashboard-table" style="font-size: 11px;">
                      <thead>
                        <tr>
                          <th>사이트</th>
                          <th>대기 건수</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in indexQueueCounts" :key="item.site">
                          <td style="font-weight: 600; color: #fff;">{{ item.site }}</td>
                          <td>
                            <span class="badge-priority high" style="font-size: 10px; padding: 2px 6px;">{{ item.count.toLocaleString('ko-KR') }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Docker Scraper & Converter Log Center (Container Logs) -->
          <div class="queue-section-card" style="max-height: 850px; display: flex; flex-direction: column;">
            <div class="card-header" style="border-top: 2px solid #ef4444; flex-direction: column; align-items: stretch; gap: 12px; height: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <h3 style="color:#f87171; margin: 0;">📋 컨테이너 실시간 로그 (Container Logs)</h3>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input 
                    v-model="logSearchVal" 
                    placeholder="로그 필터 검색..." 
                    style="padding: 4px 10px; font-size: 11px; border-radius: 4px; border: 1px solid var(--border-color); background: #1e1e2e; color: #fff; width: 160px;" 
                  />
                  <button 
                    @click="fetchErrors" 
                    class="country-badge" 
                    style="padding: 4px 10px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                  >
                    🔄 새로고침
                  </button>
                  <span class="badge-priority high" style="margin-left: 4px;">{{ totalErrorLogs.toLocaleString('ko-KR') }}</span>
                </div>
              </div>
              <!-- Service Badges Filters -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                <button 
                  v-for="svc in errorServices" 
                  :key="svc"
                  class="country-badge" 
                  :class="{ active: errorServiceFilter === svc }"
                  @click="errorServiceFilter = svc"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  <span v-if="svc === 'All'">📦 All</span>
                  <span v-else>{{ svc }} ({{ (errorServiceCounts[svc] || 0).toLocaleString('ko-KR') }})</span>
                </button>
              </div>
              <!-- Level Filters -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                <button 
                  v-for="lvl in ['All', 'INFO', 'WARN', 'ERROR']" 
                  :key="lvl"
                  class="country-badge" 
                  :class="{ active: errorLevelFilter === lvl }"
                  @click="errorLevelFilter = lvl"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  <span v-if="lvl === 'All'">📊 All</span>
                  <span v-else-if="lvl === 'INFO'" style="color:#60a5fa;">ℹ️ INFO</span>
                  <span v-else-if="lvl === 'WARN'" style="color:#fbbf24;">⚠️ WARN</span>
                  <span v-else-if="lvl === 'ERROR'" style="color:#f87171;">🛑 ERROR</span>
                </button>
              </div>
            </div>
            <div class="card-body" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
              <div v-if="loadingErrors" class="loading-container" style="height:150px;">
                <div class="spinner"></div>
                <div>로그를 로딩 중입니다...</div>
              </div>
              <div v-else-if="errorLogs.length === 0" class="empty-state" style="height:150px;">해당 필터 조건에 부합하는 로그가 없습니다. ✨</div>
              <div v-else class="queue-table-container" style="flex: 1; overflow-y: auto;">
                <table class="dashboard-table">
                  <thead>
                    <tr>
                      <th style="width:12%;">서비스</th>
                      <th style="width:12%;">레벨</th>
                      <th style="width:15%;">사이트</th>
                      <th style="width:46%;">로그 메시지</th>
                      <th style="width:15%;">로그 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in errorLogs" :key="idx">
                      <td>
                        <span :class="['badge-priority', item.service === 'scraper' ? 'high' : 'medium']" style="font-size:10px;">
                          {{ item.service }}
                        </span>
                      </td>
                      <td>
                        <span :style="{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: item.level === 'ERROR' ? '#ff3b30' : item.level === 'WARN' ? '#ff9500' : '#007aff',
                          backgroundColor: item.level === 'ERROR' ? 'rgba(255,59,48,0.15)' : item.level === 'WARN' ? 'rgba(255,149,0,0.15)' : 'rgba(0,122,255,0.15)'
                        }">
                          {{ item.level }}
                        </span>
                      </td>
                      <td style="font-weight:600; font-size:11px;">{{ item.site }}</td>
                      <td style="word-break:break-all; font-size:11px; text-align:left;">
                        <div 
                          :style="{ fontWeight: '600', color: item.level === 'ERROR' ? '#f87171' : item.level === 'WARN' ? '#fbbf24' : '#fff' }"
                          v-html="item.message"
                        ></div>
                        <div v-if="item.url" style="margin-top:2px;">
                          <a :href="item.url" target="_blank" style="color:var(--accent-color); text-decoration:underline; font-size:10px; font-family:monospace;">
                            {{ item.url }}
                          </a>
                        </div>
                        <div 
                          v-if="item.stack" 
                          style="font-size:10px; color:#ef4444; opacity:0.8; margin-top:4px; font-family:monospace; white-space:pre-wrap; max-height:80px; overflow-y:auto; border-top:1px dashed rgba(239,68,68,0.2); padding-top:4px;"
                          v-html="item.stack"
                        ></div>
                      </td>
                      <td style="font-size:11px; color:var(--text-muted);">
                        {{ new Date(item.timestamp).toLocaleTimeString('ko-KR') }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Pagination controls -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color); flex-shrink:0;">
                <button :disabled="errorPage <= 1" @click="errorPage--" class="page-btn" style="padding:4px 8px;font-size:11px;">◀ 이전</button>
                <span style="font-size:11px;color:var(--text-secondary);">페이지 {{ errorPage }} / {{ totalErrorPages }} (총 {{ totalErrorLogs.toLocaleString('ko-KR') }}건)</span>
                <button :disabled="errorPage >= totalErrorPages" @click="errorPage++" class="page-btn" style="padding:4px 8px;font-size:11px;">다음 ▶</button>
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
            <a v-if="originalUrl" :href="originalUrl" target="_blank" class="meta-tag clickable-site-link" style="text-decoration: none; cursor: pointer;">
              {{ selectedDoc.silver.companyName || getSiteNameFromCollection(currentCollection) }} ↗
            </a>
            <span v-else class="meta-tag">
              {{ selectedDoc.silver.companyName || getSiteNameFromCollection(currentCollection) }}
            </span>
            <span class="meta-tag">{{ formatCollectedDate(selectedDoc.silver.publishedAt || selectedDoc.silver.updatedAt) }}</span>
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
          <div v-if="activeTab === 'tab-html'" class="tab-pane active" style="position: relative; min-height: 200px;">
            <div v-if="loadingRawDetail" class="loading-container" style="position: absolute; inset: 0; background: rgba(15, 19, 26, 0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10;">
              <div class="spinner"></div>
              <div style="margin-top: 12px; color: var(--text-secondary); font-size: 13px;">원본 HTML을 데이터베이스에서 불러오는 중...</div>
            </div>
            <iframe class="html-preview" :srcdoc="iframeSrcDoc"></iframe>
          </div>
          
          <!-- Bronze JSON Pane -->
          <div v-if="activeTab === 'tab-bronze-json'" class="tab-pane active" style="position: relative; min-height: 200px;">
            <div v-if="loadingRawDetail" class="loading-container" style="position: absolute; inset: 0; background: rgba(15, 19, 26, 0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10;">
              <div class="spinner"></div>
              <div style="margin-top: 12px; color: var(--text-secondary); font-size: 13px;">Bronze 원본 JSON을 불러오는 중...</div>
            </div>
            <pre><code class="language-json">{{ bronzeJsonContent }}</code></pre>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
