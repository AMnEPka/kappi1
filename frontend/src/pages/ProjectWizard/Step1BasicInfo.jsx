import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
import { useWizard } from './WizardContext';

export default function Step1BasicInfo() {
  const { projectData, setProjectData } = useWizard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 1: Основная информация</CardTitle>
        <CardDescription>Введите название и описание проекта</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Название проекта *</Label>
          <Input
            id="name"
            value={projectData.name}
            onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Например: Обновление серверов"
          />
        </div>
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            value={projectData.description}
            onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Опишите цель проекта"
            rows={4}
          />
        </div>
        <div>
          <Label htmlFor="system_input_target">Куда вводится система</Label>
          <SelectNative
            id="system_input_target"
            value={projectData.system_input_target || "ОПЭ"}
            onChange={(e) => setProjectData(prev => ({ ...prev, system_input_target: e.target.value }))}
          >
            <option value="ОПЭ">ОПЭ</option>
            <option value="ПЭ">ПЭ</option>
          </SelectNative>
        </div>
      </CardContent>
    </Card>
  );
}

