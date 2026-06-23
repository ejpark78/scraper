import type { Meta, StoryObj } from '@storybook/vue3';
import DashboardView from '../views/DashboardView.vue';

// Mock fetch handler to intercept API calls inside DashboardView
const mockFetchHandler = (url: string) => {
  if (url === '/api/site-stats') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        linkedin: { name: 'LinkedIn Jobs', silverCount: 1420, meiliCount: 1420, htmlCount: 1530, urlsCount: 2000 },
        geeknews: { name: 'GeekNews', silverCount: 380, meiliCount: 380, htmlCount: 400, urlsCount: 450 },
        yozm: { name: '요즘IT', silverCount: 210, meiliCount: 210, htmlCount: 220, urlsCount: 250 },
      }),
    });
  }
  if (url.includes('/api/site-stats/search')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { date: '2026-06-20', stats: { 'linkedin.jobs': 45, 'geeknews.contents': 12 } },
        { date: '2026-06-21', stats: { 'linkedin.jobs': 30, 'geeknews.contents': 8 } },
        { date: '2026-06-22', stats: { 'linkedin.jobs': 55, 'geeknews.contents': 15 } },
      ]),
    });
  }
  if (url === '/api/queues') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        queues: [
          { name: 'sites:linkedin:scrape:high', type: 'list', length: 5, items: [] },
          { name: 'sites:geeknews:scrape:medium', type: 'list', length: 12, items: [] }
        ],
        convertQueue: { length: 3, siteCounts: { linkedin: 3 }, items: [] },
        indexQueue: { length: 0, siteCounts: {}, items: [] },
        activeProcessing: { length: 1, items: ['https://linkedin.com/jobs/view/12345'] },
        deadLetter: { length: 2, siteCounts: { yozm: 2 }, items: [] }
      }),
    });
  }
  return Promise.reject(new Error('Unknown API'));
};

const meta: Meta<typeof DashboardView> = {
  title: 'Views/DashboardView',
  component: DashboardView,
  tags: ['autodocs'],
  args: {
    sidebarCollapsed: false,
  },
  decorators: [
    (story) => {
      // Mock global fetch
      window.fetch = mockFetchHandler as any;
      return story();
    },
  ],
};

export default meta;
type Story = StoryObj<typeof DashboardView>;

export const Default: Story = {
  render: (args) => ({
    components: { DashboardView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><DashboardView v-bind="args" /></div>',
  }),
};

export const Loading: Story = {
  decorators: [
    (story) => {
      // Intentionally delay mock response to simulate loading
      window.fetch = () => new Promise(() => {});
      return story();
    },
  ],
  render: (args) => ({
    components: { DashboardView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><DashboardView v-bind="args" /></div>',
  }),
};
