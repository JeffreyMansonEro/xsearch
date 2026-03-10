"use client";

import { useState, useEffect, useRef } from "react";
import { AccountGroup, SearchResponse, SearchError, ParsedPost, StreamEvent } from "@/types";
import { loadSettings, saveApiKey, saveGroups } from "@/lib/storage";
import { checkRateLimit, recordRequest, getTodayUsage } from "@/lib/rate-limiter";
import ApiKeyInput from "@/components/ApiKeyInput";
import AccountGroupManager from "@/components/AccountGroupManager";
import DateRangePicker from "@/components/DateRangePicker";
import SearchPanel from "@/components/SearchPanel";
import ResultsDisplay from "@/components/ResultsDisplay";

export default function Home() {
  const [apiKey, setApiKeyState] = useState("");
  const [groups, setGroupsState] = useState<AccountGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeHandles, setActiveHandles] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [streamingPosts, setStreamingPosts] = useState<ParsedPost[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<SearchError | null>(null);
  const [mounted, setMounted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const { apiKey, groups } = loadSettings();
    setApiKeyState(apiKey);
    setGroupsState(groups);
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    setToDate(now.toISOString().split("T")[0]);
    setFromDate(from.toISOString().split("T")[0]);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function handleApiKeyChange(key: string) {
    setApiKeyState(key);
    saveApiKey(key);
  }

  function handleGroupsChange(updated: AccountGroup[]) {
    setGroupsState(updated);
    saveGroups(updated);
  }

  async function handleSearch() {
    setError(null);
    setResult(null);
    setStreamingPosts([]);
    setStatusMessage("");

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setError({ message: rateCheck.message! });
      if (rateCheck.waitSeconds) setCooldown(rateCheck.waitSeconds);
      return;
    }

    if (!apiKey) {
      setError({ message: "APIキーを入力してください。" });
      return;
    }
    if (activeHandles.length === 0) {
      setError({ message: "検索対象のアカウントを選択してください。" });
      return;
    }
    if (!fromDate || !toDate) {
      setError({ message: "検索期間を指定してください。" });
      return;
    }

    setLoading(true);
    setStatusMessage("リクエスト送信中...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, handles: activeHandles, fromDate, toDate }),
        signal: controller.signal,
      });

      recordRequest();

      if (!res.body) {
        const data = await res.json().catch(() => null);
        setError({ message: data?.message || "応答が空です。" });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const posts: ParsedPost[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              setStatusMessage(event.message);
              break;
            case "post":
              posts.push(event.post);
              setStreamingPosts([...posts]);
              setStatusMessage(`${posts.length}件の投稿を発見...`);
              break;
            case "done":
              setResult({
                posts: posts.length > 0 ? posts : [],
                rawText: event.rawText,
                citations: event.citations,
              });
              setStatusMessage("");
              setLoading(false);
              return;
            case "error":
              setError({ message: event.message });
              setLoading(false);
              return;
          }
        }
      }

      // Stream ended without a "done" event — use what we have
      if (posts.length > 0) {
        setResult({ posts, rawText: "", citations: [] });
      } else if (!error) {
        setError({ message: "応答の処理中にストリームが終了しました。" });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError({ message: "ネットワークエラーが発生しました。接続を確認してください。" });
      }
    } finally {
      setLoading(false);
      setStatusMessage("");
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setLoading(false);
    setStatusMessage("");
    if (streamingPosts.length > 0) {
      setResult({ posts: streamingPosts, rawText: "", citations: [] });
    }
  }

  const canSearch =
    apiKey.length > 0 && activeHandles.length > 0 && fromDate && toDate && cooldown === 0;
  const usage = mounted ? getTodayUsage() : { used: 0, limit: 30 };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card-bg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <h1 className="text-lg font-bold">xSearch</h1>
          <span className="text-xs text-muted">X投稿検索ツール</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <ApiKeyInput apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            <AccountGroupManager
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupsChange={handleGroupsChange}
              onSelectGroup={setSelectedGroupId}
              activeHandles={activeHandles}
              onActiveHandlesChange={setActiveHandles}
            />
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
            />
            <SearchPanel
              onSearch={handleSearch}
              onCancel={handleCancel}
              loading={loading}
              disabled={!canSearch}
              cooldown={cooldown}
              usage={usage}
              statusMessage={statusMessage}
            />
          </div>

          <div>
            <ResultsDisplay
              result={result}
              streamingPosts={loading ? streamingPosts : []}
              error={error}
              loading={loading}
            />
            {!result && !error && !loading && streamingPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border p-12 text-center">
                <svg
                  className="mb-3 h-12 w-12 text-muted/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <p className="text-sm text-muted">
                  アカウントグループと日付範囲を選択して検索してください
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
