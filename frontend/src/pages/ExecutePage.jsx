import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { api } from '../config/api';

export default function ExecutePage() {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [selectedScript, setSelectedScript] = useState("");
  const [selectedHosts, setSelectedHosts] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [scriptsRes, hostsRes] = await Promise.all([
        api.get(`/api/scripts`),
        api.get(`/api/hosts`)
      ]);
      setScripts(scriptsRes.data);
      setHosts(hostsRes.data);
    } catch (error) {
      toast.error("Ошибка загрузки данных");
    }
  };

  const handleExecute = async () => {
    if (!selectedScript || selectedHosts.length === 0) {
      toast.error("Выберите проверку и хосты");
      return;
    }

    setIsExecuting(true);
    try {
      const response = await api.post(`/api/execute`, {
        script_id: selectedScript,
        host_ids: selectedHosts
      });
      
      toast.success(`Выполнено на ${selectedHosts.length} хост(ах)`);
      
      // Navigate to history to see results
      setTimeout(() => {
        navigate('/history');
      }, 1000);
    } catch (error) {
      toast.error("Ошибка выполнения проверки");
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleHost = (hostId) => {
    setSelectedHosts(prev => 
      prev.includes(hostId) 
        ? prev.filter(id => id !== hostId)
        : [...prev, hostId]
    );
  };

  const toggleAll = () => {
    if (selectedHosts.length === hosts.length && hosts.length > 0) {
      setSelectedHosts([]);
    } else {
      setSelectedHosts(hosts.map(h => h.id));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Выполнение проверки</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Выберите проверку</CardTitle>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Нет доступных проверок. Создайте проверку на странице "Проверки".
            </div>
          ) : (
            <>
              <Select value={selectedScript} onValueChange={setSelectedScript}>
                <SelectTrigger data-testid="select-script">
                  <SelectValue placeholder="Выберите проверку..." />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>
                      {script.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedScript && (
                <div className="mt-4">
                  <Label>Содержимое проверки:</Label>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto mt-2">
                    {scripts.find(s => s.id === selectedScript)?.content}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Выберите хосты</CardTitle>
            {hosts.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll} data-testid="toggle-all-hosts">
                {selectedHosts.length === hosts.length ? "Снять все" : "Выбрать все"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hosts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Нет доступных хостов. Добавьте хосты на странице "Хосты".
            </div>
          ) : (
            <div className="space-y-3">
              {hosts.map((host) => (
                <div key={host.id} className="flex items-center space-x-3 p-3 border rounded hover:bg-slate-50">
                  <Checkbox
                    data-testid={`host-checkbox-${host.id}`}
                    checked={selectedHosts.includes(host.id)}
                    onCheckedChange={() => toggleHost(host.id)}
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{host.name}</div>
                    <div className="text-sm text-slate-600">{host.hostname}:{host.port} ({host.os_type})</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          data-testid="execute-btn"
          onClick={handleExecute} 
          disabled={isExecuting || !selectedScript || selectedHosts.length === 0}
          size="lg"
        >
          <Play className="mr-2 h-5 w-5" />
          {isExecuting ? "Выполняется..." : `Выполнить на ${selectedHosts.length} хост(ах)`}
        </Button>
      </div>
    </div>
  );
};
}
