export interface SiteProgram {
  slug: string;
  title: string;
  category: string;
  description: string;
  overview: string;
  audience: string;
  prerequisites: string;
  topics: string[];
  outcomes: string[];
  image: string;
  imageAlt: string;
  visible: boolean;
  featured: boolean;
  course_id?: string;
  availability?: null | {
    id: string;
    duration: number;
    price_minor: number | null;
    open: boolean;
  };
}
export interface SiteArticle {
  id: string;
  title: string;
  category: string;
  minutes: number;
  intro: string;
  sections: { title: string; text: string }[];
}
export interface SiteContent {
  revision?: number;
  registration_enabled?: boolean;
  site: Record<string, string>;
  pages: Record<string, { title: string; intro: string; sections: string[][] }>;
  categories: { id: string; title: string; description: string }[];
  programs: SiteProgram[];
  faqs: { q: string; a: string }[];
  articles: SiteArticle[];
  questions: {
    id: string;
    category: string;
    skill: string;
    text: string;
    options: string[];
    correct: number;
    explanation: string;
  }[];
}
