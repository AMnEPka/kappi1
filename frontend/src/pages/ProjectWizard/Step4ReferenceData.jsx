import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { useWizard } from './WizardContext';

export default function Step4ReferenceData() {
  const { projectData, setProjectData, scripts, getHostById, getSystemById } = useWizard();

  // Collect all scripts that have reference files
  const scriptsWithReferences = useMemo(() => {
    const result = [];
    projectData.tasks.forEach(task => {
      task.systems.forEach(system => {
        system.script_ids.forEach(scriptId => {
          const script = scripts.find(s => s.id === scriptId);
          if (script?.has_reference_files) {
            result.push({
              taskIndex: projectData.tasks.indexOf(task),
              systemIndex: task.systems.indexOf(system),
              script,
              hostId: task.host_id,
              systemId: system.system_id
            });
          }
        });
      });
    });
    return result;
  }, [projectData.tasks, scripts]);

  // Group scripts by ID
  const groupedScripts = useMemo(() => {
    const groups = new Map();
    
    scriptsWithReferences.forEach(item => {
      if (!groups.has(item.script.id)) {
        groups.set(item.script.id, {
          script: item.script,
          hosts: []
        });
      }
      groups.get(item.script.id).hosts.push({
        hostId: item.hostId,
        systemId: item.systemId,
        taskIndex: item.taskIndex,
        systemIndex: item.systemIndex
      });
    });

    return Array.from(groups.values());
  }, [scriptsWithReferences]);

  if (scriptsWithReferences.length === 0) {
    return null;
  }

  const handleFileUpload = (group, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setProjectData(prev => {
        const newTasks = [...prev.tasks];
        
        group.hosts.forEach(host => {
          const task = newTasks[host.taskIndex];
          const system = task.systems[host.systemIndex];
          
          if (!system.reference_data) {
            system.reference_data = {};
          }
          
          system.reference_data[group.script.id] = content;
        });
        
        return { ...prev, tasks: newTasks };
      });
    };
    reader.readAsText(file);
  };

  const handleTextChange = (group, value) => {
    setProjectData(prev => {
      const newTasks = [...prev.tasks];
      
      group.hosts.forEach(host => {
        const task = newTasks[host.taskIndex];
        const system = task.systems[host.systemIndex];
        
        if (!system.reference_data) {
          system.reference_data = {};
        }
        
        system.reference_data[group.script.id] = value;
      });
      
      return { ...prev, tasks: newTasks };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 4: Эталонные данные</CardTitle>
        <CardDescription>Введите эталонные данные для проверок (общие для всех хостов)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groupedScripts.map((group) => {
            const firstHost = group.hosts[0];
            const currentValue = projectData.tasks[firstHost.taskIndex]
              .systems[firstHost.systemIndex].reference_data?.[group.script.id] || '';

            return (
              <div key={group.script.id} className="border rounded-lg p-4">
                <div className="mb-2">
                  <p className="font-semibold text-lg">{group.script.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Применяется к {group.hosts.length} хосту(ам):</strong>{' '}
                    {group.hosts.map((host, idx) => {
                      const hostObj = projectData.hostsList?.find(h => h.id === host.hostId);
                      return (
                        <span key={host.hostId}>
                          {hostObj?.name || `Хост ${host.hostId}`}
                          {idx < group.hosts.length - 1 ? ', ' : ''}
                        </span>
                      );
                    })}
                  </p>
                </div>
                
                <div className="mb-3">
                  <input
                    type="file"
                    id={`file-upload-${group.script.id}`}
                    accept=".txt,.json,.xml,.csv,.log,.yaml,.yml,.conf,.config,.ini"
                    onChange={(e) => handleFileUpload(group, e)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById(`file-upload-${group.script.id}`).click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Загрузить из файла
                  </Button>
                </div>

                <Textarea
                  placeholder={`Введите эталонные данные для ${group.script.name}...`}
                  value={currentValue}
                  onChange={(e) => handleTextChange(group, e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                
                {group.hosts.length > 1 && (
                  <p className="text-xs text-blue-600 mt-2">
                    ⓘ Эти данные будут применены ко всем {group.hosts.length} хостам
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

