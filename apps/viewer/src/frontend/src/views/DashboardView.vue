<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

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
}

defineProps<{
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

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

// Computed
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

// Watchers
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

onMounted(() => {
  fetchQueues();
  fetchErrors();
});

// Methods
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
</script>

<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="dashboard-title-area">
        <button v-if="sidebarCollapsed" @click="emit('toggle-sidebar')" class="sidebar-expand" title="Expand Sidebar" style="margin-right: 8px;">☰</button>
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
            {{ totalScrapingCount.toLocaleString('ko-KR') }}
            <span v-if="hasPreviousData && queueDeltas.scraping !== 0" :style="{ fontSize: '13px', marginLeft: '6px', fontWeight: '500', color: queueDeltas.scraping > 0 ? '#f87171' : '#4ade80' }">
              ({{ queueDeltas.scraping > 0 ? '+' : '' }}{{ queueDeltas.scraping.toLocaleString('ko-KR') }})
            </span>
          </span>
          <span class="metric-sub">수집 큐 합계</span>
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
                      <td style="font-weight: 600; color: #fff;">{{ q.name.replace('scrape_queue:', '').replace('sites:', '') }}</td>
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
</template>
