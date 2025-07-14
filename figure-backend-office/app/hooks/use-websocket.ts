'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  metrics?: any;
  active_jobs?: any[];
  timestamp?: string;
}

export function useWebSocket(url: string, enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('WebSocket 연결 시도:', url);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket 연결됨');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket 메시지 수신:', message);
          
          setLastMessage(message);

          // 메시지 타입에 따라 캐시 업데이트
          if (message.type === 'metrics_update') {
            if (message.metrics) {
              queryClient.setQueryData(['system-metrics'], message.metrics);
            }
            if (message.active_jobs) {
              queryClient.setQueryData(['admin-jobs'], message.active_jobs);
            }
          }
        } catch (err) {
          console.error('WebSocket 메시지 파싱 오류:', err);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
        setIsConnected(false);

        // 자동 재연결 시도
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`${delay}ms 후 WebSocket 재연결 시도...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('WebSocket 재연결 실패: 최대 시도 횟수 초과');
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket 오류:', event);
        setError('WebSocket 연결 오류');
      };

    } catch (err) {
      console.error('WebSocket 연결 실패:', err);
      setError('WebSocket 연결 실패');
    }
  }, [url, enabled, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket이 연결되지 않음');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage,
  };
} 