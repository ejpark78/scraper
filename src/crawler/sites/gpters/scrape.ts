import * as fs from 'fs';

function extractIdFromGptersUrl(url: string): string {
  const parts = url.split('-');
  return parts[parts.length - 1] || '';
}

async function fetchGptersGuestToken(): Promise<string> {
  const res = await fetch('https://www.gpters.org/news');
  const html = await res.text();
  const match = html.match(/accessToken":"([^"]+)"/);
  if (!match) {
    throw new Error('Failed to extract GPTERS guest access token from homepage');
  }
  return match[1];
}

export async function scrapeGptersGraphQL(url: string, tempPath: string): Promise<void> {
  const id = extractIdFromGptersUrl(url);
  const token = await fetchGptersGuestToken();
  const query = `
query getPost($id: ID!) {
  post(id: $id) {
    id
    title
    slug
    createdAt
    publishedAt
    createdBy { member { name } }
    reactionsCount
    repliesCount
    shortContent
    fields { key value }
    space { id name slug }
  }
}`;
  const response = await fetch('https://api.bettermode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables: { id } }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GPTERS GraphQL HTTP status ${response.status} for ID ${id}: ${body.slice(0, 200)}`);
  }
  const resJson = await response.json();
  const post = resJson.data?.post;
  if (!post) {
    throw new Error(`GPTERS post ID ${id} not found in GraphQL response`);
  }
  fs.writeFileSync(tempPath, JSON.stringify(post), 'utf-8');
}
