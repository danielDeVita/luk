'use client';

import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Bell, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConnectionStatus } from '@/lib/apollo-provider';

const GET_NOTIFICATIONS = gql`
  query MyNotifications {
    myNotifications {
      id
      type
      title
      message
      read
      createdAt
    }
  }
`;

const MARK_READ = gql`
  mutation MarkNotificationRead($id: String!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`;

const MARK_ALL_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

const NOTIFICATION_ADDED = gql`
  subscription NotificationAdded {
    notificationAdded {
      id
      type
      title
      message
      read
      createdAt
    }
  }
`;

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type MyNotificationsData = {
  myNotifications: NotificationItem[];
};

export function NotificationsBell() {
  const { status: connectionStatus, retryConnection } = useConnectionStatus();

  // Use faster polling when WebSocket is disconnected
  const pollInterval = connectionStatus === 'connected' ? 60000 : 15000;

  const { data, refetch } = useQuery<MyNotificationsData>(GET_NOTIFICATIONS, {
    pollInterval,
    fetchPolicy: 'network-only',
  });

  useSubscription(NOTIFICATION_ADDED, {
    onData: () => {
      refetch();
    },
    // Skip subscription if not connected (will use polling fallback)
    skip: connectionStatus === 'error' || connectionStatus === 'disconnected',
  });

  const [markRead] = useMutation(MARK_READ);
  const [markAllRead] = useMutation(MARK_ALL_READ, {
    onCompleted: () => refetch(),
  });

  const notifications = data?.myNotifications || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Connection status indicator
  const isConnected = connectionStatus === 'connected';
  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markRead({ variables: { id } });
    refetch(); // Optimistic update better, but refetch is safe
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Notificaciones</span>
            {/* Connection status indicator */}
            {isConnected && (
              <span title="Tiempo real activo">
                <Wifi className="h-3 w-3 text-green-500" />
              </span>
            )}
            {isDisconnected && (
              <button
                onClick={retryConnection}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                title="Reconectar"
              >
                <WifiOff className="h-3 w-3 text-orange-500" />
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-auto px-2 text-xs">
              Marcar todo leído
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tenés notificaciones
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} className={cn("flex flex-col items-start p-3 cursor-pointer", !n.read && "bg-muted/50")}>
                <div className="flex justify-between w-full gap-2">
                  <span className="font-semibold text-sm">{n.title}</span>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {n.message}
                </p>
                <div className="flex justify-between w-full items-center mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </span>
                  {!n.read && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={(e) => handleMarkRead(n.id, e)}
                    >
                      <Check className="h-3 w-3" />
                      <span className="sr-only">Marcar como leído</span>
                    </Button>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
