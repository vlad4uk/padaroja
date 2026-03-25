import { useEffect, useRef, useCallback } from 'react';

export interface SSEMessage {
    type: 'NEW_POST' | 'UPDATE_POST' | 'DELETE_POST';
    data: any;
}

interface UseSSEOptions {
    onNewPost?: (post: any) => void;
    onUpdatePost?: (post: any) => void;
    onDeletePost?: (postId: number) => void;
    userId?: number;
}

export const useSSE = (options: UseSSEOptions) => {
    const eventSourceRef = useRef<EventSource | null>(null);

    const connect = useCallback(() => {
        const url = options.userId 
            ? `/api/posts/stream/user?id=${options.userId}`
            : '/api/posts/stream';

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const eventSource = new EventSource(url, {
            withCredentials: true
        });

        eventSource.onmessage = (event) => {
            try {
                const message: SSEMessage = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'NEW_POST':
                        options.onNewPost?.(message.data);
                        break;
                    case 'UPDATE_POST':
                        options.onUpdatePost?.(message.data);
                        break;
                    case 'DELETE_POST':
                        options.onDeletePost?.(message.data.postId);
                        break;
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = () => {
            console.error('SSE connection error, reconnecting...');
            eventSource.close();
            
            setTimeout(() => {
                connect();
            }, 5000);
        };

        eventSourceRef.current = eventSource;
    }, [options.userId, options.onNewPost, options.onUpdatePost, options.onDeletePost]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [connect]);

    return { connect, disconnect: () => eventSourceRef.current?.close() };
};