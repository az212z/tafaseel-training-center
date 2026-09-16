export const facilityCategories = [
  { id: "all", title: "جميع الصور" },
  { id: "classrooms", title: "القاعات التدريبية" },
  { id: "welcome", title: "الاستقبال والجلسات" },
  { id: "details", title: "المساحات والتفاصيل" },
] as const;

export type FacilityCategory = (typeof facilityCategories)[number]["id"];
export type FacilityPhoto = {
  id: string;
  title: string;
  description: string;
  alt: string;
  category: Exclude<FacilityCategory, "all">;
  width: number;
  height: number;
};

export const facilityPhotos: FacilityPhoto[] = [
  {
    id: "main-training-room",
    title: "مساحة للتعلّم والمشاركة",
    description: "قاعة بطاولات جماعية وشاشة عرض، بتفاصيل من هوية المركز.",
    alt: "قاعة مركز تفاصيل بطاولات سوداء وكراسٍ زرقاء وشاشة عرض أمامية",
    category: "classrooms",
    width: 1448,
    height: 1086,
  },
  {
    id: "reception",
    title: "أهلًا بك في تفاصيل",
    description: "الاستقبال ومنطقة الجلوس عند مدخل القاعات.",
    alt: "مكتب الاستقبال والجلسات الزرقاء بجانب الممر الداخلي لمركز تفاصيل",
    category: "welcome",
    width: 1448,
    height: 1086,
  },
  {
    id: "daylight-classroom",
    title: "قاعات بإضاءة طبيعية",
    description: "مقاعد تدريبية بجوار الواجهات الزجاجية.",
    alt: "مقاعد تدريبية سوداء بطاولات كتابة داخل قاعة مضاءة بنوافذ واسعة",
    category: "classrooms",
    width: 1448,
    height: 1086,
  },
  {
    id: "workshop-room",
    title: "هوية تحضر في المكان",
    description: "ألوان المركز ونقوشه في إحدى القاعات التدريبية.",
    alt: "قاعة تدريب بطاولات جماعية وكراسٍ زرقاء وجدران تحمل نقوش هوية تفاصيل",
    category: "classrooms",
    width: 1448,
    height: 1086,
  },
  {
    id: "lounge",
    title: "استراحة بين الخطوات",
    description: "جلسات جانبية بتفاصيل هادئة وألوان متناسقة.",
    alt: "جلسة داخل مركز تفاصيل بكراسٍ زرقاء ورمادية وطاولات جانبية ونباتات",
    category: "welcome",
    width: 1448,
    height: 1086,
  },
  {
    id: "small-classroom",
    title: "مساحات تدريب متنوعة",
    description: "قاعة بطاولات فردية وشاشة عرض أمامية.",
    alt: "قاعة في مركز تفاصيل بطاولات بيضاء فردية وشاشة عرض ونقوش على الجدار",
    category: "classrooms",
    width: 1448,
    height: 1086,
  },
  {
    id: "meeting-room",
    title: "مساحة للحوار",
    description: "طاولة مشتركة في غرفة تطل على الواجهة الخارجية.",
    alt: "غرفة داخل مركز تفاصيل بطاولة اجتماعات طويلة وكراسٍ متقابلة بجوار النافذة",
    category: "details",
    width: 1448,
    height: 1086,
  },
  {
    id: "identity-details",
    title: "تفاصيل من المركز",
    description: "لمسات الديكور والنباتات في المساحات الداخلية.",
    alt: "مرآة بإطار ذهبي ونباتات في ممر مركز تفاصيل تنعكس فيها أبواب القاعات",
    category: "details",
    width: 1086,
    height: 1448,
  },
];

export const facilityImage = (id: string, thumbnail = false) =>
  `/images/facility/${id}${thumbnail ? "-thumb" : ""}.webp`;
