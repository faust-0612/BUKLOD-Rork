// Pure and testable parser for selected Supabase Metrics API node_exporter values.
// Never infer CPU utilization from CPU load average or a single counter sample.
const finite = value => Number.isFinite(value) && value >= 0 ? value : null;
const percent = (used, total) => total > 0 && used >= 0 && used <= total
  ? Math.round(1000 * used / total) / 10 : null;

export function parseBuklodProviderMetrics(raw, projectRef) {
  if (typeof raw !== 'string' || raw.length > 2_000_000 ||
      !/^[a-z0-9]{20}$/.test(projectRef)) return null;
  const gauges = new Map();
  const coreIds = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line[0] === '#' || line.length > 850) continue;
    const match = /^([A-Za-z_:][A-Za-z0-9_:]*)\{([^}]*)\}\s+([+\-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+\-]?\d+)?)\s*(?:\S.*)?$/.exec(line);
    if (!match) continue;
    const [,name,labels,strValue] = match;
    if (!/(?:^|,)service_type="db"(?:,|$)/.test(labels) ||
        !labels.includes(`supabase_project_ref="${projectRef}"`)) continue;
    const value = finite(Number(strValue));
    if (value === null) continue;
    if (name === 'node_cpu_seconds_total') {
      const cpu = /(?:^|,)cpu="([^"]+)"/.exec(labels)?.[1];
      const mode = /(?:^|,)mode="([^"]+)"/.exec(labels)?.[1];
      if (cpu && mode === 'idle') coreIds.add(cpu);
    }
    if (name === 'node_filesystem_avail_bytes' || name === 'node_filesystem_size_bytes') {
      if (!/(?:^|,)mountpoint="\/"(?:,|$)/.test(labels)) continue;
    }
    if (['node_memory_MemTotal_bytes', 'node_memory_MemAvailable_bytes',
      'node_memory_SwapTotal_bytes', 'node_memory_SwapFree_bytes',
      'node_filesystem_avail_bytes', 'node_filesystem_size_bytes',
      'node_load1'].includes(name)) gauges.set(name, value);
  }
  const total = gauges.get('node_memory_MemTotal_bytes');
  const available = gauges.get('node_memory_MemAvailable_bytes');
  const diskTotal = gauges.get('node_filesystem_size_bytes');
  const diskAvailable = gauges.get('node_filesystem_avail_bytes');
  const swapTotal = gauges.get('node_memory_SwapTotal_bytes');
  const swapFree = gauges.get('node_memory_SwapFree_bytes');
  const load1 = gauges.get('node_load1');
  const cores = coreIds.size || null;
  const result = {
    memory_percent: total && available !== undefined ? percent(total - available, total) : null,
    filesystem_used_percent: diskTotal && diskAvailable !== undefined
      ? percent(diskTotal - diskAvailable, diskTotal) : null,
    swap_used_percent: swapTotal && swapFree !== undefined
      ? percent(swapTotal - swapFree, swapTotal) : null,
    cpu_load1: load1 ?? null,
    cpu_cores: cores,
    cpu_load_per_core_percent: cores && load1 !== undefined
      ? Math.round(1000 * load1 / cores) / 10 : null,
    cpu_utilization_percent: null,
  };
  if (Object.values(result).every(x => x === null)) return null;
  return result;
}
