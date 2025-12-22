import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Eye } from "lucide-react";

const StatusBadge = ({ status }) => {
  if (status === 'Пройдена') {
    return <Badge className="bg-green-500 hover:bg-green-600">Пройдена</Badge>;
  } else if (status === 'Не пройдена') {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Не пройдена</Badge>;
  } else if (status === 'Оператор') {
    return <Badge className="bg-blue-500 hover:bg-blue-600">Оператор</Badge>;
  }
  return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
};

export default function HostResultsCard({ 
  hostId, 
  executions, 
  hostName, 
  stats,
  formatDate,
  onViewDetails
}) {
  const executionRows = useMemo(() => (
    executions.map((execution) => (
      <div
        key={execution.id}
        className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium">{execution.script_name}</p>
            <p className="text-xs text-gray-500">
              {formatDate(execution.executed_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={execution.check_status} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(execution)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Детали
          </Button>
        </div>
      </div>
    ))
  ), [executions, formatDate, onViewDetails]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{hostName}</CardTitle>
            <CardDescription>
              Всего проверок: {stats.total}
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 flex items-center gap-1" title="Пройдена">
              <CheckCircle className="h-4 w-4" />
              {stats.passed}
            </span>
            <span className="text-yellow-600 flex items-center gap-1" title="Не пройдена">
              <XCircle className="h-4 w-4" />
              {stats.failed}
            </span>
            <span className="text-red-600 flex items-center gap-1" title="Ошибка">
              <XCircle className="h-4 w-4" />
              {stats.error}
            </span>
            <span className="text-blue-600 flex items-center gap-1" title="Оператор">
              <CheckCircle className="h-4 w-4" />
              {stats.operator}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {executionRows}
        </div>
      </CardContent>
    </Card>
  );
}

