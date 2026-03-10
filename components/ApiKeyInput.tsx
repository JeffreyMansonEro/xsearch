"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onApiKeyChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <label className="mb-2 block text-sm font-medium">xAI APIキー</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="xai-..."
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="rounded-lg border border-input-border px-3 py-2 text-sm text-muted hover:bg-input-bg"
        >
          {visible ? "隠す" : "表示"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        キーはブラウザのlocalStorageに保存されます
      </p>
    </div>
  );
}
