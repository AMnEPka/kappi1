import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

const DateTimePicker = ({ value, onChange, required = false, className = "" }) => {
  const [date, setDate] = useState(value ? value.split('T')[0] : '');
  const [time, setTime] = useState(value ? value.split('T')[1] : '00:00');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value) {
      const [datePart, timePart] = value.split('T');
      setDate(datePart);
      setTime(timePart || '00:00');
    }
  }, [value]);

  const handleApply = () => {
    if (date && time) {
      const dateTimeString = `${date}T${time}`;
      onChange(dateTimeString);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    if (value) {
      const [datePart, timePart] = value.split('T');
      setDate(datePart);
      setTime(timePart || '00:00');
    } else {
      setDate('');
      setTime('00:00');
    }
    setIsOpen(false);
  };

  const formatDisplayValue = (dateTimeString) => {
    if (!dateTimeString) return 'Выберите дату и время';
    
    const date = new Date(dateTimeString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-[240px] justify-start text-left font-normal ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value ? formatDisplayValue(value) : 'Дата и время'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="time">Время</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleApply}
              disabled={!date}
              className="flex-1"
            >
              Применить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateTimePicker;