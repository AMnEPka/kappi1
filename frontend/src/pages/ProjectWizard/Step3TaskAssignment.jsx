import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import { useWizard } from './WizardContext';

export default function Step3TaskAssignment() {
  const { 
    projectData, 
    setProjectData, 
    systems,
    checkGroups,
    getHostById,
    getSystemById,
    getCategoryById,
    getScriptsBySystemId,
    updateSystemCheckTemplate,
    getSystemCheckTemplate
  } = useWizard();

  const [checkSelectionModal, setCheckSelectionModal] = useState({
    open: false,
    hostId: null,
    systemIndex: null,
    systemId: null,
    selectedScriptIds: []
  });

  // Get host from project hostsList
  const getProjectHostById = useCallback((hostId) => {
    return projectData.hostsList?.find(host => host.id === hostId);
  }, [projectData.hostsList]);

  // Task handlers
  const handleAddSystemToHost = useCallback((hostId) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const task = updatedTasks[taskIndex];
      const host = getProjectHostById(hostId);
      
      const availableSystems = systems.filter(sys => {
        const systemOsType = sys.os_type;
        const hostConnectionType = host?.connection_type;
        if (hostConnectionType === 'ssh') return systemOsType === 'linux';
        if (hostConnectionType === 'winrm') return systemOsType === 'windows';
        return true;
      }).filter(sys => !task.systems.some(s => s.system_id === sys.id));
      
      if (availableSystems.length > 0) {
        const firstSystem = availableSystems[0];
        const savedScriptIds = getSystemCheckTemplate(firstSystem.id);
        const availableScripts = getScriptsBySystemId(firstSystem.id);
        const validScriptIds = savedScriptIds.filter(id => 
          availableScripts.some(s => s.id === id)
        );
        
        updatedTasks[taskIndex] = {
          ...task,
          systems: [...task.systems, {
            system_id: firstSystem.id,
            script_ids: validScriptIds
          }]
        };
        
        setProjectData(prev => ({ ...prev, tasks: updatedTasks }));
      }
    }
  }, [projectData.tasks, systems, getProjectHostById, getSystemCheckTemplate, getScriptsBySystemId, setProjectData]);

  const handleRemoveSystemFromHost = useCallback((hostId, systemIndex) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.host_id === hostId
          ? { ...task, systems: task.systems.filter((_, idx) => idx !== systemIndex) }
          : task
      )
    }));
  }, [setProjectData]);

  const handleTaskSystemChange = useCallback((hostId, systemIndex, systemId) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const savedScriptIds = getSystemCheckTemplate(systemId);
      const availableScripts = getScriptsBySystemId(systemId);
      const validScriptIds = savedScriptIds.filter(id => 
        availableScripts.some(s => s.id === id)
      );
      
      updatedTasks[taskIndex].systems[systemIndex] = {
        system_id: systemId,
        script_ids: validScriptIds
      };
      
      setProjectData(prev => ({ ...prev, tasks: updatedTasks }));
    }
  }, [projectData.tasks, getSystemCheckTemplate, getScriptsBySystemId, setProjectData]);

  const applyTemplateToAllHosts = useCallback((systemId, scriptIds) => {
    const updatedTasks = projectData.tasks.map(task => ({
      ...task,
      systems: task.systems.map(system => 
        system.system_id === systemId
          ? { ...system, script_ids: scriptIds }
          : system
      )
    }));
    
    setProjectData(prev => ({ ...prev, tasks: updatedTasks }));
  }, [projectData.tasks, setProjectData]);

  // Modal handlers
  const openCheckSelectionModal = useCallback((hostId, systemIndex, systemId) => {
    const task = projectData.tasks.find(t => t.host_id === hostId);
    if (!task) return;
    
    const currentScriptIds = task.systems[systemIndex]?.script_ids || [];
    setCheckSelectionModal({
      open: true,
      hostId,
      systemIndex,
      systemId,
      selectedScriptIds: [...currentScriptIds]
    });
  }, [projectData.tasks]);

  const closeCheckSelectionModal = useCallback(() => {
    setCheckSelectionModal({
      open: false,
      hostId: null,
      systemIndex: null,
      systemId: null,
      selectedScriptIds: []
    });
  }, []);

  const saveCheckSelection = useCallback(() => {
    const { hostId, systemIndex, selectedScriptIds, systemId } = checkSelectionModal;
    
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      updatedTasks[taskIndex].systems[systemIndex] = {
        ...updatedTasks[taskIndex].systems[systemIndex],
        script_ids: selectedScriptIds
      };
      
      setProjectData(prev => ({ ...prev, tasks: updatedTasks }));
      
      if (systemId) {
        updateSystemCheckTemplate(systemId, selectedScriptIds);
      }
    }
    
    closeCheckSelectionModal();
  }, [checkSelectionModal, projectData.tasks, setProjectData, updateSystemCheckTemplate, closeCheckSelectionModal]);

  const handleModalSelectAll = useCallback((availableScripts) => {
    const allIds = availableScripts.map(s => s.id);
    const isAllSelected = allIds.every(id => checkSelectionModal.selectedScriptIds.includes(id));
    
    setCheckSelectionModal(prev => ({
      ...prev,
      selectedScriptIds: isAllSelected ? [] : allIds
    }));
  }, [checkSelectionModal.selectedScriptIds]);

  const handleModalGroupToggle = useCallback((groupId, availableScripts) => {
    const groupScriptIds = availableScripts
      .filter(s => s.group_ids?.includes(groupId))
      .map(s => s.id);
    
    const isGroupSelected = groupScriptIds.every(id => 
      checkSelectionModal.selectedScriptIds.includes(id)
    );
    
    setCheckSelectionModal(prev => ({
      ...prev,
      selectedScriptIds: isGroupSelected
        ? prev.selectedScriptIds.filter(id => !groupScriptIds.includes(id))
        : [...new Set([...prev.selectedScriptIds, ...groupScriptIds])]
    }));
  }, [checkSelectionModal.selectedScriptIds]);

  const handleModalScriptToggle = useCallback((scriptId) => {
    setCheckSelectionModal(prev => ({
      ...prev,
      selectedScriptIds: prev.selectedScriptIds.includes(scriptId)
        ? prev.selectedScriptIds.filter(id => id !== scriptId)
        : [...prev.selectedScriptIds, scriptId]
    }));
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Шаг 3: Назначение проверок</CardTitle>
          <CardDescription>Для каждого хоста выберите системы и проверки</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {projectData.tasks?.map((task, taskIndex) => {
              const host = getProjectHostById(task.host_id);
              if (!host) return null;

              return (
                <div key={task.host_id} className="border-2 rounded-lg p-4">
                  {/* Host header */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-yellow-900">
                        {taskIndex + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{host.name}</h3>
                        <p className="text-sm text-gray-500">
                          {host.username}@{host.hostname}:{host.port}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        host.connection_type === "ssh" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {host.connection_type === "ssh" ? "Linux" : "Windows"}
                    </Badge>
                  </div>

                  {/* Systems for this host */}
                  {task.systems.map((system, systemIndex) => {
                    const availableScripts = getScriptsBySystemId(system.system_id);
                    const selectedSystem = getSystemById(system.system_id);

                    return (
                      <div key={systemIndex} className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-base font-semibold">
                              Система {systemIndex + 1}
                            </Label>
                            {selectedSystem && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedSystem.name}
                              </Badge>
                            )}
                          </div>
                          {task.systems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSystemFromHost(task.host_id, systemIndex)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="mb-3">
                          <Label className="text-sm font-medium">Выберите систему</Label>
                          <Select
                            value={system.system_id}
                            onValueChange={(value) => handleTaskSystemChange(task.host_id, systemIndex, value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Выберите систему для проверки" />
                            </SelectTrigger>
                            <SelectContent>
                              {systems
                                .filter(sys => {
                                  const hostType = host?.connection_type;
                                  if (hostType === 'ssh') return sys.os_type === 'linux';
                                  if (hostType === 'winrm') return sys.os_type === 'windows';
                                  return true;
                                })
                                .filter(sys => 
                                  !task.systems.some(s => s.system_id === sys.id) || 
                                  sys.id === system.system_id
                                )
                                .map((sys) => {
                                  const category = getCategoryById(sys.category_id);
                                  return (
                                    <SelectItem key={sys.id} value={sys.id}>
                                      <span className="text-sm">{category?.icon}</span>
                                      <span className="ml-2">
                                        {sys.name}
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({sys.os_type === 'windows' ? 'Windows' : 'Linux'})
                                        </span>
                                      </span>
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>

                        {system.system_id && (
                          <div>
                            <Label className="text-sm font-medium">Проверки для системы</Label>
                            {availableScripts.length === 0 ? (
                              <p className="text-gray-500 text-sm mt-2">
                                Нет доступных проверок для выбранной системы
                              </p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCheckSelectionModal(task.host_id, systemIndex, system.system_id)}
                                  className="w-full"
                                >
                                  Выбрать проверки ({system.script_ids.length} выбрано)
                                </Button>
                                {system.script_ids.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {system.script_ids.map(scriptId => {
                                      const script = availableScripts.find(s => s.id === scriptId);
                                      return script ? (
                                        <Badge key={scriptId} variant="secondary" className="text-xs">
                                          {script.name}
                                        </Badge>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            {system.script_ids.length > 0 && (
                              <div className="mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => applyTemplateToAllHosts(system.system_id, system.script_ids)}
                                  className="text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Применить ко всем хостам с "{selectedSystem?.name}"
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add system button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSystemToHost(task.host_id)}
                    className="w-full mt-2"
                    disabled={systems
                      .filter(sys => {
                        const hostType = host?.connection_type;
                        if (hostType === 'ssh') return sys.os_type === 'linux';
                        if (hostType === 'winrm') return sys.os_type === 'windows';
                        return true;
                      })
                      .filter(sys => !task.systems.some(s => s.system_id === sys.id))
                      .length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить ещё систему
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Check Selection Modal */}
      <Dialog open={checkSelectionModal.open} onOpenChange={(open) => !open && closeCheckSelectionModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Выбор проверок</DialogTitle>
            <DialogDescription>
              Выберите проверки для системы. Можно выбрать группы или отдельные проверки.
            </DialogDescription>
          </DialogHeader>

          {checkSelectionModal.systemId && (() => {
            const availableScripts = getScriptsBySystemId(checkSelectionModal.systemId);
            const scriptsByGroup = {};
            const ungroupedScripts = [];

            availableScripts.forEach(script => {
              if (script.group_ids?.length > 0) {
                script.group_ids.forEach(groupId => {
                  if (!scriptsByGroup[groupId]) scriptsByGroup[groupId] = [];
                  scriptsByGroup[groupId].push(script);
                });
              } else {
                ungroupedScripts.push(script);
              }
            });

            Object.keys(scriptsByGroup).forEach(groupId => {
              scriptsByGroup[groupId] = Array.from(
                new Map(scriptsByGroup[groupId].map(s => [s.id, s])).values()
              );
            });

            const allSelected = availableScripts.every(s => 
              checkSelectionModal.selectedScriptIds.includes(s.id)
            );

            return (
              <div className="space-y-4">
                {/* Select All */}
                <div className="flex items-center space-x-2 pb-3 border-b">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => handleModalSelectAll(availableScripts)}
                  />
                  <Label className="font-medium cursor-pointer">
                    Выбрать все проверки ({availableScripts.length})
                  </Label>
                </div>

                {/* Groups */}
                {Object.entries(scriptsByGroup).map(([groupId, groupScripts]) => {
                  const group = checkGroups.find(g => g.id === groupId);
                  if (!group) return null;

                  const groupScriptIds = groupScripts.map(s => s.id);
                  const isGroupSelected = groupScriptIds.every(id => 
                    checkSelectionModal.selectedScriptIds.includes(id)
                  );
                  const isPartiallySelected = groupScriptIds.some(id => 
                    checkSelectionModal.selectedScriptIds.includes(id)
                  ) && !isGroupSelected;

                  return (
                    <div key={groupId} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={isGroupSelected}
                          onCheckedChange={() => handleModalGroupToggle(groupId, availableScripts)}
                          className={isPartiallySelected ? "data-[state=checked]:bg-gray-400" : ""}
                        />
                        <Label className="font-medium cursor-pointer">
                          {group.name} ({groupScripts.length} проверок)
                        </Label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {groupScripts.map(script => (
                          <div key={script.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded">
                            <Checkbox
                              checked={checkSelectionModal.selectedScriptIds.includes(script.id)}
                              onCheckedChange={() => handleModalScriptToggle(script.id)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{script.name}</p>
                              {script.description && (
                                <p className="text-xs text-gray-500">{script.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Ungrouped */}
                {ungroupedScripts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Проверки без группы</Label>
                    <div className="border rounded-lg p-3 space-y-1">
                      {ungroupedScripts.map(script => (
                        <div key={script.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded">
                          <Checkbox
                            checked={checkSelectionModal.selectedScriptIds.includes(script.id)}
                            onCheckedChange={() => handleModalScriptToggle(script.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{script.name}</p>
                            {script.description && (
                              <p className="text-xs text-gray-500">{script.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={closeCheckSelectionModal}>
                    Отмена
                  </Button>
                  <Button onClick={saveCheckSelection}>
                    Сохранить ({checkSelectionModal.selectedScriptIds.length} выбрано)
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

