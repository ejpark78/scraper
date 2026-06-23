import type { Meta, StoryObj } from '@storybook/vue3';
import ExternalView from '../views/ExternalView.vue';

// Mock fetch handler to intercept API calls inside ExternalView
const mockFetchHandler = (url: string) => {
  if (url === '/api/exporter/books') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        'harness_guide_book',
        'typescript_oop_principles',
        'joplin_obsidian_sync_flow'
      ]),
    });
  }
  if (url === '/api/exporter/joplin/folders') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        items: [
          { id: 'folder_1', title: 'Pi로 배우는 하네스' },
          { id: 'folder_2', title: 'TypeScript 연구 기록' }
        ]
      }),
    });
  }
  return Promise.reject(new Error('Unknown API'));
};

const meta: Meta<typeof ExternalView> = {
  title: 'Views/ExternalView',
  component: ExternalView,
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
type Story = StoryObj<typeof ExternalView>;

export const ExportTab: Story = {
  render: (args) => ({
    components: { ExternalView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><ExternalView v-bind="args" /></div>',
  }),
};

export const ImportTab: Story = {
  render: (args) => ({
    components: { ExternalView },
    setup() {
      return { args };
    },
    template: '<div style="background:#0c0f16; height:100vh; display:flex;"><ExternalView v-bind="args" /></div>',
  }),
  play: async ({ canvasElement }) => {
    // We can simulate switching to the Import tab
    const buttons = canvasElement.querySelectorAll('.tab-btn');
    const importTabBtn = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Import')
    ) as HTMLButtonElement | undefined;
    if (importTabBtn) {
      importTabBtn.click();
    }
  },
};
