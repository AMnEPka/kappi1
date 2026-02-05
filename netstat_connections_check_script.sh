#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo netstat -n"
# Проверяем, что отображаются подключения с указанием IP-адреса или DNS-имени хоста
# В выводе netstat должны быть строки с активными соединениями, содержащие IP-адреса или DNS-имена

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Проверяем, содержит ли вывод информацию о сетевых соединениях
# Ищем строки с IP-адресами (формат: x.x.x.x:port) или DNS-именами (формат: hostname:port)
# В netstat -n всегда выводятся IP-адреса, но могут быть и DNS-имена если флаг -n не использован

# Ищем строки с IP-адресами IPv4 (формат: x.x.x.x:port где x - число от 0 до 255)
# Пример: 192.168.1.1:22 или 10.0.0.1:54321
ipv4_pattern='[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]+'

# Ищем строки с IPv6 адресами (формат: [::1]:port или [2001:db8::1]:port)
ipv6_pattern='\[[0-9a-fA-F:]+:[0-9]+\]'

# Ищем строки с DNS-именами (содержат буквы, не только числа)
# Формат: hostname:port где hostname содержит буквы
# Пример: server.example.com:22 или localhost:54321
dns_pattern='[a-zA-Z][a-zA-Z0-9._-]*:[0-9]+'

# Проверяем наличие соединений с IP-адресами или DNS-именами
# Исключаем заголовки таблицы (строки, содержащие только слова Proto, Recv-Q, Send-Q и т.д.)
# Формат netstat: Proto Recv-Q Send-Q Local Address Foreign Address State
# Строки с соединениями содержат IP-адреса или DNS-имена
connections_with_ip=$(echo "$CHECK_OUTPUT" | grep -E "($ipv4_pattern|$ipv6_pattern|$dns_pattern)" | grep -vE '^[[:space:]]*(Active|Proto|Recv-Q|Send-Q|Local|Foreign|State)[[:space:]]*$' | grep -vE '^[[:space:]]*$' || true)

if [[ -z "$connections_with_ip" ]]; then
    # Не найдено соединений с IP-адресами или DNS-именами
    echo "Не найдены подключения с указанием IP-адреса или DNS-имени хоста"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Проверяем, что найдены реальные соединения (не только заголовки)
# Считаем количество строк с соединениями
connection_count=$(echo "$connections_with_ip" | wc -l)

if [[ $connection_count -eq 0 ]]; then
    echo "Не найдены подключения с указанием IP-адреса или DNS-имени хоста"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Найдены соединения с IP-адресами или DNS-именами
echo "Пройдена"
exit 0
