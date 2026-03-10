import {
  SearchRequest,
  SearchResponse,
  ParsedPost,
  XAIRequestBody,
  XAIResponseBody,
} from "@/types";

export function buildRequestBody(req: SearchRequest, stream = false): XAIRequestBody {
  const handlesStr = req.handles.map((h) => `@${h}`).join(", ");
  return {
    model: "grok-4",
    stream,
    tools: [
      {
        type: "x_search",
        x_search: {
          allowed_x_handles: req.handles,
          from_date: req.fromDate,
          to_date: req.toDate,
        },
      },
    ],
    input: `Search for posts from ${handlesStr} between ${req.fromDate} and ${req.toDate}. List every post you find. For each post, use this exact format:

---POST---
handle: <handle without @>
datetime: <YYYY-MM-DD HH:MM>
text: <full post text>
url: <post URL>
---END---

If you find no posts, say "投稿が見つかりませんでした。"`,
  };
}

export function parseResponse(body: XAIResponseBody): SearchResponse {
  const rawText = extractOutputText(body);
  const citations = extractCitationsFromResponse(body);

  let posts = parseStructured(rawText);
  if (posts.length === 0) {
    posts = parseFallback(rawText, citations);
  }

  return { posts, rawText, citations };
}

function extractOutputText(body: XAIResponseBody): string {
  if (!body.output || !Array.isArray(body.output)) return "";
  for (const item of body.output) {
    if (item.type === "message" && item.content) {
      for (const block of item.content) {
        if (block.type === "output_text" && block.text) {
          return block.text;
        }
      }
    }
  }
  return "";
}

function extractCitationsFromResponse(body: XAIResponseBody): string[] {
  const urls: string[] = [];
  if (!body.output || !Array.isArray(body.output)) return urls;
  for (const item of body.output) {
    if (item.type === "message" && item.content) {
      for (const block of item.content) {
        if (block.citations) {
          for (const c of block.citations) {
            if (c.url && !urls.includes(c.url)) {
              urls.push(c.url);
            }
          }
        }
      }
    }
  }
  return urls;
}

/** Extract citations from a streamed completed response object */
export function extractCitationsFromCompleted(response: XAIResponseBody): string[] {
  return extractCitationsFromResponse(response);
}

/** Parse structured ---POST---/---END--- blocks from accumulated text.
 *  Returns all complete blocks found so far. */
export function parseStructured(text: string): ParsedPost[] {
  const posts: ParsedPost[] = [];
  const blocks = text.split("---POST---");

  for (const block of blocks) {
    const endIdx = block.indexOf("---END---");
    if (endIdx < 0) continue; // Only parse complete blocks
    const content = block.substring(0, endIdx);

    const handleMatch = content.match(/handle:\s*@?(\w+)/i);
    const datetimeMatch = content.match(/datetime:\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})?/i);
    const dateMatch = content.match(/date:\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})?/i);
    const textMatch = content.match(/text:\s*([\s\S]*?)(?=\nurl:|\n---END---|$)/i);
    const urlMatch = content.match(/url:\s*(https?:\/\/[^\s\n]+)/i);

    if (handleMatch && textMatch) {
      const dtMatch = datetimeMatch || dateMatch;
      posts.push({
        handle: handleMatch[1],
        date: dtMatch ? dtMatch[1] : "",
        time: dtMatch && dtMatch[2] ? dtMatch[2] : "",
        text: textMatch[1].trim(),
        url: urlMatch ? urlMatch[1] : "",
      });
    }
  }

  return posts;
}

export function parseFallback(text: string, citations: string[]): ParsedPost[] {
  const posts: ParsedPost[] = [];
  const xUrls = citations.filter((u) =>
    u.match(/https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/)
  );
  for (const url of xUrls) {
    const match = url.match(
      /https?:\/\/(?:x\.com|twitter\.com)\/(\w+)\/status\/(\d+)/
    );
    if (match) {
      posts.push({ handle: match[1], date: "", time: "", text: "", url });
    }
  }
  const inlineRefs = text.matchAll(/\[\[?\d+\]?\]\((https?:\/\/[^\s)]+)\)/g);
  for (const ref of inlineRefs) {
    const refUrl = ref[1];
    const urlMatch = refUrl.match(
      /https?:\/\/(?:x\.com|twitter\.com)\/(\w+)\/status\/(\d+)/
    );
    if (urlMatch && !posts.some((p) => p.url === refUrl)) {
      posts.push({ handle: urlMatch[1], date: "", time: "", text: "", url: refUrl });
    }
  }
  return posts;
}
