'use client';

import { SyntheticEvent, useEffect, useMemo, useState } from 'react';

export interface ResourceVector {
  cpu: number;
  memory: number;
  disk: number;
}

export interface PhysicalHost {
  id: string;
  name: string;
  capacity: ResourceVector;
}

export interface VMRequest {
  id: string;
  name: string;
  sku: string;
  provider: 'azure' | 'google' | 'custom';
  demand: ResourceVector;
}

export type PlacementStrategy
  = 'first-fit' | 'best-fit' | 'worst-fit' | 'azure-compact' | 'google-balanced';

interface HostState {
  host: PhysicalHost;
  used: ResourceVector;
  vmIds: string[];
}

export interface CandidateEvaluation {
  hostId: string;
  hostName: string;
  feasible: boolean;
  remainingBefore: ResourceVector;
  remainingAfter: ResourceVector;
  deficits: ResourceVector;
  postUtilization: ResourceVector;
  residualMean: number;
  maxUtilization: number;
  utilizationSpread: number;
  active: boolean;
  rank?: number;
  scoreLabel?: string;
}

type TracePhase = 'read' | 'filter' | 'score' | 'select' | 'commit' | 'reject';

export interface TraceStep {
  id: string;
  vmIndex: number;
  vm: VMRequest;
  phase: TracePhase;
  title: string;
  detail: string;
  hostStates: HostState[];
  candidates: CandidateEvaluation[];
  selectedHostId?: string;
}

export interface SimulationResult {
  allocations: Record<string, string>;
  failures: string[];
  finalHosts: HostState[];
  metrics: {
    success: number;
    failed: number;
    activeHosts: number;
    cpuUtilization: number;
    memoryUtilization: number;
    diskUtilization: number;
    fragmentation: number;
  };
}

interface VMTemplate {
  key: string;
  sku: string;
  provider: 'azure' | 'google' | 'custom';
  label: string;
  demand: ResourceVector;
}

const STORAGE_KEY = 'cloudbin-sim:v1';

const ZERO: ResourceVector = { cpu: 0, memory: 0, disk: 0 };

const DEFAULT_HOSTS: PhysicalHost[] = [
  {
    id: 'host-a',
    name: '计算节点 A',
    capacity: { cpu: 16, memory: 64, disk: 512 },
  },
  {
    id: 'host-b',
    name: '计算节点 B',
    capacity: { cpu: 12, memory: 48, disk: 384 },
  },
  {
    id: 'host-c',
    name: '计算节点 C',
    capacity: { cpu: 8, memory: 32, disk: 256 },
  },
];

const VM_TEMPLATES: VMTemplate[] = [
  {
    key: 'azure-d2',
    sku: 'Standard_D2s_v5',
    provider: 'azure',
    label: 'Azure · D2s v5',
    demand: { cpu: 2, memory: 8, disk: 64 },
  },
  {
    key: 'azure-d4',
    sku: 'Standard_D4s_v5',
    provider: 'azure',
    label: 'Azure · D4s v5',
    demand: { cpu: 4, memory: 16, disk: 64 },
  },
  {
    key: 'azure-f4',
    sku: 'Standard_F4s_v2',
    provider: 'azure',
    label: 'Azure · F4s v2',
    demand: { cpu: 4, memory: 8, disk: 64 },
  },
  {
    key: 'azure-e4',
    sku: 'Standard_E4s_v5',
    provider: 'azure',
    label: 'Azure · E4s v5',
    demand: { cpu: 4, memory: 32, disk: 64 },
  },
  {
    key: 'google-n2s2',
    sku: 'n2-standard-2',
    provider: 'google',
    label: 'Google · n2-standard-2',
    demand: { cpu: 2, memory: 8, disk: 64 },
  },
  {
    key: 'google-n2s4',
    sku: 'n2-standard-4',
    provider: 'google',
    label: 'Google · n2-standard-4',
    demand: { cpu: 4, memory: 16, disk: 64 },
  },
  {
    key: 'google-n2c4',
    sku: 'n2-highcpu-4',
    provider: 'google',
    label: 'Google · n2-highcpu-4',
    demand: { cpu: 4, memory: 4, disk: 64 },
  },
  {
    key: 'google-n2m4',
    sku: 'n2-highmem-4',
    provider: 'google',
    label: 'Google · n2-highmem-4',
    demand: { cpu: 4, memory: 32, disk: 64 },
  },
  {
    key: 'custom',
    sku: '自定义',
    provider: 'custom',
    label: '自定义 VM',
    demand: { cpu: 2, memory: 4, disk: 32 },
  },
];

const DEFAULT_QUEUE: VMRequest[] = [
  {
    id: 'vm-1',
    name: 'api-primary',
    sku: 'Standard_D4s_v5',
    provider: 'azure',
    demand: { cpu: 4, memory: 16, disk: 64 },
  },
  {
    id: 'vm-2',
    name: 'batch-worker',
    sku: 'n2-highcpu-4',
    provider: 'google',
    demand: { cpu: 4, memory: 4, disk: 64 },
  },
  {
    id: 'vm-3',
    name: 'cache-hot',
    sku: 'Standard_E4s_v5',
    provider: 'azure',
    demand: { cpu: 4, memory: 32, disk: 64 },
  },
  {
    id: 'vm-4',
    name: 'web-edge',
    sku: 'n2-standard-2',
    provider: 'google',
    demand: { cpu: 2, memory: 8, disk: 64 },
  },
  {
    id: 'vm-5',
    name: 'event-consumer',
    sku: 'Standard_F4s_v2',
    provider: 'azure',
    demand: { cpu: 4, memory: 8, disk: 64 },
  },
  {
    id: 'vm-6',
    name: 'analytics-node',
    sku: 'n2-highmem-4',
    provider: 'google',
    demand: { cpu: 4, memory: 32, disk: 64 },
  },
];

const STRATEGIES: {
  id: PlacementStrategy;
  name: string;
  eyebrow: string;
  formula: string;
}[] = [
  {
    id: 'first-fit',
    name: '首次适配',
    eyebrow: '按顺序',
    formula: '选择列表中第一台满足 CPU、内存和磁盘约束的主机。',
  },
  {
    id: 'best-fit',
    name: '最佳适配',
    eyebrow: '减少余量',
    formula: '最小化放置后三项资源的平均归一化剩余比例。',
  },
  {
    id: 'worst-fit',
    name: '最差适配',
    eyebrow: '保留空间',
    formula: '最大化放置后三项资源的平均归一化剩余比例。',
  },
  {
    id: 'azure-compact',
    name: '紧凑装箱',
    eyebrow: 'Azure 风格 · 教学模拟',
    formula: '优先已有 VM 的主机，再最小化平均归一化剩余比例。',
  },
  {
    id: 'google-balanced',
    name: '均衡余量',
    eyebrow: 'Google 风格 · 教学模拟',
    formula: '先最小化最高资源利用率，再最小化三项利用率极差。',
  },
];

const PHASE_LABELS: Record<TracePhase, string> = {
  read: '01 读取请求',
  filter: '02 约束过滤',
  score: '03 策略评分',
  select: '04 选择主机',
  commit: '05 提交分配',
  reject: '04 记录失败',
};

const copyResource = (value: ResourceVector): ResourceVector => ({ ...value });
const addResource = (a: ResourceVector, b: ResourceVector): ResourceVector => ({
  cpu: a.cpu + b.cpu,
  memory: a.memory + b.memory,
  disk: a.disk + b.disk,
});
const subtractResource = (
  a: ResourceVector,
  b: ResourceVector,
): ResourceVector => ({
  cpu: a.cpu - b.cpu,
  memory: a.memory - b.memory,
  disk: a.disk - b.disk,
});

const cloneHostStates = (states: HostState[]): HostState[] =>
  states.map(state => ({
    host: { ...state.host, capacity: copyResource(state.host.capacity) },
    used: copyResource(state.used),
    vmIds: [...state.vmIds],
  }));

function evaluateHost(state: HostState, vm: VMRequest): CandidateEvaluation {
  const before = subtractResource(state.host.capacity, state.used);
  const after = subtractResource(before, vm.demand);
  const deficits = {
    cpu: Math.max(0, -after.cpu),
    memory: Math.max(0, -after.memory),
    disk: Math.max(0, -after.disk),
  };
  const feasible
    = deficits.cpu === 0 && deficits.memory === 0 && deficits.disk === 0;
  const nextUsed = addResource(state.used, vm.demand);
  const utilization = {
    cpu: nextUsed.cpu / state.host.capacity.cpu,
    memory: nextUsed.memory / state.host.capacity.memory,
    disk: nextUsed.disk / state.host.capacity.disk,
  };
  const residualMean
    = (after.cpu / state.host.capacity.cpu
      + after.memory / state.host.capacity.memory
      + after.disk / state.host.capacity.disk)
    / 3;
  const utilizationValues = [
    utilization.cpu,
    utilization.memory,
    utilization.disk,
  ];
  const maxUtilization = Math.max(...utilizationValues);
  const utilizationSpread = maxUtilization - Math.min(...utilizationValues);

  return {
    hostId: state.host.id,
    hostName: state.host.name,
    feasible,
    remainingBefore: before,
    remainingAfter: after,
    deficits,
    postUtilization: utilization,
    residualMean,
    maxUtilization,
    utilizationSpread,
    active: state.vmIds.length > 0,
  };
}

function rankCandidates(
  candidates: CandidateEvaluation[],
  strategy: PlacementStrategy,
): CandidateEvaluation[] {
  const originalOrder = new Map(
    candidates.map((candidate, index) => [candidate.hostId, index]),
  );
  const feasible = candidates.filter(candidate => candidate.feasible);
  feasible.sort((a, b) => {
    let comparison = 0;
    if (strategy === 'best-fit') {
      comparison = a.residualMean - b.residualMean;
    }
    if (strategy === 'worst-fit') {
      comparison = b.residualMean - a.residualMean;
    }
    if (strategy === 'azure-compact') {
      comparison = Number(b.active) - Number(a.active);
      if (comparison === 0) {
        comparison = a.residualMean - b.residualMean;
      }
    }
    if (strategy === 'google-balanced') {
      comparison = a.maxUtilization - b.maxUtilization;
      if (Math.abs(comparison) < 0.000001) {
        comparison = a.utilizationSpread - b.utilizationSpread;
      }
    }
    if (Math.abs(comparison) < 0.000001) {
      comparison
        = (originalOrder.get(a.hostId) ?? 0) - (originalOrder.get(b.hostId) ?? 0);
    }
    return comparison;
  });

  const ranked = new Map(
    feasible.map((candidate, index) => [candidate.hostId, index + 1]),
  );
  return candidates.map((candidate) => {
    if (!candidate.feasible) {
      return candidate;
    }
    let scoreLabel = `顺序 #${(originalOrder.get(candidate.hostId) ?? 0) + 1}`;
    if (strategy === 'best-fit' || strategy === 'worst-fit') {
      scoreLabel = `${(candidate.residualMean * 100).toFixed(1)}% 平均余量`;
    }
    if (strategy === 'azure-compact') {
      scoreLabel = `${candidate.active ? '已激活' : '空闲'} · ${(candidate.residualMean * 100).toFixed(1)}% 余量`;
    }
    if (strategy === 'google-balanced') {
      scoreLabel = `${(candidate.maxUtilization * 100).toFixed(1)}% 峰值 · ${(candidate.utilizationSpread * 100).toFixed(1)}% 极差`;
    }
    return { ...candidate, rank: ranked.get(candidate.hostId), scoreLabel };
  });
}

function summarize(
  finalHosts: HostState[],
  allocations: Record<string, string>,
  failures: string[],
): SimulationResult['metrics'] {
  const totals = finalHosts.reduce(
    (acc, state) => ({
      capacity: addResource(acc.capacity, state.host.capacity),
      used: addResource(acc.used, state.used),
    }),
    { capacity: copyResource(ZERO), used: copyResource(ZERO) },
  );
  const active = finalHosts.filter(state => state.vmIds.length > 0);
  const fragmentation = active.length
    ? active.reduce((sum, state) => {
      const remaining = subtractResource(state.host.capacity, state.used);
      return (
        sum
        + (remaining.cpu / state.host.capacity.cpu
          + remaining.memory / state.host.capacity.memory
          + remaining.disk / state.host.capacity.disk)
        / 3
      );
    }, 0) / active.length
    : 0;

  const percentage = (used: number, capacity: number) =>
    capacity > 0 ? (used / capacity) * 100 : 0;
  return {
    success: Object.keys(allocations).length,
    failed: failures.length,
    activeHosts: active.length,
    cpuUtilization: percentage(totals.used.cpu, totals.capacity.cpu),
    memoryUtilization: percentage(totals.used.memory, totals.capacity.memory),
    diskUtilization: percentage(totals.used.disk, totals.capacity.disk),
    fragmentation: fragmentation * 100,
  };
}

function simulate(
  hosts: PhysicalHost[],
  queue: VMRequest[],
  strategy: PlacementStrategy,
): {
  trace: TraceStep[];
  result: SimulationResult;
} {
  const states: HostState[] = hosts.map(host => ({
    host: { ...host, capacity: copyResource(host.capacity) },
    used: copyResource(ZERO),
    vmIds: [],
  }));
  const trace: TraceStep[] = [];
  const allocations: Record<string, string> = {};
  const failures: string[] = [];

  queue.forEach((vm, vmIndex) => {
    const stepId = `${vm.id}-${vmIndex}`;
    trace.push({
      id: `${stepId}-read`,
      vmIndex,
      vm,
      phase: 'read',
      title: `读取 ${vm.name} 的资源请求`,
      detail: `需要 ${vm.demand.cpu} vCPU、${vm.demand.memory} GiB 内存和 ${vm.demand.disk} GiB 本地临时盘。`,
      hostStates: cloneHostStates(states),
      candidates: [],
    });

    const evaluated = states.map(state => evaluateHost(state, vm));
    const feasibleCount = evaluated.filter(
      candidate => candidate.feasible,
    ).length;
    trace.push({
      id: `${stepId}-filter`,
      vmIndex,
      vm,
      phase: 'filter',
      title: '检查所有物理机的硬约束',
      detail: `${feasibleCount} / ${states.length} 台主机同时满足三项资源要求。`,
      hostStates: cloneHostStates(states),
      candidates: evaluated,
    });

    const ranked = rankCandidates(evaluated, strategy);
    const winner = ranked
      .filter(candidate => candidate.feasible)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .at(0);

    if (!winner) {
      failures.push(vm.id);
      trace.push({
        id: `${stepId}-reject`,
        vmIndex,
        vm,
        phase: 'reject',
        title: `${vm.name} 无法分配`,
        detail:
          '没有任何物理机同时满足 CPU、内存与本地临时盘约束。已记录失败，继续处理下一台 VM。',
        hostStates: cloneHostStates(states),
        candidates: ranked,
      });
      return;
    }

    const strategyInfo = STRATEGIES.find(item => item.id === strategy);
    if (!strategyInfo) {
      throw new Error('Unknown placement strategy');
    }
    trace.push({
      id: `${stepId}-score`,
      vmIndex,
      vm,
      phase: 'score',
      title: `应用「${strategyInfo.name}」评分`,
      detail: strategyInfo.formula,
      hostStates: cloneHostStates(states),
      candidates: ranked,
      selectedHostId: winner.hostId,
    });
    trace.push({
      id: `${stepId}-select`,
      vmIndex,
      vm,
      phase: 'select',
      title: `选择 ${winner.hostName}`,
      detail: `它在当前策略下排名第 1；完全同分时按物理机显示顺序决定。`,
      hostStates: cloneHostStates(states),
      candidates: ranked,
      selectedHostId: winner.hostId,
    });

    const target = states.find(state => state.host.id === winner.hostId);
    if (!target) {
      throw new Error('Selected host is missing');
    }
    target.used = addResource(target.used, vm.demand);
    target.vmIds.push(vm.id);
    allocations[vm.id] = winner.hostId;
    trace.push({
      id: `${stepId}-commit`,
      vmIndex,
      vm,
      phase: 'commit',
      title: `已将 ${vm.name} 放入 ${winner.hostName}`,
      detail: `资源账本已更新：+${vm.demand.cpu} vCPU、+${vm.demand.memory} GiB 内存、+${vm.demand.disk} GiB 本地盘。`,
      hostStates: cloneHostStates(states),
      candidates: ranked,
      selectedHostId: winner.hostId,
    });
  });

  const finalHosts = cloneHostStates(states);
  return {
    trace,
    result: {
      allocations,
      failures,
      finalHosts,
      metrics: summarize(finalHosts, allocations, failures),
    },
  };
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const percent = (value: number) =>
  `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
const providerLabel = (provider: VMRequest['provider']) =>
  provider === 'azure' ? 'AZ' : provider === 'google' ? 'GCP' : '自定义';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResourceVector(value: unknown): value is ResourceVector {
  return isRecord(value)
    && typeof value.cpu === 'number'
    && typeof value.memory === 'number'
    && typeof value.disk === 'number'
    && Number.isFinite(value.cpu)
    && Number.isFinite(value.memory)
    && Number.isFinite(value.disk)
    && value.cpu > 0
    && value.memory > 0
    && value.disk > 0;
}

function isPhysicalHost(value: unknown): value is PhysicalHost {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isResourceVector(value.capacity);
}

function isVmRequest(value: unknown): value is VMRequest {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.sku === 'string'
    && (value.provider === 'azure' || value.provider === 'google' || value.provider === 'custom')
    && isResourceVector(value.demand);
}

function isPlacementStrategy(value: unknown): value is PlacementStrategy {
  return typeof value === 'string' && STRATEGIES.some(item => item.id === value);
}

function isHostList(value: unknown): value is PhysicalHost[] {
  return Array.isArray(value) && value.every((host: unknown) => isPhysicalHost(host));
}

function isVmList(value: unknown): value is VMRequest[] {
  return Array.isArray(value) && value.every((vm: unknown) => isVmRequest(vm));
}

interface SavedState {
  hosts: PhysicalHost[];
  queue: VMRequest[];
  strategy: PlacementStrategy;
  speed: number;
  hadTrace: boolean;
  cursor: number;
}

function readSavedState(raw: string): SavedState | null {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)
    || value.version !== 1
    || !isHostList(value.hosts)
    || !isVmList(value.queue)) {
    return null;
  }
  return {
    hosts: value.hosts,
    queue: value.queue,
    strategy: isPlacementStrategy(value.strategy) ? value.strategy : 'azure-compact',
    speed: typeof value.speed === 'number' && Number.isFinite(value.speed) && value.speed > 0 ? value.speed : 1,
    hadTrace: Array.isArray(value.trace) && value.trace.length > 0,
    cursor: typeof value.cursor === 'number' && Number.isInteger(value.cursor) ? value.cursor : -1,
  };
}

export default function Home() {
  const [hosts, setHosts] = useState<PhysicalHost[]>(DEFAULT_HOSTS);
  const [queue, setQueue] = useState<VMRequest[]>(DEFAULT_QUEUE);
  const [strategy, setStrategy] = useState<PlacementStrategy>('azure-compact');
  const [speed, setSpeed] = useState(1);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingHostId, setEditingHostId] = useState<string | null>(null);
  const [hostDraft, setHostDraft] = useState({
    name: '',
    cpu: 16,
    memory: 64,
    disk: 512,
  });
  const [selectedTemplate, setSelectedTemplate] = useState('azure-d2');
  const [vmDraft, setVmDraft] = useState({
    name: 'new-service',
    cpu: 2,
    memory: 8,
    disk: 64,
    quantity: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = readSavedState(raw);
          if (saved) {
            setHosts(saved.hosts);
            setQueue(saved.queue);
            setStrategy(saved.strategy);
            setSpeed(saved.speed);
            if (saved.hadTrace) {
              const simulation = simulate(saved.hosts, saved.queue, saved.strategy);
              setTrace(simulation.trace);
              setResult(simulation.result);
              setCursor(Math.max(-1, Math.min(saved.cursor, simulation.trace.length - 1)));
            }
          }
        }
      }
      catch {
        setNotice('本机保存的数据无法读取，已安全恢复为示例场景。');
        window.localStorage.removeItem(STORAGE_KEY);
      }
      finally {
        setHydrated(true);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          hosts,
          queue,
          strategy,
          speed,
          trace,
          result,
          cursor,
        }),
      );
    }
    catch {
      window.setTimeout(() => {
        setNotice('本机存储空间不足，本次更改暂时无法自动保存。');
      }, 0);
    }
  }, [hosts, queue, strategy, speed, trace, result, cursor, hydrated]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const atEnd = cursor >= trace.length - 1;
    const timer = window.setTimeout(
      () => {
        if (atEnd) {
          setIsPlaying(false);
        }
        else {
          setCursor(current => Math.min(current + 1, trace.length - 1));
        }
      },
      atEnd ? 0 : 1100 / speed,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [isPlaying, cursor, trace.length, speed]);

  const resetRun = () => {
    setTrace([]);
    setResult(null);
    setCursor(-1);
    setIsPlaying(false);
  };

  const invalidateRun = () => {
    resetRun();
    setNotice('配置已更新，请重新运行模拟。');
  };

  const currentStep = cursor >= 0 ? trace[cursor] : undefined;
  const visibleHostStates = useMemo<HostState[]>(
    () =>
      currentStep?.hostStates
      ?? hosts.map(host => ({ host, used: copyResource(ZERO), vmIds: [] })),
    [currentStep, hosts],
  );
  const currentStrategy = STRATEGIES.find(item => item.id === strategy) ?? STRATEGIES[0];
  const complete = trace.length > 0 && cursor === trace.length - 1;

  const startSimulation = (autoPlay = false) => {
    if (hosts.length === 0) {
      setNotice('请先添加至少一台物理机。');
      return;
    }
    if (queue.length === 0) {
      setNotice('请先向队列添加至少一台 VM。');
      return;
    }
    const simulation = simulate(hosts, queue, strategy);
    setTrace(simulation.trace);
    setResult(simulation.result);
    setCursor(0);
    setIsPlaying(autoPlay);
    setNotice(
      autoPlay ? '模拟已开始自动播放。' : '模拟已就绪，请逐步查看决策。 ',
    );
  };

  const handlePlay = () => {
    if (trace.length === 0) {
      startSimulation(true);
      return;
    }
    if (cursor >= trace.length - 1) {
      setCursor(0);
    }
    setIsPlaying(true);
  };

  const submitHost = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid
      = hostDraft.name.trim()
        && [hostDraft.cpu, hostDraft.memory, hostDraft.disk].every(
          value => Number.isFinite(value) && value > 0,
        );
    if (!valid) {
      setNotice('物理机名称与三项资源都必须是有效的正数。');
      return;
    }
    if (editingHostId) {
      setHosts(current =>
        current.map(host =>
          host.id === editingHostId
            ? {
              ...host,
              name: hostDraft.name.trim(),
              capacity: {
                cpu: hostDraft.cpu,
                memory: hostDraft.memory,
                disk: hostDraft.disk,
              },
            }
            : host,
        ),
      );
    }
    else {
      setHosts(current => [
        ...current,
        {
          id: makeId('host'),
          name: hostDraft.name.trim(),
          capacity: {
            cpu: hostDraft.cpu,
            memory: hostDraft.memory,
            disk: hostDraft.disk,
          },
        },
      ]);
    }
    setEditingHostId(null);
    setHostDraft({ name: '', cpu: 16, memory: 64, disk: 512 });
    invalidateRun();
  };

  const editHost = (host: PhysicalHost) => {
    setEditingHostId(host.id);
    setHostDraft({
      name: host.name,
      cpu: host.capacity.cpu,
      memory: host.capacity.memory,
      disk: host.capacity.disk,
    });
  };

  const duplicateHost = (host: PhysicalHost) => {
    setHosts(current => [
      ...current,
      {
        ...host,
        id: makeId('host'),
        name: `${host.name} 副本`,
        capacity: copyResource(host.capacity),
      },
    ]);
    invalidateRun();
  };

  const removeHost = (id: string) => {
    setHosts(current => current.filter(host => host.id !== id));
    if (editingHostId === id) {
      setEditingHostId(null);
    }
    invalidateRun();
  };

  const chooseTemplate = (key: string) => {
    const template = VM_TEMPLATES.find(item => item.key === key);
    if (!template) {
      return;
    }
    setSelectedTemplate(key);
    setVmDraft(current => ({
      ...current,
      name: template.provider === 'custom' ? 'custom-workload' : template.sku,
      ...template.demand,
    }));
  };

  const customizeVm = (field: 'cpu' | 'memory' | 'disk', value: number) => {
    setSelectedTemplate('custom');
    setVmDraft(current => ({ ...current, [field]: value }));
  };

  const addVm = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = [
      vmDraft.cpu,
      vmDraft.memory,
      vmDraft.disk,
      vmDraft.quantity,
    ];
    if (
      !vmDraft.name.trim()
      || values.some(value => !Number.isFinite(value) || value <= 0)
    ) {
      setNotice('VM 名称、数量与三项资源都必须是有效的正数。');
      return;
    }
    const template
      = VM_TEMPLATES.find(item => item.key === selectedTemplate)
        ?? VM_TEMPLATES[VM_TEMPLATES.length - 1];
    const quantity = Math.min(20, Math.floor(vmDraft.quantity));
    const additions: VMRequest[] = Array.from(
      { length: quantity },
      (_, index) => ({
        id: makeId(`vm-${index}`),
        name:
          quantity > 1
            ? `${vmDraft.name.trim()}-${index + 1}`
            : vmDraft.name.trim(),
        sku: selectedTemplate === 'custom' ? '自定义' : template.sku,
        provider: selectedTemplate === 'custom' ? 'custom' : template.provider,
        demand: {
          cpu: vmDraft.cpu,
          memory: vmDraft.memory,
          disk: vmDraft.disk,
        },
      }),
    );
    setQueue(current => [...current, ...additions]);
    invalidateRun();
  };

  const moveVm = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= queue.length) {
      return;
    }
    setQueue((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    invalidateRun();
  };

  const removeVm = (id: string) => {
    setQueue(current => current.filter(vm => vm.id !== id));
    invalidateRun();
  };

  const restoreExample = () => {
    if (
      !window.confirm(
        '恢复示例会替换当前物理机、VM 队列和最近模拟结果。确定继续吗？',
      )
    ) {
      return;
    }
    setHosts(
      DEFAULT_HOSTS.map(host => ({
        ...host,
        capacity: copyResource(host.capacity),
      })),
    );
    setQueue(
      DEFAULT_QUEUE.map(vm => ({ ...vm, demand: copyResource(vm.demand) })),
    );
    setStrategy('azure-compact');
    setSpeed(1);
    resetRun();
    setNotice('已恢复混合工作负载示例。');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand-row">
              <strong>CloudBin Lab</strong>
              <span className="version-pill">教学模拟器</span>
            </div>
            <p>把每一次调度判断，变成看得见的资源决策。</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="save-status">
            <span className="save-dot" />
            {' '}
            本机自动保存
          </span>
          <button className="ghost-button" onClick={restoreExample}>
            恢复示例
          </button>
          <button
            className="primary-button header-run"
            onClick={() => {
              startSimulation(false);
            }}
          >
            开始模拟
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <section className="intro-strip">
        <div>
          <span className="section-kicker">VM BIN PACKING PLAYGROUND</span>
          <h1>
            云资源装箱，
            <em>一步一步看懂。</em>
          </h1>
        </div>
        <p>
          构建物理机池，排列 VM
          请求，然后观察策略如何过滤候选、计算评分并提交每一次分配。
        </p>
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>●</span>
          {notice}
          <button
            aria-label="关闭提示"
            onClick={() => {
              setNotice('');
            }}
          >
            ×
          </button>
        </div>
      )}

      <section className="workbench" aria-label="VM 装箱实验台">
        <aside className="panel config-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-index">01</span>
              <h2>实验配置</h2>
            </div>
            <span className="count-badge">
              {hosts.length}
              {' '}
              主机 ·
              {queue.length}
              {' '}
              VM
            </span>
          </div>

          <div className="config-section">
            <div className="section-title-row">
              <h3>物理机池</h3>
              <span>
                {hosts.length}
                {' '}
                台
              </span>
            </div>
            <div className="host-list compact-list">
              {hosts.map((host, index) => (
                <article className="mini-host" key={host.id}>
                  <div className="mini-host-index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="mini-host-main">
                    <strong>{host.name}</strong>
                    <span>
                      {host.capacity.cpu}
                      C ·
                      {host.capacity.memory}
                      G ·
                      {' '}
                      {host.capacity.disk}
                      G
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      aria-label={`编辑 ${host.name}`}
                      onClick={() => {
                        editHost(host);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      aria-label={`复制 ${host.name}`}
                      onClick={() => {
                        duplicateHost(host);
                      }}
                    >
                      复制
                    </button>
                    <button
                      className="danger-action"
                      aria-label={`删除 ${host.name}`}
                      onClick={() => {
                        removeHost(host.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
              {hosts.length === 0 && (
                <div className="empty-small">还没有物理机，请在下方添加。</div>
              )}
            </div>

            <form className="inline-form" onSubmit={submitHost}>
              <div className="form-caption">
                {editingHostId ? '编辑物理机' : '添加物理机'}
              </div>
              <label className="wide-field">
                <span>名称</span>
                <input
                  value={hostDraft.name}
                  placeholder="例如：计算节点 D"
                  onChange={(event) => {
                    setHostDraft({
                      ...hostDraft,
                      name: event.target.value,
                    });
                  }}
                />
              </label>
              <div className="resource-inputs">
                <label>
                  <span>vCPU</span>
                  <input
                    type="number"
                    min="1"
                    value={hostDraft.cpu}
                    onChange={(event) => {
                      setHostDraft({
                        ...hostDraft,
                        cpu: Number(event.target.value),
                      });
                    }}
                  />
                </label>
                <label>
                  <span>内存 GiB</span>
                  <input
                    type="number"
                    min="1"
                    value={hostDraft.memory}
                    onChange={(event) => {
                      setHostDraft({
                        ...hostDraft,
                        memory: Number(event.target.value),
                      });
                    }}
                  />
                </label>
                <label>
                  <span>本地盘 GiB</span>
                  <input
                    type="number"
                    min="1"
                    value={hostDraft.disk}
                    onChange={(event) => {
                      setHostDraft({
                        ...hostDraft,
                        disk: Number(event.target.value),
                      });
                    }}
                  />
                </label>
              </div>
              <div className="form-actions">
                {editingHostId && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setEditingHostId(null);
                      setHostDraft({
                        name: '',
                        cpu: 16,
                        memory: 64,
                        disk: 512,
                      });
                    }}
                  >
                    取消
                  </button>
                )}
                <button className="secondary-button" type="submit">
                  {editingHostId ? '保存修改' : '+ 添加物理机'}
                </button>
              </div>
            </form>
          </div>

          <div className="config-section vm-section">
            <div className="section-title-row">
              <h3>VM 请求队列</h3>
              <span>按此顺序分配</span>
            </div>
            <div className="queue-list">
              {queue.map((vm, index) => (
                <article
                  className={`queue-item ${currentStep?.vm.id === vm.id ? 'is-current' : ''}`}
                  key={vm.id}
                >
                  <div className="queue-order">{index + 1}</div>
                  <div className={`provider-chip ${vm.provider}`}>
                    {providerLabel(vm.provider)}
                  </div>
                  <div className="queue-main">
                    <strong>{vm.name}</strong>
                    <span>
                      {vm.sku}
                      {' '}
                      ·
                      {vm.demand.cpu}
                      C/
                      {vm.demand.memory}
                      G/
                      {vm.demand.disk}
                      G
                    </span>
                  </div>
                  <div className="queue-actions">
                    <button
                      disabled={index === 0}
                      aria-label={`上移 ${vm.name}`}
                      onClick={() => {
                        moveVm(index, -1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      disabled={index === queue.length - 1}
                      aria-label={`下移 ${vm.name}`}
                      onClick={() => {
                        moveVm(index, 1);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      aria-label={`删除 ${vm.name}`}
                      onClick={() => {
                        removeVm(vm.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
              {queue.length === 0 && (
                <div className="empty-small">
                  队列为空，请添加一个 VM 请求。
                </div>
              )}
            </div>

            <form className="inline-form vm-form" onSubmit={addVm}>
              <div className="form-caption">添加 VM 请求</div>
              <label className="wide-field">
                <span>规格模板</span>
                <select
                  value={selectedTemplate}
                  onChange={(event) => {
                    chooseTemplate(event.target.value);
                  }}
                >
                  {VM_TEMPLATES.map(template => (
                    <option value={template.key} key={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide-field">
                <span>工作负载名称</span>
                <input
                  value={vmDraft.name}
                  onChange={(event) => {
                    setVmDraft({
                      ...vmDraft,
                      name: event.target.value,
                    });
                  }}
                />
              </label>
              <div className="resource-inputs four-fields">
                <label>
                  <span>vCPU</span>
                  <input
                    type="number"
                    min="1"
                    value={vmDraft.cpu}
                    onChange={(event) => {
                      customizeVm('cpu', Number(event.target.value));
                    }}
                  />
                </label>
                <label>
                  <span>内存</span>
                  <input
                    type="number"
                    min="1"
                    value={vmDraft.memory}
                    onChange={(event) => {
                      customizeVm('memory', Number(event.target.value));
                    }}
                  />
                </label>
                <label>
                  <span>本地盘</span>
                  <input
                    type="number"
                    min="1"
                    value={vmDraft.disk}
                    onChange={(event) => {
                      customizeVm('disk', Number(event.target.value));
                    }}
                  />
                </label>
                <label>
                  <span>数量</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={vmDraft.quantity}
                    onChange={(event) => {
                      setVmDraft({
                        ...vmDraft,
                        quantity: Number(event.target.value),
                      });
                    }}
                  />
                </label>
              </div>
              <button className="secondary-button full-button" type="submit">
                + 加入请求队列
              </button>
              <p className="form-note">
                CPU / 内存来自厂商规格；64 GiB 本地盘为可编辑的模拟值。
              </p>
            </form>
          </div>
        </aside>

        <section className="panel stage-panel">
          <div className="panel-heading stage-heading">
            <div>
              <span className="panel-index">02</span>
              <h2>装箱视图</h2>
            </div>
            <span
              className={`run-state ${isPlaying ? 'running' : complete ? 'complete' : ''}`}
            >
              <span />
              {isPlaying
                ? '运行中'
                : complete
                  ? '已完成'
                  : trace.length
                    ? '已暂停'
                    : '待运行'}
            </span>
          </div>

          <div className="strategy-bar">
            <label>
              <span>当前装箱策略</span>
              <select
                value={strategy}
                onChange={(event) => {
                  setStrategy(event.target.value as PlacementStrategy);
                  invalidateRun();
                }}
              >
                {STRATEGIES.map(item => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                    {' '}
                    —
                    {item.eyebrow}
                  </option>
                ))}
              </select>
            </label>
            <div className="strategy-formula">
              <span>ƒ</span>
              <p>
                <strong>{currentStrategy.eyebrow}</strong>
                {currentStrategy.formula}
              </p>
            </div>
          </div>

          <div className="metric-strip">
            <Metric
              label="已处理"
              value={
                currentStep
                  ? `${currentStep.vmIndex + (currentStep.phase === 'commit' || currentStep.phase === 'reject' ? 1 : 0)}/${queue.length}`
                  : `0/${queue.length}`
              }
            />
            <Metric
              label="活跃主机"
              value={`${visibleHostStates.filter(state => state.vmIds.length > 0).length}/${hosts.length}`}
            />
            <Metric
              label="当前步骤"
              value={trace.length ? `${cursor + 1}/${trace.length}` : '—'}
            />
          </div>

          <div className="rack-grid">
            {visibleHostStates.map((state, index) => {
              const candidate = currentStep?.candidates.find(
                item => item.hostId === state.host.id,
              );
              const selected = currentStep?.selectedHostId === state.host.id;
              return (
                <article
                  className={`rack-card ${selected ? 'is-selected' : ''} ${candidate && !candidate.feasible ? 'is-rejected' : ''}`}
                  key={state.host.id}
                >
                  <div className="rack-topline">
                    <span className="rack-number">
                      HOST
                      {' '}
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {selected && (
                      <span className="selected-label">✓ 当前选择</span>
                    )}
                    {candidate && !candidate.feasible && (
                      <span className="rejected-label">不满足约束</span>
                    )}
                  </div>
                  <div className="rack-title">
                    <div className="server-icon" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div>
                      <h3>{state.host.name}</h3>
                      <p>
                        {state.vmIds.length}
                        {' '}
                        个 VM 实例
                      </p>
                    </div>
                  </div>
                  <ResourceBar
                    label="CPU"
                    used={state.used.cpu}
                    total={state.host.capacity.cpu}
                    unit="vCPU"
                    tone="blue"
                  />
                  <ResourceBar
                    label="内存"
                    used={state.used.memory}
                    total={state.host.capacity.memory}
                    unit="GiB"
                    tone="green"
                  />
                  <ResourceBar
                    label="本地盘"
                    used={state.used.disk}
                    total={state.host.capacity.disk}
                    unit="GiB"
                    tone="amber"
                  />
                  <div className="vm-bin">
                    {state.vmIds.map((vmId) => {
                      const vm = queue.find(item => item.id === vmId);
                      return vm
                        ? (
                          <div
                            className={`vm-token ${vm.provider} ${currentStep?.vm.id === vm.id ? 'current-token' : ''}`}
                            key={vm.id}
                          >
                            <span>{providerLabel(vm.provider)}</span>
                            <strong>{vm.name}</strong>
                            <small>
                              {vm.demand.cpu}
                              C ·
                              {vm.demand.memory}
                              G ·
                              {' '}
                              {vm.demand.disk}
                              G
                            </small>
                          </div>
                        )
                        : null;
                    })}
                    {state.vmIds.length === 0 && (
                      <div className="empty-bin">
                        <span>+</span>
                        {' '}
                        等待 VM 分配
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {visibleHostStates.length === 0 && (
              <div className="empty-stage">
                <span>＋</span>
                <h3>先添加一台物理机</h3>
                <p>资源容量会在这里以装箱卡片展示。</p>
              </div>
            )}
          </div>

          {complete && result && (
            <section className="result-summary">
              <div className="result-heading">
                <span>模拟完成</span>
                <h3>当前策略结果</h3>
                <p>
                  {result.metrics.success}
                  {' '}
                  台成功，
                  {result.metrics.failed}
                  {' '}
                  台失败
                </p>
              </div>
              <div className="result-grid">
                <Metric
                  label="启用主机"
                  value={`${result.metrics.activeHosts}`}
                />
                <Metric
                  label="CPU 利用率"
                  value={percent(result.metrics.cpuUtilization)}
                />
                <Metric
                  label="内存利用率"
                  value={percent(result.metrics.memoryUtilization)}
                />
                <Metric
                  label="磁盘利用率"
                  value={percent(result.metrics.diskUtilization)}
                />
                <Metric
                  label="活跃机平均碎片"
                  value={percent(result.metrics.fragmentation)}
                />
              </div>
            </section>
          )}

          <div className="playback-bar">
            <button
              className="icon-button"
              disabled={cursor <= 0}
              aria-label="上一步"
              onClick={() => {
                setIsPlaying(false);
                setCursor(value => Math.max(0, value - 1));
              }}
            >
              ←
            </button>
            {isPlaying
              ? (
                <button
                  className="play-button"
                  onClick={() => {
                    setIsPlaying(false);
                  }}
                >
                  <span>Ⅱ</span>
                  {' '}
                  暂停
                </button>
              )
              : (
                <button className="play-button" onClick={handlePlay}>
                  <span>▶</span>
                  {' '}
                  自动播放
                </button>
              )}
            <button
              className="icon-button"
              disabled={trace.length === 0 || cursor >= trace.length - 1}
              aria-label="下一步"
              onClick={() => {
                setIsPlaying(false);
                setCursor(value => Math.min(trace.length - 1, value + 1));
              }}
            >
              →
            </button>
            <div className="speed-control" aria-label="播放速度">
              {[0.5, 1, 2].map(value => (
                <button
                  className={speed === value ? 'active' : ''}
                  onClick={() => {
                    setSpeed(value);
                  }}
                  key={value}
                >
                  {value}
                  ×
                </button>
              ))}
            </div>
            <button className="reset-button" onClick={resetRun}>
              重置回放
            </button>
          </div>
        </section>

        <aside className="panel decision-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-index">03</span>
              <h2>决策详情</h2>
            </div>
            {currentStep && (
              <span className={`phase-badge ${currentStep.phase}`}>
                {PHASE_LABELS[currentStep.phase]}
              </span>
            )}
          </div>

          {!currentStep
            ? (
              <div className="decision-empty">
                <div className="decision-orbit" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                </div>
                <h3>准备观察调度器</h3>
                <p>
                  点击“开始模拟”生成完整决策轨迹，再逐步查看每台 VM
                  如何找到目标主机。
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    startSimulation(false);
                  }}
                >
                  开始模拟
                </button>
              </div>
            )
            : (
              <div className="decision-content" aria-live="polite">
                <div className="step-progress">
                  <span
                    style={{ width: `${((cursor + 1) / trace.length) * 100}%` }}
                  />
                </div>
                <div className="step-meta">
                  <span>
                    步骤
                    {cursor + 1}
                    {' '}
                    /
                    {trace.length}
                  </span>
                  <span>
                    VM
                    {currentStep.vmIndex + 1}
                    {' '}
                    /
                    {queue.length}
                  </span>
                </div>
                <div className="decision-title">
                  <span className={`provider-chip ${currentStep.vm.provider}`}>
                    {providerLabel(currentStep.vm.provider)}
                  </span>
                  <div>
                    <small>{currentStep.vm.sku}</small>
                    <h3>{currentStep.title}</h3>
                  </div>
                </div>
                <p className="decision-detail">{currentStep.detail}</p>
                <div className="request-vector">
                  <ResourceDatum label="vCPU" value={currentStep.vm.demand.cpu} />
                  <ResourceDatum
                    label="内存 GiB"
                    value={currentStep.vm.demand.memory}
                  />
                  <ResourceDatum
                    label="本地盘 GiB"
                    value={currentStep.vm.demand.disk}
                  />
                </div>

                {(currentStep.phase === 'score'
                  || currentStep.phase === 'select') && (
                  <div className="formula-box">
                    <span>评分规则</span>
                    <code>{currentStrategy.formula}</code>
                  </div>
                )}

                {currentStep.candidates.length > 0 && (
                  <div className="candidate-list">
                    <div className="candidate-head">
                      <h4>候选主机逐项检查</h4>
                      <span>
                        {
                          currentStep.candidates.filter(
                            candidate => candidate.feasible,
                          ).length
                        }
                        {' '}
                        个可行
                      </span>
                    </div>
                    {currentStep.candidates.map(candidate => (
                      <article
                        className={`candidate-card ${candidate.hostId === currentStep.selectedHostId ? 'winner' : ''} ${!candidate.feasible ? 'failed' : ''}`}
                        key={candidate.hostId}
                      >
                        <div className="candidate-title">
                          <strong>{candidate.hostName}</strong>
                          {candidate.rank
                            && (currentStep.phase === 'score'
                              || currentStep.phase === 'select'
                              || currentStep.phase === 'commit')
                            ? (
                              <span className="rank">
                                #
                                {candidate.rank}
                              </span>
                            )
                            : (
                              <span
                                className={candidate.feasible ? 'pass' : 'fail'}
                              >
                                {candidate.feasible ? '可行' : '淘汰'}
                              </span>
                            )}
                        </div>
                        <div className="constraint-grid">
                          <Constraint
                            label="CPU"
                            remaining={candidate.remainingBefore.cpu}
                            demand={currentStep.vm.demand.cpu}
                            deficit={candidate.deficits.cpu}
                          />
                          <Constraint
                            label="内存"
                            remaining={candidate.remainingBefore.memory}
                            demand={currentStep.vm.demand.memory}
                            deficit={candidate.deficits.memory}
                          />
                          <Constraint
                            label="本地盘"
                            remaining={candidate.remainingBefore.disk}
                            demand={currentStep.vm.demand.disk}
                            deficit={candidate.deficits.disk}
                          />
                        </div>
                        {candidate.feasible
                          && candidate.scoreLabel
                          && (currentStep.phase === 'score'
                            || currentStep.phase === 'select'
                            || currentStep.phase === 'commit') && (
                          <div className="score-line">
                            <span>策略得分</span>
                            <code>{candidate.scoreLabel}</code>
                          </div>
                        )}
                        {!candidate.feasible && (
                          <div className="deficit-line">
                            缺口：
                            {[
                              candidate.deficits.cpu
                                ? `CPU ${candidate.deficits.cpu}`
                                : '',
                              candidate.deficits.memory
                                ? `内存 ${candidate.deficits.memory} GiB`
                                : '',
                              candidate.deficits.disk
                                ? `磁盘 ${candidate.deficits.disk} GiB`
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {currentStep.phase === 'commit' && (
                  <div className="commit-callout">
                    <span>✓</span>
                    <div>
                      <strong>资源账本提交成功</strong>
                      <p>下一步将使用更新后的剩余资源继续计算。</p>
                    </div>
                  </div>
                )}
                {currentStep.phase === 'reject' && (
                  <div className="reject-callout">
                    <span>!</span>
                    <div>
                      <strong>失败已记录</strong>
                      <p>此 VM 不改变任何主机资源，队列将继续推进。</p>
                    </div>
                  </div>
                )}
              </div>
            )}

          <div className="disclaimer">
            <span>i</span>
            <p>
              <strong>关于云厂商风格策略</strong>
              Azure / Google 风格为透明的教学映射，并非其未公开的内部调度实现。
            </p>
          </div>
        </aside>
      </section>

      <footer className="footer">
        <span>CloudBin Lab · 多维资源装箱实验</span>
        <span>CPU / Memory / Local ephemeral disk</span>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResourceDatum({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResourceBar({
  label,
  used,
  total,
  unit,
  tone,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  tone: string;
}) {
  const ratio = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="resource-bar">
      <div className="resource-label">
        <span>{label}</span>
        <strong>
          {used}
          <small>
            {' '}
            /
            {total}
            {' '}
            {unit}
          </small>
        </strong>
      </div>
      <div className={`bar-track ${tone}`}>
        <span style={{ width: `${Math.min(100, ratio)}%` }} />
      </div>
    </div>
  );
}

function Constraint({
  label,
  remaining,
  demand,
  deficit,
}: {
  label: string;
  remaining: number;
  demand: number;
  deficit: number;
}) {
  const pass = deficit === 0;
  return (
    <div className={pass ? 'constraint-pass' : 'constraint-fail'}>
      <span>
        {pass ? '✓' : '×'}
        {' '}
        {label}
      </span>
      <code>
        {remaining}
        {' '}
        ≥
        {demand}
      </code>
    </div>
  );
}
