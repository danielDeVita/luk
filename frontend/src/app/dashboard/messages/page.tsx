'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, Send, ArrowLeft, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GET_MY_CONVERSATIONS, GET_CONVERSATION } from '@/lib/graphql/queries';
import { SEND_MESSAGE, MARK_MESSAGE_READ } from '@/lib/graphql/mutations';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConversationPreview {
  id: string;
  raffleId: string;
  isActive: boolean;
  updatedAt: string;
  raffleTitulo: string;
  otherUserName: string;
  lastMessage?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
}

interface ConversationDetail {
  id: string;
  raffleId: string;
  isActive: boolean;
  raffleTitulo: string;
  otherUserName: string;
  messages: Message[];
}

export default function MessagesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversationsData, loading: loadingConversations, refetch: refetchConversations } =
    useQuery<{ myConversations: ConversationPreview[] }>(GET_MY_CONVERSATIONS, {
      skip: !isAuthenticated,
      pollInterval: 10000, // Poll every 10 seconds for new messages
    });

  const { data: conversationData, loading: loadingConversation, refetch: refetchConversation } =
    useQuery<{ conversation: ConversationDetail }>(GET_CONVERSATION, {
      variables: { id: selectedConversationId },
      skip: !selectedConversationId,
      pollInterval: 5000, // Poll every 5 seconds when viewing a conversation
    });

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE, {
    onCompleted: () => {
      setNewMessage('');
      refetchConversation();
      refetchConversations();
    },
    onError: (err) => toast.error(err.message),
  });

  const [markAsRead] = useMutation(MARK_MESSAGE_READ);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationData?.conversation?.messages]);

  // Mark unread messages as read
  useEffect(() => {
    if (conversationData?.conversation?.messages) {
      conversationData.conversation.messages
        .filter((msg) => !msg.isRead && msg.senderId !== user?.id)
        .forEach((msg) => {
          markAsRead({ variables: { messageId: msg.id } });
        });
    }
  }, [conversationData, user?.id, markAsRead]);

  if (!hasHydrated || !isAuthenticated) return null;

  const conversations = conversationsData?.myConversations || [];
  const currentConversation = conversationData?.conversation;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversationId) return;

    sendMessage({
      variables: {
        conversationId: selectedConversationId,
        content: newMessage.trim(),
      },
    });
  };

  const handleBack = () => {
    setSelectedConversationId(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <MessageSquare className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Mensajes</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className={`md:col-span-1 ${selectedConversationId ? 'hidden md:block' : ''}`}>
          <CardHeader>
            <CardTitle>Conversaciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No tenés conversaciones</p>
              </div>
            ) : (
              <ScrollArea className="h-[480px]">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full p-4 text-left hover:bg-muted transition-colors border-b ${
                      selectedConversationId === conv.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{conv.otherUserName}</span>
                          {conv.unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{conv.raffleTitulo}</p>
                        {conv.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {conv.lastMessage}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(conv.updatedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Conversation Detail */}
        <Card className={`md:col-span-2 flex flex-col ${!selectedConversationId ? 'hidden md:flex' : ''}`}>
          {selectedConversationId && currentConversation ? (
            <>
              <CardHeader className="border-b flex flex-row items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {currentConversation.otherUserName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {currentConversation.raffleTitulo}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {loadingConversation ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <ScrollArea className="flex-1 p-4 h-[400px]">
                      <div className="space-y-4">
                        {currentConversation.messages.map((message) => {
                          const isMe = message.senderId === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  isMe
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm">{message.content}</p>
                                <p
                                  className={`text-xs mt-1 ${
                                    isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}
                                >
                                  {formatDistanceToNow(new Date(message.createdAt), {
                                    addSuffix: true,
                                    locale: es,
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    <form
                      onSubmit={handleSendMessage}
                      className="p-4 border-t flex gap-2"
                    >
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        disabled={sending || !currentConversation.isActive}
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                    {!currentConversation.isActive && (
                      <p className="text-center text-sm text-muted-foreground pb-4">
                        Esta conversación está cerrada
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4" />
                <p>Seleccioná una conversación para ver los mensajes</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
