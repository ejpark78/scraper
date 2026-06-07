let currentCollection = '';
let currentSearch = '';
let currentPage = 1;
const limit = 30;

// Debounce timer
let searchTimeout = null;

// DOM Elements
const collectionList = document.getElementById('collection-list');
const documentList = document.getElementById('document-list');
const searchInput = document.getElementById('search-input');
const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');
const docTitle = document.getElementById('doc-title');
const docSourceBadge = document.getElementById('doc-source-badge');
const docDate = document.getElementById('doc-date');
const docUrl = document.getElementById('doc-url');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageIndicator = document.getElementById('page-indicator');

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
    });
  });

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
      loadDocuments(currentCollection, currentSearch, currentPage);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    loadDocuments(currentCollection, currentSearch, currentPage);
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
  documentList.innerHTML = '<div class="empty-state">Loading documents...</div>';
  
  try {
    const url = `/api/documents?collection=${encodeURIComponent(collection)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;
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
      let mainTitle = doc.title || doc.jobTitle || doc.companyName;
      if (!mainTitle) {
        mainTitle = doc.site || getSiteNameFromCollection(collection);
      }
      const suffix = doc.jobId || doc.id || doc.topicId || doc.postId;
      const titleText = suffix ? `${mainTitle} - #${suffix}` : mainTitle;
      
      const dateVal = doc.collectedAt || doc.createdAt || doc.scrapedAt;
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
    
    // Header details
    let detailMainTitle = doc.title || doc.jobTitle || doc.companyName;
    if (!detailMainTitle) {
      detailMainTitle = doc.site || getSiteNameFromCollection(collection);
    }
    const detailSuffix = doc.jobId || doc.id || doc.topicId || doc.postId;
    docTitle.textContent = detailSuffix ? `${detailMainTitle} - #${detailSuffix}` : detailMainTitle;
    docSourceBadge.textContent = doc.companyName || doc.site || getSiteNameFromCollection(collection);
    
    const detailDateVal = doc.collectedAt || doc.createdAt || doc.scrapedAt;
    docDate.textContent = detailDateVal ? new Date(detailDateVal).toLocaleDateString('ko-KR') : 'N/A';
    
    if (doc.url) {
      docUrl.href = doc.url;
      docUrl.classList.remove('hidden');
    } else {
      docUrl.classList.add('hidden');
    }
    
    // Tab 1: Rendered markdown
    const renderedPane = document.getElementById('tab-rendered');
    const mdContent = doc.markdown || doc.description || doc.content || '';
    if (mdContent) {
      renderedPane.innerHTML = marked.parse(mdContent);
    } else if (doc.rawHtml) {
      renderedPane.innerHTML = `<blockquote>No markdown available. Showing raw HTML source instead. Use HTML tab for preview.</blockquote>`;
    } else {
      renderedPane.innerHTML = `<p class="empty-text">No markdown or description content available.</p>`;
    }
    
    // Tab 2: Markdown source code
    const mdCode = document.getElementById('markdown-code');
    mdCode.textContent = mdContent || 'No markdown content available.';
    Prism.highlightElement(mdCode);
    
    // Tab 3: Original HTML preview
    const htmlIframe = document.getElementById('html-preview');
    if (doc.rawHtml) {
      // Set iframe srcdoc with full HTML safely
      htmlIframe.srcdoc = doc.rawHtml;
    } else {
      htmlIframe.srcdoc = `<body style="background:#0f131a;color:#9ca3af;font-family:sans-serif;padding:20px;text-align:center;">
        <h3>No original HTML preview available for this document</h3>
      </body>`;
    }
    
    // Tab 4: Raw JSON Database Document
    const jsonCode = document.getElementById('json-code');
    jsonCode.textContent = JSON.stringify(doc, null, 2);
    Prism.highlightElement(jsonCode);
    
    // Auto reset to first tab
    document.querySelector('.tab-btn[data-tab="tab-rendered"]').click();
  } catch (error) {
    console.error('Error loading document detail:', error);
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
