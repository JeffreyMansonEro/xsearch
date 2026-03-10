const STORAGE_KEY = "xsearch_request_log";
const MIN_INTERVAL_MS = 15_000; // 15秒
const MAX_RPM = 3;
const MAX_RPD = 30;

interface RequestLog {
  timestamps: number[];
}

function getLog(): RequestLog {
  if (typeof window === "undefined") return { timestamps: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { timestamps: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.timestamps)) return { timestamps: [] };
    return parsed;
  } catch {
    return { timestamps: [] };
  }
}

function saveLog(log: RequestLog): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only last 24h of timestamps to avoid unbounded growth
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    log.timestamps = log.timestamps.filter((t) => t > dayAgo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage full or unavailable
  }
}

export interface RateLimitResult {
  allowed: boolean;
  message?: string;
  waitSeconds?: number;
}

export function checkRateLimit(): RateLimitResult {
  const now = Date.now();
  const log = getLog();

  // Check minimum interval
  if (log.timestamps.length > 0) {
    const last = log.timestamps[log.timestamps.length - 1];
    const elapsed = now - last;
    if (elapsed < MIN_INTERVAL_MS) {
      const wait = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
      return {
        allowed: false,
        message: `連続リクエスト制限: あと${wait}秒お待ちください。`,
        waitSeconds: wait,
      };
    }
  }

  // Check RPM
  const oneMinuteAgo = now - 60_000;
  const recentMinute = log.timestamps.filter((t) => t > oneMinuteAgo);
  if (recentMinute.length >= MAX_RPM) {
    const oldest = recentMinute[0];
    const wait = Math.ceil((oldest + 60_000 - now) / 1000);
    return {
      allowed: false,
      message: `レート制限: 1分あたり${MAX_RPM}回まで。あと${wait}秒お待ちください。`,
      waitSeconds: wait,
    };
  }

  // Check RPD
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayRequests = log.timestamps.filter((t) => t >= dayStart.getTime());
  if (todayRequests.length >= MAX_RPD) {
    return {
      allowed: false,
      message: `日次制限: 本日の上限${MAX_RPD}回に達しました。明日再度お試しください。`,
    };
  }

  return { allowed: true };
}

export function recordRequest(): void {
  const log = getLog();
  log.timestamps.push(Date.now());
  saveLog(log);
}

export function getTodayUsage(): { used: number; limit: number } {
  const log = getLog();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const used = log.timestamps.filter((t) => t >= dayStart.getTime()).length;
  return { used, limit: MAX_RPD };
}
