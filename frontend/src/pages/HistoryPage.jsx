import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { History, Terminal } from "lucide-react";
import { toast } from "sonner";
import { api } from '../config/api';

export default function HistoryPage() {
  const [executions, setExecutions] = useState([]);
  const [hosts, setHosts] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [executionsRes, hostsRes] = await Promise.all([
        api.get(`/api/executions`),
        api.get(`/api/hosts`)
      ]);
      setExecutions(executionsRes.data);
      
      // Create hosts lookup map
      const hostsMap = {};
      hostsRes.data.forEach(host => {
        hostsMap[host.id] = host;
      });
      setHosts(hostsMap);
    } catch (error) {
      toast.error("Ошибка загрузки истории");
    }
  };

  // Get badge configuration by check status
  const getCheckStatusBadge = (execution) => {
    const status = execution.check_status;
    
    if (status === 'Пройдена') {
      return <Badge className="bg-green-500 hover:bg-green-600">Пройдена</Badge>;
    } else if (status === 'Не пройдена') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Не пройдена</Badge>;
    } else if (status === 'Ошибка' || !execution.success) {
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    } else if (status === 'Оператор') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Оператор</Badge>;
    } else if (execution.success) {
      return <Badge className="bg-green-500 hover:bg-green-600">Успех</Badge>;
    } else {
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    }
  };

  // Group executions by project or by individual script execution
  const groupedExecutions = executions.reduce((acc, execution) => {
    if (execution.project_id) {
      // Group by project
      if (!acc[execution.project_id]) {
        acc[execution.project_id] = {
          type: 'project',
          project_id: execution.project_id,
          executions: [],
          executed_at: execution.executed_at
        };
      }
      acc[execution.project_id].executions.push(execution);
    } else {
      // Individual execution (legacy)
      acc[execution.id] = {
        type: 'single',
        execution: execution
      };
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">История выполнений</h1>
      
      <div className="space-y-4">
        {executions.length === 0 ? (
          <div className="text-center py-16">
            <History className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">История выполнений пуста</p>
            <p className="text-slate-400 text-sm">Выполните проверку для просмотра результатов</p>
          </div>
        ) : (
          Object.values(groupedExecutions).map((group) => {
            if (group.type === 'project') {
              // Project execution display
              const successCount = group.executions.filter(e => e.success).length;
              const totalCount = group.executions.length;
              
              return (
                <Card key={group.project_id} data-testid={`execution-card-${group.project_id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Terminal className="h-5 w-5" />
                          Проект (ID: {group.project_id.substring(0, 8)}...)
                        </CardTitle>
                        <CardDescription>
                          {new Date(group.executed_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      <Badge>
                        {successCount}/{totalCount} успешно
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.executions.map((execution) => {
                        const host = hosts[execution.host_id];
                        return (
                          <div key={execution.id} className="border rounded p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold">{host?.name || execution.host_id}</div>
                                <div className="text-sm text-gray-600">{execution.script_name}</div>
                              </div>
                              {getCheckStatusBadge(execution)}
                            </div>
                            
                            {execution.output && (
                              <div>
                                <Label className="text-xs">Вывод:</Label>
                                <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto mt-1 max-h-40">
                                  {execution.output}
                                </pre>
                              </div>
                            )}
                            
                            {execution.error && (
                              <div className="mt-2">
                                <Label className="text-xs text-red-600">Ошибка:</Label>
                                <pre className="bg-red-50 text-red-800 p-2 rounded text-xs overflow-x-auto mt-1">
                                  {execution.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            } else {
              // Single script execution display (legacy)
              const execution = group.execution;
              const host = hosts[execution.host_id];
              
              return (
                <Card key={execution.id} data-testid={`execution-card-${execution.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Terminal className="h-5 w-5" />
                          {execution.script_name}
                        </CardTitle>
                        <CardDescription>
                          {new Date(execution.executed_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      {getCheckStatusBadge(execution)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded p-3">
                      <div className="font-semibold mb-2">{host?.name || execution.host_id}</div>
                      
                      {execution.output && (
                        <div>
                          <Label className="text-xs">Вывод:</Label>
                          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto mt-1 max-h-40">
                            {execution.output}
                          </pre>
                        </div>
                      )}
                      
                      {execution.error && (
                        <div className="mt-2">
                          <Label className="text-xs text-red-600">Ошибка:</Label>
                          <pre className="bg-red-50 text-red-800 p-2 rounded text-xs overflow-x-auto mt-1">
                            {execution.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })
        )}
      </div>
    </div>
  );
};
// Main Layout
