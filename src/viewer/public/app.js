let currentCollection = '';
let currentSearch = '';
let currentCountry = '';
let currentPage = 1;
const limit = 30;
let activeDoc = null; // Store current active document for lazy loading

// Debounce timer
let searchTimeout = null;

// DOM Elements
const collectionList = document.getElementById('collection-list');
const documentList = document.getElementById('document-list');
const searchInput = document.getElementById('search-input');
const countryFilters = document.getElementById('country-filters');
const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');
const docTitle = document.getElementById('doc-title');
const docSourceBadge = document.getElementById('doc-source-badge');
const docDate = document.getElementById('doc-date');
const docUrl = document.getElementById('doc-url');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageIndicator = document.getElementById('page-indicator');
const appContainer = document.getElementById('app-container');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarExpand = document.getElementById('sidebar-expand');

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadCollections();
  setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
  // Tabs toggle
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabId = btn.getAttribute('data-tab');
      const panes = document.querySelectorAll('.tab-pane');
      panes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      
      // Lazy load content for active tab
      triggerLazyTabLoad(tabId);
    });
  });

  // Country badges filtering
  const countryBadges = document.querySelectorAll('.country-badge');
  countryBadges.forEach(badge => {
    badge.addEventListener('click', () => {
      // If we were dragging, prevent click logic or treat as click if no drag occurred
      if (countryFilters.classList.contains('was-dragging')) {
        return;
      }
      countryBadges.forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      currentCountry = badge.getAttribute('data-country') || '';
      currentPage = 1;
      if (currentCollection) {
        loadDocuments(currentCollection, currentSearch, currentPage);
      }
    });
  });

  // Horizontal drag-to-scroll for country-filters
  let isDown = false;
  let startX;
  let scrollLeft;
  let dragThreshold = false;

  countryFilters.addEventListener('mousedown', (e) => {
    isDown = true;
    countryFilters.classList.add('dragging');
    countryFilters.classList.remove('was-dragging');
    startX = e.pageX - countryFilters.offsetLeft;
    scrollLeft = countryFilters.scrollLeft;
    dragThreshold = false;
  });

  countryFilters.addEventListener('mouseleave', () => {
    isDown = false;
    countryFilters.classList.remove('dragging');
  });

  countryFilters.addEventListener('mouseup', () => {
    isDown = false;
    countryFilters.classList.remove('dragging');
    // Add a tiny delay to clear was-dragging so clicks aren't registered right after drag
    if (dragThreshold) {
      countryFilters.classList.add('was-dragging');
      setTimeout(() => {
        countryFilters.classList.remove('was-dragging');
      }, 50);
    }
  });

  countryFilters.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - countryFilters.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    if (Math.abs(walk) > 5) {
      dragThreshold = true;
    }
    countryFilters.scrollLeft = scrollLeft - walk;
  });

  // Horizontal wheel scroll for country-filters
  countryFilters.addEventListener('wheel', (e) => {
    if (countryFilters.scrollWidth > countryFilters.clientWidth) {
      e.preventDefault();
      countryFilters.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Debounced search
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value;
      currentPage = 1;
      if (currentCollection) {
        loadDocuments(currentCollection, currentSearch, currentPage);
      }
    }, 350);
  });

  // Pagination controls
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      if (currentCollection) {
        loadDocuments(currentCollection, currentSearch, currentPage);
      }
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    if (currentCollection) {
      loadDocuments(currentCollection, currentSearch, currentPage);
    }
  });

  // Sidebar collapse/expand toggles
  sidebarToggle.addEventListener('click', () => {
    appContainer.classList.add('sidebar-collapsed');
    sidebarExpand.classList.remove('hidden');
  });

  sidebarExpand.addEventListener('click', () => {
    appContainer.classList.remove('sidebar-collapsed');
    sidebarExpand.classList.add('hidden');
  });
}

// 1. Fetch Collections
async function loadCollections() {
  try {
    const response = await fetch('/api/collections');
    const collections = await response.json();
    
    collectionList.innerHTML = '';
    collections.forEach((col, idx) => {
      const li = document.createElement('li');
      li.className = 'collection-item';
      li.textContent = col.name;
      li.setAttribute('data-id', col.id);
      
      li.addEventListener('click', () => {
        document.querySelectorAll('.collection-item').forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        currentCollection = col.id;
        currentPage = 1;
        
        // Show/hide country filter badges only for LinkedIn Jobs
        if (col.id === 'linkedin.jobs') {
          countryFilters.classList.remove('hidden');
        } else {
          countryFilters.classList.add('hidden');
          currentCountry = '';
          // Reset badge active state to 'All'
          document.querySelectorAll('.country-badge').forEach(b => {
            if (b.getAttribute('data-country') === '') {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        }
        
        loadDocuments(col.id, currentSearch, currentPage);
      });
      
      collectionList.appendChild(li);

      // Auto-click first collection
      if (idx === 0) {
        li.click();
      }
    });
  } catch (error) {
    console.error('Error loading collections:', error);
    collectionList.innerHTML = `<li class="error-text">Failed to load collections</li>`;
  }
}

// 2. Fetch Documents List
async function loadDocuments(collection, search, page) {
  resetDetailPanel();
  documentList.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <div>Loading documents...</div>
    </div>
  `;
  
  try {
    const url = `/api/documents?collection=${encodeURIComponent(collection)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}&country=${encodeURIComponent(currentCountry)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    documentList.innerHTML = '';
    
    if (!data.documents || data.documents.length === 0) {
      documentList.innerHTML = '<div class="empty-state">No documents found</div>';
      updatePagination(0, page);
      return;
    }
    
    data.documents.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'doc-card';
      
      // Determine displays
      const mainTitle = doc.title || doc.jobTitle;
      const company = doc.companyName;
      const dateVal = doc.collectedAt || doc.createdAt || doc.scrapedAt || doc.updatedAt || doc.publishedAt;
      
      let dateString = 'N/A';
      if (dateVal) {
        const dateObj = new Date(dateVal);
        dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
      
      let titleParts = [];
      if (mainTitle) titleParts.push(mainTitle);
      if (company) titleParts.push(company);
      
      if (titleParts.length === 0) {
        const fallbackName = doc.site || getSiteNameFromCollection(collection);
        const suffix = doc.jobId || doc.id || doc.topicId || doc.postId;
        titleParts.push(suffix ? `${fallbackName} - #${suffix}` : fallbackName);
      }
      
      titleParts.push(dateString);
      const titleText = titleParts.join(' - ');
      
      const collectedDate = dateVal ? new Date(dateVal).toLocaleString('ko-KR') : 'N/A';
      
      card.innerHTML = `
        <h4>${titleText}</h4>
        <div class="doc-card-meta">
          <span class="doc-tag">${doc.companyName || doc.site || getSiteNameFromCollection(collection)}</span>
          <span class="doc-time">${collectedDate}</span>
        </div>
      `;
      
      card.addEventListener('click', () => {
        document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        loadDocumentDetail(doc._id || doc.id || doc.jobId || doc.topicId || doc.postId, collection);
      });
      
      documentList.appendChild(card);
    });
    
    updatePagination(data.total, page);
  } catch (error) {
    console.error('Error loading documents:', error);
    documentList.innerHTML = `<div class="empty-state" style="color: #ef4444; font-family: monospace; font-size: 11px; text-align: left; padding: 10px; white-space: pre-wrap; word-break: break-all;">Failed to load documents: ${error.message}\n${error.stack}</div>`;
  }
}

// 3. Fetch Document Detail
async function loadDocumentDetail(id, collection) {
  try {
    const response = await fetch(`/api/documents/${id}?collection=${encodeURIComponent(collection)}`);
    const doc = await response.json();
    
    detailEmpty.classList.add('hidden');
    detailContent.classList.remove('hidden');
    
    // Normalize into silver and bronze objects
    let silver = {};
    let bronze = {};
    if (doc.isMerged) {
      silver = doc.silver || {};
      bronze = doc.bronze || {};
    } else {
      // Fallback: If not merged, treat as both
      silver = doc;
      bronze = doc;
    }
    
    // Header details
    let detailMainTitle = silver.title || silver.jobTitle;
    let detailParts = [];
    if (detailMainTitle) detailParts.push(detailMainTitle);
    if (silver.companyName) detailParts.push(silver.companyName);
    
    if (detailParts.length === 0) {
      const fallbackName = silver.site || getSiteNameFromCollection(collection);
      const detailSuffix = silver.jobId || silver.id || silver.topicId || silver.postId || bronze.jobId;
      docTitle.textContent = detailSuffix ? `${fallbackName} - #${detailSuffix}` : fallbackName;
    } else {
      const detailSuffix = silver.jobId || silver.id || silver.topicId || silver.postId || bronze.jobId;
      const titleStr = detailParts.join(' - ');
      docTitle.textContent = detailSuffix ? `${titleStr} - #${detailSuffix}` : titleStr;
    }
    docSourceBadge.textContent = silver.companyName || silver.site || getSiteNameFromCollection(collection);
    
    const detailDateVal = silver.updatedAt || silver.collectedAt || silver.createdAt || bronze.scrapedAt;
    docDate.textContent = detailDateVal ? new Date(detailDateVal).toLocaleDateString('ko-KR') : 'N/A';
    
    const docUrlVal = bronze.url || silver.url;
    if (docUrlVal) {
      docUrl.href = docUrlVal;
      docUrl.classList.remove('hidden');
    } else {
      docUrl.classList.add('hidden');
    }
    
    // Tab 1: Rendered markdown (Silver)
    const renderedPane = document.getElementById('tab-rendered');
    let mdContent = silver.markdown || silver.description || silver.content || '';
    if (mdContent) {
      const cleanedMd = cleanMarkdownContent(mdContent);
      const metaTable = generateMetaTableMarkdown(silver, bronze, collection);
      renderedPane.innerHTML = marked.parse(cleanedMd + metaTable);
    } else if (bronze.rawHtml) {
      renderedPane.innerHTML = `<blockquote>No markdown parsed from Silver layer yet. Showing raw HTML source instead. Use Bronze (HTML) tab for preview.</blockquote>`;
    } else {
      renderedPane.innerHTML = `<p class="empty-text">No markdown or description content available.</p>`;
    }
    
    // Clear other tabs to trigger lazy load on click
    document.getElementById('markdown-code').textContent = 'Loading...';
    document.getElementById('silver-json-code').textContent = 'Loading...';
    document.getElementById('html-preview').srcdoc = '';
    document.getElementById('bronze-json-code').textContent = 'Loading...';
    
    // Save active document reference
    activeDoc = { silver, bronze };
    
    // Auto reset to first tab (Silver Rendered)
    const defaultTabBtn = document.querySelector('.tab-btn[data-tab="tab-rendered"]');
    defaultTabBtn.classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b !== defaultTabBtn) b.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === 'tab-rendered') pane.classList.add('active');
      else pane.classList.remove('active');
    });
  } catch (error) {
    console.error('Error loading document detail:', error);
  }
}

// Lazy load tab content on demand to avoid performance lag
function triggerLazyTabLoad(tabId) {
  if (!activeDoc) return;
  
  if (tabId === 'tab-markdown') {
    const mdCode = document.getElementById('markdown-code');
    let mdContent = activeDoc.silver.markdown || activeDoc.silver.description || activeDoc.silver.content || '';
    if (mdContent) {
      const cleanedMd = cleanMarkdownContent(mdContent);
      const metaTable = generateMetaTableMarkdown(activeDoc.silver, activeDoc.bronze, currentCollection);
      mdContent = cleanedMd + metaTable;
    }
    mdCode.textContent = mdContent || 'No markdown content available.';
    
    if (mdContent.length < 100000) {
      Prism.highlightElement(mdCode);
    } else {
      mdCode.textContent += '\n\n/* [Notice] Syntax highlighting skipped because the content is too large (> 100KB) */';
    }
  } 
  else if (tabId === 'tab-silver-json') {
    const jsonCode = document.getElementById('silver-json-code');
    const jsonString = JSON.stringify(activeDoc.silver, null, 2);
    jsonCode.textContent = jsonString;
    
    if (jsonString.length < 100000) {
      Prism.highlightElement(jsonCode);
    } else {
      jsonCode.textContent += '\n\n// [Notice] Syntax highlighting skipped because the JSON is too large (> 100KB)';
    }
  }
  else if (tabId === 'tab-html') {
    const htmlIframe = document.getElementById('html-preview');
    if (!htmlIframe.srcdoc || htmlIframe.srcdoc === 'about:blank' || htmlIframe.contentWindow.document.body.innerHTML === '') {
      if (activeDoc.bronze.rawHtml) {
        htmlIframe.srcdoc = activeDoc.bronze.rawHtml;
      } else {
        htmlIframe.srcdoc = `<body style="background:#0f131a;color:#9ca3af;font-family:sans-serif;padding:20px;text-align:center;">
          <h3>No original HTML preview available for this document</h3>
        </body>`;
      }
    }
  } 
  else if (tabId === 'tab-bronze-json') {
    const jsonCode = document.getElementById('bronze-json-code');
    const jsonString = JSON.stringify(activeDoc.bronze, null, 2);
    jsonCode.textContent = jsonString;
    
    if (jsonString.length < 100000) {
      Prism.highlightElement(jsonCode);
    } else {
      jsonCode.textContent += '\n\n// [Notice] Syntax highlighting skipped because the JSON is too large (> 100KB)';
    }
  }
}

// Helpers
function getSiteNameFromCollection(col) {
  if (col.includes('geeknews')) return 'GeekNews';
  if (col.includes('gpters')) return 'GPters';
  if (col.includes('pytorch')) return 'PyTorch KR';
  if (col.includes('linkedin')) return 'LinkedIn';
  return 'Database';
}

function updatePagination(total, page) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  pageIndicator.textContent = `Page ${page} of ${totalPages}`;
  
  prevPageBtn.disabled = (page <= 1);
  nextPageBtn.disabled = (page >= totalPages);
}

function generateMetaTableMarkdown(silver, bronze, collection) {
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
  
  const url = bronze.url || silver.url || '';
  if (url) rows.push(`| **URL** | [Link ↗](${url}) |`);
  
  const dateVal = silver.updatedAt || silver.collectedAt || silver.createdAt || bronze.scrapedAt;
  if (dateVal) {
    const formattedDate = new Date(dateVal).toLocaleString('ko-KR');
    rows.push(`| **Date (수집일)** | ${formattedDate} |`);
  }
  
  if (rows.length === 0) return '';
  
  return `

---

### 📋 LLM Wiki Metadata

| Key (속성) | Value (값) |
| :--- | :--- |
${rows.join('\n')}
`;
}

function cleanMarkdownContent(mdContent) {
  if (!mdContent) return '';
  
  let cleaned = mdContent.trim();
  
  // 1. Remove Frontmatter (YAML blocks)
  if (cleaned.startsWith('---')) {
    const nextDashes = cleaned.indexOf('---', 3);
    if (nextDashes !== -1) {
      cleaned = cleaned.substring(nextDashes + 3).trim();
    }
  }
  
  // 2. Remove summary / basic info sections for LinkedIn Jobs
  // Match "## 🏢 기본 및 근무 정보" or "# 📌 채용 공고 핵심 요약" up to "## 📝 JD"
  const jdMatch = cleaned.match(/## 📝 JD/i);
  if (jdMatch) {
    const jdIndex = cleaned.indexOf(jdMatch[0]);
    cleaned = cleaned.substring(jdIndex).trim();
  }
  
  return cleaned;
}

function resetDetailPanel() {
  detailEmpty.classList.remove('hidden');
  detailContent.classList.add('hidden');
  activeDoc = null;
  // Clear tab contents to avoid page flashing
  document.getElementById('tab-rendered').innerHTML = '';
  document.getElementById('markdown-code').textContent = '';
  document.getElementById('silver-json-code').textContent = '';
  document.getElementById('html-preview').srcdoc = '';
  document.getElementById('bronze-json-code').textContent = '';
}

