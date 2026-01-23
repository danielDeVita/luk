'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { MessageCircle, Send, User, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';
import Image from 'next/image';

// GraphQL queries/mutations
const GET_RAFFLE_QUESTIONS = gql`
  query GetRaffleQuestions($raffleId: String!) {
    raffleQuestions(raffleId: $raffleId) {
      id
      content
      createdAt
      asker {
        id
        nombre
        apellido
        avatarUrl
      }
      answer {
        id
        content
        createdAt
        seller {
          id
          nombre
          apellido
          avatarUrl
        }
      }
    }
  }
`;

const ASK_QUESTION = gql`
  mutation AskQuestion($input: AskQuestionInput!) {
    askQuestion(input: $input) {
      id
      content
      createdAt
      asker {
        id
        nombre
        apellido
        avatarUrl
      }
    }
  }
`;

const ANSWER_QUESTION = gql`
  mutation AnswerQuestion($input: AnswerQuestionInput!) {
    answerQuestion(input: $input) {
      id
      content
      createdAt
      seller {
        id
        nombre
        apellido
        avatarUrl
      }
    }
  }
`;

interface Question {
  id: string;
  content: string;
  createdAt: string;
  asker: {
    id: string;
    nombre: string;
    apellido: string;
    avatarUrl?: string;
  };
  answer?: {
    id: string;
    content: string;
    createdAt: string;
    seller: {
      id: string;
      nombre: string;
      apellido: string;
      avatarUrl?: string;
    };
  };
}

interface RaffleQAProps {
  raffleId: string;
  sellerId: string;
  isRaffleActive: boolean;
}

function UserAvatar({ avatarUrl, nombre }: { avatarUrl?: string; nombre: string }) {
  if (avatarUrl) {
    return (
      <Image
        src={getOptimizedImageUrl(avatarUrl, CLOUDINARY_PRESETS.avatar)}
        alt={nombre}
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
      <User className="w-4 h-4 text-white" />
    </div>
  );
}

export function RaffleQA({ raffleId, sellerId, isRaffleActive }: RaffleQAProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [newQuestion, setNewQuestion] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, loading, refetch } = useQuery<{ raffleQuestions: Question[] }>(GET_RAFFLE_QUESTIONS, {
    variables: { raffleId },
  });

  const [askQuestion, { loading: askingQuestion }] = useMutation(ASK_QUESTION, {
    onCompleted: () => {
      toast.success('Pregunta enviada');
      setNewQuestion('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al enviar pregunta');
    },
  });

  const [answerQuestion, { loading: answeringQuestion }] = useMutation(ANSWER_QUESTION, {
    onCompleted: () => {
      toast.success('Respuesta enviada');
      setAnsweringId(null);
      setAnswerText('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al responder');
    },
  });

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || newQuestion.length < 10) {
      toast.error('La pregunta debe tener al menos 10 caracteres');
      return;
    }
    await askQuestion({
      variables: {
        input: { raffleId, content: newQuestion.trim() },
      },
    });
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!answerText.trim() || answerText.length < 5) {
      toast.error('La respuesta debe tener al menos 5 caracteres');
      return;
    }
    await answerQuestion({
      variables: {
        input: { questionId, content: answerText.trim() },
      },
    });
  };

  const questions: Question[] = data?.raffleQuestions || [];
  const isSeller = user?.id === sellerId;
  const canAsk = isAuthenticated && !isSeller && isRaffleActive;

  return (
    <div className="bg-card backdrop-blur-sm rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">
            Preguntas y Respuestas
          </h3>
          <span className="text-sm text-muted-foreground">({questions.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Question Form (for authenticated non-sellers on active raffles) */}
          {canAsk && (
            <form onSubmit={handleAskQuestion} className="p-4 border-b border-border">
              <div className="flex gap-3">
                <UserAvatar avatarUrl={user?.avatarUrl} nombre={user?.nombre || 'U'} />
                <div className="flex-1">
                  <textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Hacé una pregunta al vendedor..."
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-muted-foreground">
                      {newQuestion.length}/500 caracteres
                    </span>
                    <button
                      type="submit"
                      disabled={askingQuestion || newQuestion.length < 10}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {askingQuestion ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Preguntar
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Not authenticated message */}
          {!isAuthenticated && isRaffleActive && (
            <div className="p-4 border-b border-border text-center text-muted-foreground">
              <a href="/auth/login" className="text-purple-400 hover:underline">
                Iniciá sesión
              </a>
              {' '}para hacer preguntas
            </div>
          )}

          {/* Questions List */}
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay preguntas todavía</p>
                {canAsk && (
                  <p className="text-sm mt-1">¡Sé el primero en preguntar!</p>
                )}
              </div>
            ) : (
              questions.map((question) => (
                <div key={question.id} className="p-4">
                  {/* Question */}
                  <div className="flex gap-3">
                    <UserAvatar
                      avatarUrl={question.asker.avatarUrl}
                      nombre={question.asker.nombre}
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-foreground">
                          {question.asker.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(question.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1">{question.content}</p>
                    </div>
                  </div>

                  {/* Answer */}
                  {question.answer ? (
                    <div className="mt-3 ml-11 pl-4 border-l-2 border-purple-500/30">
                      <div className="flex gap-3">
                        <UserAvatar
                          avatarUrl={question.answer.seller.avatarUrl}
                          nombre={question.answer.seller.nombre}
                        />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-purple-400">
                              {question.answer.seller.nombre}
                            </span>
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                              Vendedor
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(question.answer.createdAt), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1">{question.answer.content}</p>
                        </div>
                      </div>
                    </div>
                  ) : isSeller ? (
                    /* Answer form for seller */
                    answeringId === question.id ? (
                      <div className="mt-3 ml-11">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Escribí tu respuesta..."
                          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          rows={2}
                          maxLength={1000}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAnswerQuestion(question.id)}
                            disabled={answeringQuestion || answerText.length < 5}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            {answeringQuestion ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Responder
                          </button>
                          <button
                            onClick={() => {
                              setAnsweringId(null);
                              setAnswerText('');
                            }}
                            className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAnsweringId(question.id)}
                        className="mt-2 ml-11 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Responder esta pregunta
                      </button>
                    )
                  ) : (
                    <div className="mt-2 ml-11 text-sm text-muted-foreground italic">
                      Esperando respuesta del vendedor...
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
