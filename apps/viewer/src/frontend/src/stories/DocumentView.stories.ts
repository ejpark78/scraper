import type { Meta, StoryObj } from '@storybook/vue3';
import DocumentView from '../views/DocumentView.vue';

// Mock fetch handler to intercept API calls inside DocumentView
const mockFetchHandler = (url: string) => {
  if (url.includes('/api/documents?')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        total: 100,
        page: 1,
        limit: 30,
        documents: [
          { _id: 'doc1', id: 'doc1', title: 'Senior TypeScript Engineer', companyName: 'DeepMind', site: 'linkedin', url: 'https://linkedin.com', geo: 'kr', location: 'Seoul', publishedAt: '2026-06-23T01:00:00Z', collectedAt: '2026-06-23T01:00:00Z', hasSilver: true, hasBronze: true },
          { _id: 'doc2', id: 'doc2', title: 'AI Research Scientist', companyName: 'Google', site: 'linkedin', url: 'https://linkedin.com', geo: 'us', location: 'Mountain View', publishedAt: '2026-06-22T10:00:00Z', collectedAt: '2026-06-22T10:00:00Z', hasSilver: true, hasBronze: true },
        ],
      }),
    });
  }
  if (url.includes('/api/documents/') && url.endsWith('/raw')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        rawHtml: '<div><h1>Senior TypeScript Engineer</h1><p>Welcome to DeepMind details page!</p></div>',
        rawJson: { salary: 'Competitive', experience: '5+ years' }
      }),
    });
  }
  if (url.includes('/api/documents/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'doc1',
        title: 'Senior TypeScript Engineer',
        companyName: 'DeepMind',
        content: '### Job Description\nWe are looking for a senior TypeScript developer...',
        collectedAt: '2026-06-23T01:00:00Z',
      }),
    });
  }
  return Promise.reject(new Error('Unknown API'));
};

const meta: Meta<typeof DocumentView> = {
  title: 'Views/DocumentView',
  component: DocumentView,
  tags: ['autodocs'],
  args: {
    id: 'linkedin.jobs',
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
type Story = StoryObj<typeof DocumentView>;

export const Default: Story = {
  render: (args) => ({
    components: { DocumentView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><DocumentView v-bind="args" /></div>',
  }),
};

export const EmptyList: Story = {
  decorators: [
    (story) => {
      window.fetch = (url: string) => {
        if (url.includes('/api/documents?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ total: 0, page: 1, limit: 30, documents: [] }),
          });
        }
        return mockFetchHandler(url);
      };
      return story();
    },
  ],
  render: (args) => ({
    components: { DocumentView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><DocumentView v-bind="args" /></div>',
  }),
};
