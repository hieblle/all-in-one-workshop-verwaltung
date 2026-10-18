// Minimal Notion API client for the one-time "Workshop Liste" import — no SDK
// dependency needed. All calls retry with backoff and log failures (CLAUDE.md
// rule for external integrations).

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_VERSUCHE = 3;

export interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
  type: string;
  [key: string]: unknown;
}

interface QueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

async function notionFetch(
  path: string,
  apiKey: string,
  body: unknown,
): Promise<unknown> {
  let letzterFehler: unknown;
  for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
    try {
      const response = await fetch(`${NOTION_API}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(
          `Notion API ${response.status}: ${await response.text()}`,
        );
      }
      return await response.json();
    } catch (error) {
      letzterFehler = error;
      console.error(
        `[notion] Versuch ${versuch}/${MAX_VERSUCHE} fehlgeschlagen:`,
        error instanceof Error ? error.message : error,
      );
      if (versuch < MAX_VERSUCHE) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (versuch - 1)));
      }
    }
  }
  throw letzterFehler;
}

/** Fetches all pages of a Notion database (handles pagination). */
export async function fetchAllePages(
  databaseId: string,
  apiKey: string,
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  do {
    const antwort = (await notionFetch(
      `/databases/${databaseId}/query`,
      apiKey,
      cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 },
    )) as QueryResponse;
    pages.push(...antwort.results);
    cursor = antwort.has_more ? antwort.next_cursor : null;
  } while (cursor);
  return pages;
}
