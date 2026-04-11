import { ParsedIntent, Intent } from '../types';

export interface ActionResult {
  success: boolean;
  message: string;
}

type ActionHandler = (intent: ParsedIntent) => Promise<ActionResult>;

const handlers: Partial<Record<Intent, ActionHandler>> = {};

export function registerHandler(intent: Intent, handler: ActionHandler): void {
  handlers[intent] = handler;
}

export async function dispatchAction(intent: ParsedIntent): Promise<ActionResult> {
  const handler = handlers[intent.intent];

  if (!handler) {
    return {
      success: false,
      message: 'לא הבנתי את הבקשה',
    };
  }

  try {
    return await handler(intent);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'אירעה שגיאה בלתי צפויה';
    return {
      success: false,
      message: `שגיאה: ${message}`,
    };
  }
}
