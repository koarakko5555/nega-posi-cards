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

export type CompleteRequest = {
  card_id: string;
  user_id: string;
};

export type HistoryResponse = {
  cards: GenerateResponse[];
};
