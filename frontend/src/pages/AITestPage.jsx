import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { api } from '../config/api';

export default function AITestPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("checking");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    checkAIHealth();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkAIHealth = async () => {
    try {
      const response = await api.get('/api/ai/health');
      setAiStatus(response.data.status === "healthy" ? "healthy" : "unhealthy");
    } catch (error) {
      setAiStatus("unavailable");
      console.error("AI health check failed:", error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    
    // Add user message to chat
    const newUserMessage = { role: "user", content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // Prepare messages for API (include all previous messages)
      const apiMessages = [...messages, newUserMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await api.post('/api/ai/chat', {
        messages: apiMessages,
        temperature: temperature,
        max_tokens: maxTokens
      });

      // Add AI response to chat
      const aiMessage = {
        role: "assistant",
        content: response.data.content,
        model: response.data.model,
        usage: response.data.usage
      };
      
      setMessages(prev => [...prev, aiMessage]);
      toast.success("Ответ получен");
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = error.response?.data?.detail || "Ошибка при обращении к AI";
      toast.error(errorMessage);
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Ошибка: ${errorMessage}`,
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.info("История чата очищена");
  };

  const getStatusBadge = () => {
    switch (aiStatus) {
      case "healthy":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Доступен</Badge>;
      case "unhealthy":
        return <Badge className="bg-yellow-500"><XCircle className="w-3 h-3 mr-1" />Нестабилен</Badge>;
      default:
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Недоступен</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="w-8 h-8" />
            Тестирование ИИ-модели
          </h1>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="outline"
              size="sm"
              onClick={checkAIHealth}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Проверить
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Интерактивный интерфейс для проверки взаимодействия с моделью Trinity-Mini-Q4_K_L
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Чат с ИИ</CardTitle>
                {messages.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearChat}>
                    Очистить
                  </Button>
                )}
              </div>
              <CardDescription>
                Отправьте сообщение, чтобы начать диалог с моделью
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Messages */}
              <div className="space-y-4 mb-4 min-h-[400px] max-h-[600px] overflow-y-auto p-4 bg-muted/30 rounded-lg">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                    <Bot className="w-16 h-16 mb-4 opacity-50" />
                    <p>Начните диалог, отправив сообщение</p>
                    <p className="text-sm mt-2">Модель готова к работе</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : msg.error
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-card border border-border"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        {msg.model && (
                          <p className="text-xs opacity-70 mt-2">
                            Модель: {msg.model}
                            {msg.usage && ` • Токенов: ${msg.usage.total_tokens || "N/A"}`}
                          </p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium">Вы</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">ИИ думает...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="space-y-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Введите ваше сообщение..."
                  rows={3}
                  disabled={loading || aiStatus === "unavailable"}
                  className="resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    Нажмите Enter для отправки, Shift+Enter для новой строки
                  </p>
                  <Button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || loading || aiStatus === "unavailable"}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Отправить
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
              <CardDescription>Параметры генерации</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature: {temperature}
                </Label>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Контролирует случайность ответов (0 = детерминировано, 2 = очень случайно)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">
                  Max Tokens: {maxTokens}
                </Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="1"
                  max="2048"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 512)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Максимальная длина ответа в токенах
                </p>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2">Информация</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong>Модель:</strong> Trinity-Mini-Q4_K_L</p>
                  <p><strong>Сервер:</strong> llama.cpp</p>
                  <p><strong>Порт:</strong> 8000</p>
                  <p><strong>Контекст:</strong> 512 токенов</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

