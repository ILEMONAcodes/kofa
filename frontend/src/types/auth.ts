export type AccountRole = "client" | "staff" | "admin";
export interface AccountUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: AccountRole;
  is_email_verified: boolean;
  created_at: string;
}
export interface AdminAccount extends AccountUser { is_active: boolean; version: number }
export interface Registration {
  full_name: string; email: string; phone: string; password: string;
  accepted_policies: {type: "terms" | "privacy"; version: string}[];
}
export interface CurrentPolicies {
  approved: boolean;
  policies: {type: "terms" | "privacy"; version: string; url: string}[];
}
