export type GenerateRequest = {
  anxiety_text: string;
  user_id: string;
  locale?: string;
};

export type CardSide = {
  name: string;
  keywords: [string, string];
  interpretation: string;
  image_prompt: string;
  image_url?: string;
};

export type NegativeCard = CardSide & {
  emotion: string;
};

export type PositiveCard = CardSide & {
  theme: string;
};

export type ActionPlan = {
  title: string;
  minutes: number;
  reason: string;
  scheduled_date?: string | null;
  checklist_done?: boolean;
  checklist_done_at?: string | null;
  image_url?: string | null;
};

export type CardStatus = {
  completed: boolean;
  completed_at: string | null;
};

export type GenerateResponse = {
  card_id: string;
  negative: NegativeCard;
  positive: PositiveCard;
  action: ActionPlan;
  status: CardStatus;
};

export type CalendarItem = {
  kind: "card" | "task";
  id: string;
  card_id?: string;
  task_id?: string;
  scheduled_date: string;
  action_title: string;
  action_detail?: string;
  anxiety_text?: string;
  checklist_done: boolean;
  image_url?: string | null;
  negative_image_url?: string | null;
  positive_image_url?: string | null;
};

export type CompleteRequest = {
  card_id: string;
  user_id: string;
};

export type HistoryResponse = {
  cards: GenerateResponse[];
};
