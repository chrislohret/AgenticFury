import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  sendCopilotMessage,
  type SendCopilotRequest,
  type SubmissionCopilotContext,
} from '@/services/copilot-assistant';

export interface CopilotChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function useCopilotAssistant(context: SubmissionCopilotContext) {
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: (input: SendCopilotRequest) => sendCopilotMessage(input),
    onSuccess: (response) => {
      setConversationId(response.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.lastResponse,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Unable to reach Copilot assistant.',
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);

      mutation.mutate({
        message: trimmed,
        context,
        conversationId,
      });
    },
    [context, conversationId, mutation],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    isSending: mutation.isPending,
  };
}
