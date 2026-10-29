export const authScreens = {
  login: {
    node: "29:1187",
    title: "Welcome back.",
    description:
      "Sign in to continue your home search or return to a property you’re interested in.",
    action: "Log in",
  },
  register: {
    node: "47:1232",
    title: "Make your next move.",
    description:
      "Create your Kof’a account to express interest and speak with our team.",
    action: "Create account",
  },
  "verify-email": {
    node: "47:1388",
    title: "Check your inbox.",
    description:
      "Verify your email address to keep your account information up to date.",
    action: "I’ve verified my email",
  },
  verified: {
    node: "47:1508",
    title: "You’re verified.",
    description:
      "Your email address has been confirmed. Let’s find your next place.",
    action: "Continue to properties",
  },
  "forgot-password": {
    node: "47:1625",
    title: "Forgot your password?",
    description:
      "Enter your email and we’ll help you get back into your account.",
    action: "Send reset link",
  },
  "reset-link-sent": {
    node: "47:1742",
    title: "A link is on its way.",
    description: "Check your inbox for instructions to reset your password.",
    action: "Back to log in",
  },
  "reset-password": {
    node: "47:1866",
    title: "Choose a new password.",
    description: "Create a strong password for your Kof’a account.",
    action: "Save new password",
  },
  "password-updated": {
    node: "47:1983",
    title: "You’re back in control.",
    description:
      "Your new password is ready. Sign in to pick up where you left off.",
    action: "Log in",
  },
  account: {
    node: "47:2107",
    title: "Your Kof’a account.",
    description: "Your home search, conversations and next steps start here.",
    action: "Continue property search",
  },
} as const;
export type AuthScreen = keyof typeof authScreens;
export function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/properties";
  try {
    const url = new URL(value, "https://kofa.invalid");
    return url.origin === "https://kofa.invalid"
      ? url.pathname + url.search + url.hash
      : "/properties";
  } catch {
    return "/properties";
  }
}
