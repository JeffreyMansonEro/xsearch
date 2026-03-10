export interface AccountGroup {
  id: string;
  name: string;
  handles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchRequest {
  apiKey: string;
  handles: string[];
  fromDate: string;
  toDate: string;
}

export interface ParsedPost {
  handle: string;
  text: string;
  date: string;
  time: string;
  url: string;
}

export interface SearchResponse {
  posts: ParsedPost[];
  rawText: string;
  citations: string[];
}

export interface SearchError {
  message: string;
  code?: string;
}

// xAI API types
export interface XAIRequestBody {
  model: string;
  stream?: boolean;
  tools: XAITool[];
  input: string;
}

// Streaming event types (NDJSON from API route to client)
export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "post"; post: ParsedPost }
  | { type: "done"; rawText: string; citations: string[] }
  | { type: "error"; message: string };

export interface XAITool {
  type: "x_search";
  x_search: {
    allowed_x_handles: string[];
    from_date: string;
    to_date: string;
  };
}

export interface XAICitation {
  type: string;
  url: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

export interface XAIOutputItem {
  type: string;
  text?: string;
  content?: Array<{ type: string; text?: string; citations?: XAICitation[] }>;
}

export interface XAIResponseBody {
  id: string;
  output: XAIOutputItem[];
  error?: { message: string; code?: string };
}
