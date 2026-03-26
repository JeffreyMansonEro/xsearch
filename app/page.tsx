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
      <header className="sticky top-0 z-10 border-b border-card-border bg-card-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <div>
              <h1 className="text-lg font-bold leading-none">xSearch</h1>
              <span className="text-[10px] text-muted uppercase tracking-wider">X Post Search Tool</span>
            </div>
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/1l4quTPIuMpP3UBRRWc3FZ-zUxfQ3QxEVitL7CRi55sw/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            操作マニュアル
          </a>
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
            <div className="rounded-xl border border-card-border bg-card-bg p-4 flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground">STEP 3: 期間指定</label>
              <DateRangePicker
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
              />
            </div>
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
