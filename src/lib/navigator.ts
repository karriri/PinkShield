/** Deterministic Breast Health Navigator rules. No AI, no scoring, no diagnosis. */
export type YN = "yes" | "no" | null; // null = «Не знаю» / пропущено
export type LastExam = "lt1" | "1to2" | "gt2" | "never" | null;
export type NavAnswers = {
  age: number | null;
  newChange: YN;
  pastExam: YN;
  lastExam: LastExam;
  underFollowUp: YN; // past breast cancer, condition under follow-up, past abnormal result or known high-risk finding
  familyHistory: YN;
  highRisk: YN; // known mutation or told of higher risk
};
export const EMPTY_ANSWERS: NavAnswers = { age: null, newChange: null, pastExam: null, lastExam: null, underFollowUp: null, familyHistory: null, highRisk: null };

export type GuidanceStatement = {
  key: string; text: string; version: number;
  age_min: number | null; age_max: number | null; interval_years: number | null; even_ages_only: boolean | null;
  source: { organization: string; title: string; url: string; country: string; checked_on: string } | null;
};

export type ResultType = "symptom" | "follow_up" | "individual" | "screening" | "insufficient";
export type NavResult = {
  type: ResultType;
  title: string;
  reported: string[];
  guidanceKeys: string[];
  nextStep: string;
  why: string;
  limits: string;
};

const LIMITS = "Это справочная информация, а не медицинское заключение. Приложение не ставит диагноз и не оценивает риск.";

export function navigate(a: NavAnswers, statements: GuidanceStatement[]): NavResult[] {
  const out: NavResult[] = [];
  const screening = statements.find((s) => s.key === "kz-screening");

  if (a.newChange === "yes") out.push({
    type: "symptom",
    title: "Новое изменение лучше показать специалисту",
    reported: ["Вы отметили новое или необычное изменение в груди."],
    guidanceKeys: ["who-symptoms", "who-most-lumps"],
    nextStep: "Запишитесь на очный приём к врачу (терапевту, гинекологу или маммологу) и расскажите об изменении. Не нужно ждать следующего планового скрининга.",
    why: "Скрининг рассчитан на людей без жалоб. Если изменение уже есть, его оценивают отдельно, в любом возрасте.",
    limits: LIMITS + " Приложение не может определить, насколько изменение серьёзно.",
  });

  if (a.underFollowUp === "yes") out.push({
    type: "follow_up",
    title: "Ваш план наблюдения определяет лечащий врач",
    reported: ["Вы отметили, что уже наблюдаетесь по поводу груди, лечились ранее, получали отклонения в результатах или у вас выявлен высокий риск."],
    guidanceKeys: ["followup-own-plan"],
    nextStep: "Придерживайтесь плана, который назначил ваш врач. Если не уверены в сроках, уточните их у него.",
    why: "Обычная программа скрининга рассчитана на людей без такой истории, поэтому общие сроки скрининга к вам могут не подходить.",
    limits: LIMITS,
  });

  if (a.familyHistory === "yes" || a.highRisk === "yes") {
    const reported: string[] = [];
    if (a.familyHistory === "yes") reported.push("У близких родственников был рак груди или яичников.");
    if (a.highRisk === "yes") reported.push("Вам говорили о мутации генов или повышенном риске.");
    out.push({
      type: "individual",
      title: "Может быть уместна индивидуальная оценка",
      reported,
      guidanceKeys: ["nci-family"],
      nextStep: "Расскажите об этом врачу: он решит, нужна ли индивидуальная оценка, другой график обследований или генетическая консультация.",
      why: "Семейная история или известная мутация — повод обсудить план с врачом. Это не означает, что у вас есть или будет заболевание.",
      limits: LIMITS,
    });
  }

  if (a.underFollowUp !== "yes" && a.age !== null && screening) {
    const min = screening.age_min ?? 0, max = screening.age_max ?? 200;
    const inGroup = a.age >= min && a.age <= max;
    const reported = [`Возраст: ${a.age}.`];
    if (a.lastExam === "never" || a.pastExam === "no") reported.push("Маммографию или УЗИ груди вы ещё не проходили.");
    else if (a.lastExam) reported.push(`Последнее обследование: ${LAST_EXAM_LABEL[a.lastExam]}.`);
    let nextStep: string;
    if (inGroup) nextStep = "Вы входите в возрастную группу национального скрининга. Уточните в поликлинике по месту прикрепления, когда вам положен скрининг.";
    else if (a.age < min) nextStep = `Возрастная группа национального скрининга начинается с ${min} лет. Если есть вопросы или жалобы, обсудите их с врачом.`;
    else nextStep = `Вы старше возрастной группы национального скрининга (до ${max} лет). Нужны ли вам обследования, решает врач.`;
    if (a.newChange === "yes") nextStep += " Скрининг не заменяет осмотр по поводу изменения, которое вы заметили.";
    out.push({
      type: "screening",
      title: inGroup ? "Плановый скрининг по программе Казахстана" : "Плановый скрининг: возрастная группа",
      reported,
      guidanceKeys: ["kz-screening", "kz-screening-not-personal"],
      nextStep,
      why: "Сроки взяты из действующих правил Минздрава РК. Конкретную дату приложение не рассчитывает — её подтверждает поликлиника.",
      limits: LIMITS,
    });
  }

  const missing: string[] = [];
  if (a.age === null) missing.push("возраст");
  if (a.newChange === null) missing.push("есть ли новые изменения");
  if (a.underFollowUp === null) missing.push("наблюдаетесь ли вы уже у врача");
  if (a.familyHistory === null) missing.push("семейная история");
  if (out.length === 0 || (a.age === null && a.underFollowUp !== "yes")) out.push({
    type: "insufficient",
    title: "Недостаточно информации для подсказки",
    reported: missing.length ? [`Не указано: ${missing.join(", ")}.`] : [],
    guidanceKeys: ["kz-screening-not-personal"],
    nextStep: "Можно ответить на пропущенные вопросы или обсудить свою ситуацию с врачом.",
    why: "Без этих данных приложение не может подобрать подходящую справочную информацию.",
    limits: LIMITS,
  });
  return out;
}

export const LAST_EXAM_LABEL: Record<Exclude<LastExam, null>, string> = {
  lt1: "меньше года назад", "1to2": "1–2 года назад", gt2: "больше 2 лет назад", never: "не проходила",
};
