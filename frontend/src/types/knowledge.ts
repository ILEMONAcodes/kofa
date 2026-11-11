export const knowledgeCategories = ["how_it_works", "fees", "verification", "inspections", "policies", "reporting", "contact", "other"] as const;
export interface SupportHours { timezone: "Africa/Lagos"; days: { day: number; open: string; close: string }[] }
export interface SupportSettings { version: number; support_phone: string | null; support_email: string | null; support_hours: SupportHours; assistant_enabled: boolean; assistant_daily_token_budget: number }
export interface PublicConfig { support: { phone: string | null; display_phone: string | null; email: string | null; hours_text: string; timezone: "Africa/Lagos"; is_open_now: boolean }; assistant: { enabled: boolean; disclosure: string } }
export interface PublicHelpArticle { slug: string; title: string; category: typeof knowledgeCategories[number]; language: "en"; published_at: string; body?: string }
export interface StaffHelpArticle { id: string; slug: string; title: string; category: typeof knowledgeCategories[number]; language: "en"; status: "draft" | "published"; version: number; published_at: string | null; created_at: string; updated_at: string; body?: string }
