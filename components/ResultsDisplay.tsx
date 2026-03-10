"use client";

import { useState } from "react";
import { SearchResponse, SearchError, ParsedPost } from "@/types";

interface Props {
  result: SearchResponse | null;
  streamingPosts: ParsedPost[];
  error: SearchError | null;
  loading: boolean;
}

const PAGE_SIZE = 10;

function exportCsv(posts: ParsedPost[]) {
  // Summary: per-handle counts
  const counts = new Map<string, number>();
  for (const p of posts) {
    counts.set(p.handle, (counts.get(p.handle) || 0) + 1);
  }

  const BOM = "\uFEFF";
  let csv = BOM;

  // Summary sheet
  csv += "=== 投稿数サマリー ===\r\n";
  csv += "アカウント,投稿数\r\n";
  for (const [handle, count] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) {
    csv += `@${handle},${count}\r\n`;
  }
  csv += `合計,${posts.length}\r\n`;
  csv += "\r\n";

  // Detail sheet
  csv += "=== 投稿一覧 ===\r\n";
  csv += "アカウント,日付,時刻,本文,URL\r\n";
  for (const p of posts) {
    const text = p.text.replace(/"/g, '""').replace(/[\r\n]+/g, " ");
    csv += `@${p.handle},${p.date},${p.time},"${text}",${p.url}\r\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `xsearch_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PostCard({ post }: { post: ParsedPost }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-primary/30">
      <div className="mb-2 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://unavatar.io/x/${post.handle}`}
          alt={post.handle}
          className="h-10 w-10 rounded-full bg-input-bg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/default-avatar.svg";
          }}
        />
        <div>
          <span className="text-sm font-medium">@{post.handle}</span>
          {(post.date || post.time) && (
            <span className="ml-2 text-xs text-muted">
              {post.date}{post.time && ` ${post.time}`}
            </span>
          )}
        </div>
      </div>
      {post.text && (
        <p className="mb-2 whitespace-pre-wrap text-sm leading-relaxed">
          {post.text}
        </p>
      )}
      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          投稿を見る &rarr;
        </a>
      )}
    </div>
  );
}

export default function ResultsDisplay({ result, streamingPosts, error, loading }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [page, setPage] = useState(0);

  // Show streaming posts during loading, final result when done
  const displayPosts = result ? result.posts : streamingPosts;
  const totalPages = Math.max(1, Math.ceil(displayPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedPosts = displayPosts.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Reset page when results change
  const postsKey = result ? "final" : `stream-${streamingPosts.length}`;
  if (page >= totalPages && page > 0) {
    setPage(Math.max(0, totalPages - 1));
  }

  // Streaming skeleton while waiting for first post
  if (loading && streamingPosts.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-card-border bg-card-bg p-4"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-input-bg" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-input-bg" />
                <div className="h-3 w-16 rounded bg-input-bg" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-input-bg" />
              <div className="h-3 w-3/4 rounded bg-input-bg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
        <p className="text-sm font-medium text-danger">{error.message}</p>
      </div>
    );
  }

  if (displayPosts.length === 0 && !result && !loading) return null;

  if (result && result.posts.length === 0 && !result.rawText) {
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
        <p className="text-sm text-muted">投稿が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div key={postsKey}>
      {/* Header bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {displayPosts.length > 0
            ? `${displayPosts.length}件の投稿`
            : "検索結果"}
          {loading && "（受信中...）"}
        </p>
        <div className="flex gap-2">
          {displayPosts.length > 0 && !loading && (
            <button
              onClick={() => exportCsv(displayPosts)}
              className="rounded-lg border border-input-border px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary"
            >
              CSV出力
            </button>
          )}
          {result && (
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs text-muted hover:text-foreground"
            >
              {showRaw ? "カード表示" : "生テキスト表示"}
            </button>
          )}
        </div>
      </div>

      {showRaw && result ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {result.rawText}
          </pre>
          {result.citations.length > 0 && (
            <div className="mt-4 border-t border-card-border pt-3">
              <p className="mb-1.5 text-xs font-medium text-muted">引用リンク:</p>
              <ul className="space-y-1">
                {result.citations.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs text-primary hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : pagedPosts.length > 0 ? (
        <>
          <div className="space-y-3">
            {pagedPosts.map((post, i) => (
              <PostCard key={`${currentPage}-${i}`} post={post} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded-lg border border-input-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-xs text-muted">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded-lg border border-input-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      ) : result ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {result.rawText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
