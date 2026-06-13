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
  if (currentCollection.value) {
    fetchDocuments();
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
  <div class="app-container" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
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
      <div class="sidebar-footer">
        <span class="mcp-status">
          <span class="status-dot green"></span>
          MCP Server Ready
        </span>
      </div>
    </aside>

    <!-- 2. Middle Panel: Document list & Search -->
    <section class="list-panel">
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

    <!-- 3. Right Panel: Document details (Tabs) -->
    <main class="detail-panel">
      <div v-if="!selectedDoc" class="detail-empty">
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
