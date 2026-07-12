export type ActivityLog = {
  category: string;
  title: string;
  value: string;
};

export type ActivityMetrics = {
  workMinutes: number;
  goalProgress: number | null;
  latestWeightKg: number | null;
  deadlineCount: number;
};

function textOf(log: ActivityLog) {
  return `${log.title} ${log.value}`;
}

export function extractMinutes(log: ActivityLog) {
  const text = textOf(log);
  const hours = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:時間|h|hour)/gi)]
    .reduce((total, match) => total + Number(match[1]) * 60, 0);
  const minutes = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:分|m|min|minute)/gi)]
    .reduce((total, match) => total + Number(match[1]), 0);

  return Math.round(hours + minutes);
}

export function extractProgressPercent(log: ActivityLog) {
  const text = textOf(log);
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) return Math.min(100, Math.max(0, Number(percent[1])));

  const ratio = text.match(/(\d+(?:\.\d+)?)\s*割/);
  if (ratio) return Math.min(100, Math.max(0, Number(ratio[1]) * 10));

  if (/半分/.test(text)) return 50;
  return null;
}

export function extractWeightKg(log: ActivityLog) {
  const text = textOf(log);
  const weight = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|キロ)/i);
  return weight ? Number(weight[1]) : null;
}

export function calculateActivityMetrics(logs: ActivityLog[]): ActivityMetrics {
  const workMinutes = logs
    .filter((log) => log.category === "仕事")
    .reduce((total, log) => total + extractMinutes(log), 0);

  const progressValues = logs
    .map(extractProgressPercent)
    .filter((value): value is number => value !== null);

  const weights = logs
    .filter((log) => log.category === "健康")
    .map(extractWeightKg)
    .filter((value): value is number => value !== null);

  return {
    workMinutes,
    goalProgress:
      progressValues.length > 0
        ? Math.round(progressValues.reduce((total, value) => total + value, 0) / progressValues.length)
        : null,
    latestWeightKg: weights[0] ?? null,
    deadlineCount: logs.filter((log) => log.category === "期限").length,
  };
}
