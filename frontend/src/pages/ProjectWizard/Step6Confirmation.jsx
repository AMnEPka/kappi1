import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWizard } from './WizardContext';

export default function Step6Confirmation() {
  const { projectData, getHostById, getSystemById, scripts } = useWizard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 6: Подтверждение</CardTitle>
        <CardDescription>Проверьте настройки проекта перед созданием</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-2">Название:</h3>
            <p>{projectData.name}</p>
          </div>

          {projectData.description && (
            <div>
              <h3 className="font-bold mb-2">Описание:</h3>
              <p>{projectData.description}</p>
            </div>
          )}

          <div>
            <h3 className="font-bold mb-2">Хосты и задания:</h3>
            <div className="space-y-3">
              {projectData.tasks.map((task) => {
                const host = getHostById(task.host_id);

                return (
                  <div key={task.host_id} className="border rounded p-3">
                    <p className="font-medium text-lg mb-2">{host?.name}</p>
                    
                    {task.systems.map((system, sysIdx) => {
                      const systemInfo = getSystemById(system.system_id);
                      const taskScripts = scripts.filter(s => system.script_ids.includes(s.id));
                      
                      return (
                        <div key={sysIdx} className="ml-4 mb-3 pb-2 border-b last:border-b-0">
                          <p className="text-sm font-semibold text-gray-700">
                            Система: {systemInfo?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Проверки ({taskScripts.length}):
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                            {taskScripts.map(script => (
                              <li key={script.id}>{script.name}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

