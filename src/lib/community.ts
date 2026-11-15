import { usePersistent, uid } from "./store";

export const CATEGORIES = ["Мой опыт", "Вопрос врачу", "Поддержка", "Диагностика", "Во время лечения", "После лечения"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Comment = { id: string; author: string; text: string; at: number };
export type Post = {
  id: string; author: string; category: Category; text: string; at: number;
  likes: number; liked: boolean; comments: Comment[]; reported: boolean; demo?: boolean;
};

const h = (n: number) => Date.now() - n * 3600_000;

export function seedPosts(): Post[] {
  return [
    { id: uid(), author: "Лилия_Р", category: "Мой опыт", at: h(3), likes: 24, liked: false, reported: false, demo: true,
      text: "Сегодня впервые прошла маммографию. Очень боялась, а всё заняло минут 15. Девочки, не откладывайте — страх намного больше, чем сама процедура.",
      comments: [{ id: uid(), author: "Мира", text: "Спасибо, что поделились! Я как раз записана на следующей неделе.", at: h(2) }] },
    { id: uid(), author: "Тихая_Волна", category: "Вопрос врачу", at: h(8), likes: 11, liked: false, reported: false, demo: true,
      text: "В заключении написали «BI-RADS 3». Как вы готовились к разговору с врачом? Какие вопросы задавали?",
      comments: [{ id: uid(), author: "Анна_К", text: "Я записала вопросы заранее в AI-помощнике и взяла с собой. Очень помогло не растеряться.", at: h(6) }] },
    { id: uid(), author: "Солнце_88", category: "Во время лечения", at: h(26), likes: 47, liked: false, reported: false, demo: true,
      text: "Третий месяц терапии. Хочу сказать всем, кто сейчас в начале пути: бывают тяжёлые дни, но вы не одни. Обнимаю каждую.",
      comments: [] },
    { id: uid(), author: "Вера_Н", category: "После лечения", at: h(50), likes: 63, liked: false, reported: false, demo: true,
      text: "Два года в ремиссии! Продолжаю наблюдение у врача и учусь снова радоваться простым вещам.",
      comments: [{ id: uid(), author: "Лилия_Р", text: "Какая чудесная новость! 💗", at: h(48) }] },
    { id: uid(), author: "Нежность", category: "Поддержка", at: h(70), likes: 19, liked: false, reported: false, demo: true,
      text: "Как вы справляетесь с тревогой в ожидании результатов? Мне помогает гулять и не гуглить симптомы.",
      comments: [] },
  ];
}

export function usePosts() {
  return usePersistent<Post[]>("ps.posts", seedPosts);
}

export function timeAgo(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.round(hrs / 24)} дн назад`;
}
