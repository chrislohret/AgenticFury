import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCopilotAssistant } from '@/hooks/useCopilotAssistant';
import type { SubmissionCopilotContext } from '@/services/copilot-assistant';

interface CopilotAssistantPanelProps {
  context: SubmissionCopilotContext;
}

export function CopilotAssistantPanel({ context }: CopilotAssistantPanelProps) {
  const [draft, setDraft] = useState('');
  const { messages, sendMessage, clearChat, isSending } = useCopilotAssistant(context);

  const summary = useMemo(
    () => `${context.statusLabel} • ${context.approvalCount} approvers • ${context.approvalHistoryCount} history entries`,
    [context.approvalCount, context.approvalHistoryCount, context.statusLabel],
  );

  return (
    <Card className="bg-sky-50 border-sky-200">
      <CardHeader>
        <CardTitle className="text-base">Copilot Assistant</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sends your prompt with current submission context to the Copilot Studio agent.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{context.title}</Badge>
          <Badge variant="outline">{summary}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-background min-h-40 max-h-64 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask a question about this submission. Example: "Summarize risks and approval blockers."
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">{message.role}</p>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            ))
          )}
        </div>

        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Copilot about this submission..."
          disabled={isSending}
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              sendMessage(draft);
              setDraft('');
            }}
            disabled={isSending || !draft.trim()}
          >
            {isSending ? 'Sending...' : 'Send to Copilot'}
          </Button>
          <Button variant="outline" onClick={clearChat} disabled={isSending || messages.length === 0}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
