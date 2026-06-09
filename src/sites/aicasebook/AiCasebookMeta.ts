export interface AiCasebookMeta {
  id: string;
  title: string;
  url: string;
  summary: string;
  body: string;
  author: string;
  categories: string[];
  tags: string[];
  publishedAt: string | null;
  views: number;
  sourceLink: string;
  seriesName: string | null;
  rawContent: string;
}
