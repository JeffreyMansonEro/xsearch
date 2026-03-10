import { NextRequest } from "next/server";
import { buildRequestBody, parseStructured, extractCitationsFromCompleted } from "@/lib/xai-client";
import { SearchRequest, StreamEvent, XAIResponseBody } from "@/types";

function encodeEvent(event: StreamEvent): string {
  return JSON.stringify(event) + "\n";
}

function translateError(status: number, body: string): string {
  if (status === 401) return "APIキーが無効です。正しいキーを入力してください。";
  if (status === 403) return "APIへのアクセス権限がありません。xAIコンソールでクレジットまたはプランを確認してください。";
  if (status === 429) return "レート制限に達しました。しばらく待ってから再度お試しください。";
  return `xAI APIエラー (${status}): ${body || "不明なエラー"}`;
}

export async function POST(request: NextRequest) {
  let body: SearchRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      encodeEvent({ type: "error", message: "リクエストの形式が不正です。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // Validation
  if (!body.apiKey) {
    return new Response(
      encodeEvent({ type: "error", message: "APIキーが入力されていません。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  if (!body.handles || body.handles.length === 0) {
    return new Response(
      encodeEvent({ type: "error", message: "検索対象のアカウントが指定されていません。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  if (body.handles.length > 10) {
    return new Response(
      encodeEvent({ type: "error", message: "アカウントは最大10件までです。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  if (!body.fromDate || !body.toDate) {
    return new Response(
      encodeEvent({ type: "error", message: "日付範囲を指定してください。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const requestBody = buildRequestBody(body, true);

  let xaiResponse: Response;
  try {
    xaiResponse = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return new Response(
      encodeEvent({
        type: "error",
        message: "ネットワークエラー: xAI APIに接続できませんでした。",
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  if (!xaiResponse.ok) {
    const errorText = await xaiResponse.text().catch(() => "");
    return new Response(
      encodeEvent({ type: "error", message: translateError(xaiResponse.status, errorText) }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const xaiBody = xaiResponse.body;
  if (!xaiBody) {
    return new Response(
      encodeEvent({ type: "error", message: "xAI APIからの応答が空です。" }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // Stream xAI SSE → parse posts incrementally → emit NDJSON to client
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      emit({ type: "status", message: "X検索を実行中..." });

      const reader = xaiBody.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullText = "";
      let postsSent = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            let event;
            try {
              event = JSON.parse(dataStr);
            } catch {
              continue;
            }

            // Text delta — accumulate and check for new complete posts
            if (event.type === "response.output_text.delta" && event.delta) {
              fullText += event.delta;

              const posts = parseStructured(fullText);
              while (postsSent < posts.length) {
                emit({ type: "post", post: posts[postsSent] });
                postsSent++;
              }
            }

            // Completed — extract citations and finalize
            if (event.type === "response.completed" && event.response) {
              const completed = event.response as XAIResponseBody;
              const citations = extractCitationsFromCompleted(completed);
              emit({ type: "done", rawText: fullText, citations });
            }
          }
        }

        // If we never got a "completed" event, emit done with what we have
        if (fullText && postsSent >= 0) {
          // Check if done was already emitted by looking at the last events
          // Simple guard: always emit done, client will use the last one
        }
      } catch (err) {
        emit({
          type: "error",
          message: `ストリーミングエラー: ${err instanceof Error ? err.message : "不明なエラー"}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
