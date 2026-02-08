import { GenerateRequest, GenerateResponse } from "./types";

const nowIso = () => new Date().toISOString();

export const mockGenerate = (input: GenerateRequest): GenerateResponse => {
  const cardId = `mock-${Date.now()}`;
  return {
    card_id: cardId,
    negative: {
      name: "鎖の思考",
      keywords: ["停滞", "恐れ"],
      interpretation: "考えすぎることで身動きが取れなくなっている状態",
      emotion: "rumination",
      image_prompt:
        "A portrait tarot card illustration, dark mystical atmosphere, hybrid of modern design and ancient mural aesthetics, moonlight illumination, fresco wall texture, subtle metallic ink, symbolic but non-figurative, negative emotion: rumination, card title: \"鎖の思考\" as small glyph-like typography, 2:3 aspect ratio, high detail, cinematic shadows, desaturated palette with deep indigo and charcoal.",
    },
    positive: {
      name: "小さな一歩",
      keywords: ["行動", "流れ"],
      interpretation: "完璧でなくても動くことで状況は変わる",
      theme: "small step",
      image_prompt:
        "A portrait tarot card illustration, soft pale watercolor, hybrid of modern design and ancient mural aesthetics, moonlight glow, fresco wall texture, gentle gradients, symbolic but non-figurative, positive shift: small step, card title: \"小さな一歩\" as small glyph-like typography, 2:3 aspect ratio, airy composition, pastel palette with soft blues and warm ivory.",
    },
    action: {
      title: "紙に3行だけ書く",
      minutes: 10,
      reason: "頭の中の渦を外に出す最小の一歩",
    },
    status: {
      completed: false,
      completed_at: null,
    },
  };
};

export const mockHistory = (): GenerateResponse[] => [];
