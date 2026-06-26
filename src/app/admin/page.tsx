"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Key,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Copy,
  LogOut,
  Globe,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  Languages,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  _count: { logs: number };
}

interface Stats {
  totalKeys: number;
  activeKeys: number;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgResponseTime: number;
}

interface ApiLog {
  id: string;
  inputText: string;
  outputText: string;
  status: string;
  responseTime: number;
  createdAt: string;
  apiKey: { name: string; key: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [logDetailOpen, setLogDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const res = await fetch(url, options);
      if (res.status === 401) {
        router.push("/admin/login");
        return null;
      }
      return res;
    },
    [router]
  );

  const loadStats = useCallback(async () => {
    const res = await fetchWithAuth("/api/admin/stats");
    if (res) setStats(await res.json());
  }, [fetchWithAuth]);

  const loadKeys = useCallback(async () => {
    const res = await fetchWithAuth("/api/admin/keys");
    if (res) setKeys(await res.json());
  }, [fetchWithAuth]);

  const loadLogs = useCallback(
    async (page = 1) => {
      const res = await fetchWithAuth(`/api/admin/logs?page=${page}&limit=15`);
      if (res) {
        const data = await res.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadKeys(), loadLogs()]).finally(() =>
      setLoading(false)
    );
  }, [loadStats, loadKeys, loadLogs]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadKeys(), loadLogs()]);
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetchWithAuth("/api/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res) {
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName("");
      loadKeys();
      loadStats();
      toast.success("API key created successfully");
    }
  };

  const toggleKey = async (id: string, isActive: boolean) => {
    await fetchWithAuth(`/api/admin/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadKeys();
    loadStats();
    toast.success(isActive ? "API key disabled" : "API key enabled");
  };

  const deleteKey = async (id: string, name: string) => {
    await fetchWithAuth(`/api/admin/keys/${id}`, { method: "DELETE" });
    loadKeys();
    loadStats();
    toast.success(`"${name}" deleted`);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-9 w-20" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm">NativeTranslator</h1>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="icon" onClick={refreshAll} disabled={refreshing} />}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </TooltipTrigger>
              <TooltipContent>Refresh data</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Key}
              label="API Keys"
              value={stats.totalKeys}
              sub={`${stats.activeKeys} active`}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon={Activity}
              label="Total Requests"
              value={stats.totalRequests.toLocaleString()}
              sub="all time"
              gradient="from-purple-500 to-pink-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Success Rate"
              value={
                stats.totalRequests > 0
                  ? `${Math.round((stats.successRequests / stats.totalRequests) * 100)}%`
                  : "N/A"
              }
              sub={`${stats.errorRequests} errors`}
              gradient="from-green-500 to-emerald-500"
            />
            <StatCard
              icon={Clock}
              label="Avg Response"
              value={`${stats.avgResponseTime}ms`}
              sub="last 100 requests"
              gradient="from-orange-500 to-amber-500"
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="playground" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="playground" className="gap-2">
              <Languages className="h-3.5 w-3.5" />
              Playground
            </TabsTrigger>
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-3.5 w-3.5" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <BarChart3 className="h-3.5 w-3.5" />
              Request Logs
            </TabsTrigger>
          </TabsList>

          {/* Playground Tab */}
          <TabsContent value="playground" className="space-y-4">
            <PlaygroundTab keys={keys} />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">API Keys</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your API keys and control access
                </p>
              </div>
              <Button
                onClick={() => {
                  setCreatedKey("");
                  setCreateDialogOpen(true);
                }}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-4 w-4" />
                Create Key
              </Button>
            </div>

            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Requests</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            {revealedKeys.has(k.id)
                              ? k.key
                              : `${k.key.slice(0, 8)}${"*".repeat(20)}`}
                          </code>
                          <Tooltip>
                            <TooltipTrigger
                              render={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleReveal(k.id)} />}
                            >
                              {revealedKeys.has(k.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </TooltipTrigger>
                            <TooltipContent>{revealedKeys.has(k.id) ? "Hide" : "Reveal"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    navigator.clipboard.writeText(k.key);
                                    toast.success("Copied to clipboard");
                                  }}
                                />
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>Copy key</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={k.isActive}
                            onCheckedChange={() => toggleKey(k.id, k.isActive)}
                          />
                          <Badge variant={k.isActive ? "default" : "secondary"} className={k.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}>
                            {k.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{k._count.logs.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm({ id: k.id, name: k.name })}
                              />
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Delete key</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {keys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>No API keys yet</p>
                        <p className="text-xs">Create one to get started</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Request Logs</h2>
              <p className="text-sm text-muted-foreground">
                Monitor all API translation requests
              </p>
            </div>

            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Time</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="group">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.apiKey.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.inputText}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "success" ? "default" : "destructive"}
                          className={
                            log.status === "success"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : ""
                          }
                        >
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          {log.responseTime}ms
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                          onClick={() => {
                            setSelectedLog(log);
                            setLogDetailOpen(true);
                          }}
                        >
                          <Search className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>No request logs yet</p>
                        <p className="text-xs">Logs will appear when API calls are made</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} requests
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => loadLogs(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-3 text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => loadLogs(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your API key a descriptive name to identify it later.
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-400 font-medium mb-2">
                  API Key created successfully!
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Copy this key now. You can reveal it later, but it&apos;s best to save it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-background p-2.5 rounded border break-all">
                    {createdKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production, Staging, Development"
                onKeyDown={(e) => e.key === "Enter" && createKey()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={createKey}
                  disabled={!newKeyName.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Create Key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This will also delete all associated logs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteKey(deleteConfirm.id, deleteConfirm.name);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Detail Dialog */}
      <Dialog open={logDetailOpen} onOpenChange={setLogDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  {selectedLog.apiKey.name}
                </Badge>
                <Badge
                  className={
                    selectedLog.status === "success"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }
                >
                  {selectedLog.status}
                </Badge>
                <Badge variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  {selectedLog.responseTime}ms
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Input</p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedLog.inputText}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Output</p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedLog.outputText || "—"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaygroundTab({ keys }: { keys: ApiKey[] }) {
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [historyText, setHistoryText] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const activeKeys = keys.filter((k) => k.isActive);
  const selectedKey = keys.find((k) => k.id === selectedKeyId);

  const handleTranslate = async () => {
    if (!selectedKey || !input.trim()) return;
    setLoading(true);
    setOutput("");
    setResponseTime(null);

    const history = showHistory && historyText.trim() ? historyText : undefined;

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": selectedKey.key,
        },
        body: JSON.stringify({ text: input, ...(history && { history }) }),
      });

      const data = await res.json();
      if (res.ok) {
        setOutput(data.translated);
        setResponseTime(data.responseTime);
        toast.success("Translation completed");
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to connect to the API.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Translation Playground</h2>
        <p className="text-sm text-muted-foreground">
          Test the translation API with your existing keys
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6 space-y-5">
          {/* Key selector + response time */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label className="mb-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                API Key
              </Label>
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" className="bg-background">Select an API key...</option>
                {activeKeys.map((k) => (
                  <option key={k.id} value={k.id} className="bg-background">
                    {k.name}
                  </option>
                ))}
              </select>
              {activeKeys.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  No active API keys. Create one in the API Keys tab first.
                </p>
              )}
            </div>
            {responseTime !== null && (
              <Badge variant="outline" className="h-9 px-3 whitespace-nowrap text-green-400 border-green-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {responseTime}ms
              </Badge>
            )}
          </div>

          {/* Conversation History (optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Conversation History (Optional)
              </Label>
              <div className="flex items-center gap-2">
                <Switch checked={showHistory} onCheckedChange={setShowHistory} />
                <span className="text-xs text-muted-foreground">
                  {showHistory ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            {showHistory && (
              <div className="space-y-2">
                <Textarea
                  value={historyText}
                  onChange={(e) => setHistoryText(e.target.value)}
                  placeholder="Paste conversation history here in any format — plain text, HTML, DOM content, chat log, etc."
                  rows={6}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Any format accepted (plain text, HTML, chat log, etc.). Used as context for more accurate translation.
                </p>
              </div>
            )}
          </div>

          {/* Input / Output */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Input Text
              </Label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste or type any text here..."
                rows={10}
                className="resize-none text-base"
              />
              <p className="text-xs text-muted-foreground text-right">
                {input.length} / 5,000
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  Native English
                </Label>
                {output && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(output);
                      toast.success("Copied to clipboard");
                    }}
                    className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                )}
              </div>
              <Textarea
                value={output}
                readOnly
                placeholder="Translated text will appear here..."
                rows={10}
                className="resize-none text-base bg-muted/30"
              />
            </div>
          </div>

          {/* Translate button */}
          <Button
            onClick={handleTranslate}
            disabled={loading || !selectedKeyId || !input.trim()}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                Translate
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* API Reference */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">API Reference</CardTitle>
          <CardDescription>Simple REST API with a single endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Basic (text only)</p>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-muted-foreground">{`curl -X POST /api/translate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"text": "I am want to going store"}'`}</pre>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">With Conversation History (optional)</p>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-muted-foreground">{`curl -X POST /api/translate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "text": "Yeah that thing we talk about yesterday",
    "history": "User: Can we migrate the DB?\\nAssistant: Sure, let me set up PostgreSQL."
  }'`}</pre>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <code className="bg-muted px-1 py-0.5 rounded">history</code> accepts any string format — plain text, HTML, DOM content, chat logs, etc.
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Response</p>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400">{`{
  "original": "I am want to going store",
  "translated": "I want to go to the store",
  "responseTime": 1234
}`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
  gradient: string;
}) {
  return (
    <Card className="border-border/50 overflow-hidden group hover:shadow-lg transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
