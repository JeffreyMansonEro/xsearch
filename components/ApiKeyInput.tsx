"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onApiKeyChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-foreground">STEP 1: APIキー設定</label>
        <a 
          href="https://console.x.ai/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[10px] text-primary hover:underline font-medium"
        >
          キーを取得する &nearr;
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="xai-..."
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="rounded-lg border border-input-border px-3 py-2 text-xs font-medium text-muted hover:bg-input-bg active:bg-input-bg/50 transition-colors"
        >
          {visible ? "隠す" : "表示"}
        </button>
      </div>
      <p className="text-[10px] text-muted leading-relaxed">
        ※キーはブラウザにのみ安全に保存されます。
      </p>
    </div>
  );
}
