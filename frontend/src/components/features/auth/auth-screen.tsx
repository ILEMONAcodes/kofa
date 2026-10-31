"use client";
/* eslint-disable @next/next/no-img-element -- Exact exported SVG assets at intrinsic size. */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  localAccessEnabled,
  useLocalAccess,
  type LocalRole,
} from "@/components/access/local-access";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Modal } from "@/components/common/modal";
import { authScreens, safeReturnPath, type AuthScreen } from "./screens";

export function AuthScreenView({
  screen,
  preview = false,
  staff = false,
}: {
  screen: AuthScreen;
  preview?: boolean;
  staff?: boolean;
}) {
  const local = localAccessEnabled && !preview;
  const params = useSearchParams();
  const router = useRouter();
  const access = useLocalAccess();
  const [localRole, setLocalRole] = useState<LocalRole>("staff");
  const returnTo = safeReturnPath(params.get("returnTo"));
  const [notice, setNotice] = useState(false);
  const [policies, setPolicies] = useState(false);
  const data = authScreens[screen];
  const account = screen === "account";
  const formScreen = [
    "login",
    "register",
    "forgot-password",
    "reset-password",
  ].includes(screen);
  const href = (target: AuthScreen) =>
    `${preview ? "/auth-preview/" : "/"}${target}?returnTo=${encodeURIComponent(returnTo)}`;
  const link = (target: AuthScreen, text: string) => (
    <Link className={buttonStyles("subtle")} href={href(target)}>
      {text}
    </Link>
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.namedItem(
      "password",
    ) as HTMLInputElement | null;
    const confirmation = form.elements.namedItem(
      "confirmation",
    ) as HTMLInputElement | null;
    confirmation?.setCustomValidity(
      password?.value !== confirmation.value ? "Passwords must match." : "",
    );
    if (!form.reportValidity()) return;
    if (local && (screen === "login" || screen === "register")) {
      const role = staff ? localRole : "client";
      access.enter(role);
      form.reset();
      const requested = params.get("returnTo");
      router.push(
        requested
          ? safeReturnPath(requested)
          : staff
            ? role === "admin"
              ? "/admin/administration"
              : "/staff/overview"
            : "/account/overview",
      );
      return;
    }
    // No backend authentication or credential persistence.

    form.reset();
    setNotice(true);
  }
  const field = (
    name: string,
    label: string,
    placeholder: string,
    type = "text",
    autoComplete?: string,
  ) => (
    <Input
      key={name}
      name={name}
      label={label}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
      required={!(local && ["phone", "full_name"].includes(name))}
      minLength={
        name === "full_name"
          ? local
            ? undefined
            : 2
          : type === "password" && (local || screen !== "login")
            ? local
              ? 6
              : 10
            : undefined
      }
      maxLength={
        name === "full_name" ? 150 : type === "password" ? 128 : undefined
      }
      pattern={name === "phone" && !local ? "\\+[1-9][0-9]{6,14}" : undefined}
      title={
        name === "phone"
          ? "Use international format, for example +2348012345678"
          : undefined
      }
      onInput={(event) => {
        const input = event.currentTarget;
        input.setCustomValidity(
          !local && name === "full_name" && input.value.trim().length < 2
            ? "Enter at least two characters for your name."
            : "",
        );
        if (name === "password") {
          const confirmation = input.form?.elements.namedItem("confirmation");
          if (confirmation instanceof HTMLInputElement)
            confirmation.setCustomValidity("");
        }
      }}
    />
  );
  const callout = (title: string, text: string) => (
    <div className="auth-callout">
      <p>{title}</p>
      <p>{text}</p>
    </div>
  );
  return (
    <div
      className={`auth-screen${account ? " auth-account" : ""}`}
      data-figma-node={data.node}
    >
      <div className="auth-scroll">
        <header className="auth-header">
          {preview && (
            <span className="auth-design-label">The doorway to your home</span>
          )}
          <Link href={returnTo} aria-label="Back to properties">
            <img src="/assets/mobile-back.svg" width="22" height="22" alt="" />
          </Link>
          <Link href="/" className="mobile-brand" aria-label="Kof’a home">
            <img
              src="/assets/mobile-logo.svg"
              width="104.04"
              height="33.72"
              alt="Kof’a"
            />
          </Link>
          <span className="mobile-brand-spacer" />
          <span className="mobile-city">Abuja</span>
        </header>
        <form
          key={screen}
          id={`auth-${screen}`}
          className="auth-form"
          onSubmit={submit}
        >
          <h1>{staff ? "Your workspace starts here." : data.title}</h1>
          {local && (
            <div className="auth-callout">
              <p>Temporary local access</p>
              <p>
                Use an example email and any password of at least 6 characters.
                Credentials are not saved or sent. Sample records only.
              </p>
            </div>
          )}
          {staff && local && (
            <label className="block">
              Workspace role
              <select
                className="field-control mt-2"
                value={localRole}
                onChange={(e) => setLocalRole(e.target.value as LocalRole)}
              >
                <option value="staff">Staff</option>
                <option value="admin">Administrator · manages staff</option>
              </select>
            </label>
          )}
          <p className="auth-description">{data.description}</p>
          {screen === "register" &&
            field("full_name", "Full name", "Your full name", "text", "name")}
          {["login", "register", "forgot-password"].includes(screen) &&
            field("email", "Email", "you@example.com", "email", "email")}
          {screen === "register" &&
            field("phone", "Phone number", "+234", "tel", "tel")}
          {["login", "register", "reset-password"].includes(screen) &&
            field(
              "password",
              screen === "reset-password" ? "New password" : "Password",
              screen === "login"
                ? "Enter your password"
                : screen === "reset-password"
                  ? "Enter a new password"
                  : "Create a password",
              "password",
              screen === "login" ? "current-password" : "new-password",
            )}
          {["register", "reset-password"].includes(screen) &&
            field(
              "confirmation",
              screen === "register"
                ? "Confirm password"
                : "Confirm new password",
              "Repeat your password",
              "password",
              "new-password",
            )}
          {screen === "login" && (
            <>
              <p className="auth-small">
                Sign in with your email and password.
              </p>
              {link("forgot-password", "Forgot password?")}
              {!staff && link("register", "Create an account")}
            </>
          )}
          {screen === "register" && (
            <>
              <p className="auth-small">
                Use a strong password you don’t use elsewhere.
              </p>
              <div className="auth-consent">
                <input
                  id="auth-consent"
                  name="consent"
                  type="checkbox"
                  required={!local}
                />
                <label htmlFor="auth-consent">
                  {local
                    ? "I understand this uses sample records only."
                    : "I agree to the Terms and Privacy Policy."}
                </label>
              </div>
              <button
                className="auth-text-link"
                type="button"
                onClick={() => setPolicies(true)}
              >
                Read Terms and Privacy Policy
              </button>
              {link("login", "Already have an account? Log in")}
            </>
          )}
          {screen === "verify-email" && (
            <>
              {callout(
                "Check your verification email",
                preview
                  ? "We sent a verification link to ada@example.com. Check your inbox and spam folder."
                  : "Email verification is currently unavailable. No email has been sent.",
              )}
              <Button variant="subtle" onClick={() => setNotice(true)}>
                Resend verification link
              </Button>
              {link("register", "Use a different email")}
            </>
          )}
          {screen === "verified" && (
            <>
              {callout(
                "Email verified",
                "Your email has been verified. You can continue your home search.",
              )}
              {link("account", "Go to my account")}
            </>
          )}
          {screen === "forgot-password" && link("login", "Back to log in")}
          {screen === "reset-link-sent" && (
            <>
              {callout(
                "Check your email",
                "If an account exists for this email, you’ll receive a password-reset link. The link can be used once and expires after one hour.",
              )}
              {link("forgot-password", "Use a different email")}
            </>
          )}
          {screen === "reset-password" &&
            link("forgot-password", "Request a new reset link")}
          {screen === "password-updated" &&
            callout(
              "Password updated",
              "Sign in with your new password. Your previous sessions have been signed out.",
            )}
          {account && (
            <>
              <Link className={buttonStyles()} href={returnTo}>
                Continue property search
              </Link>
              <span className="auth-status">
                {preview ? "Signed in" : "Not signed in"}
              </span>
              <h2>{preview ? "Ada Obi" : "Make yourself at home."}</h2>
              <p className="auth-description">
                {preview
                  ? "ada@example.com"
                  : "Log in to see your account details and next steps."}
              </p>
              {callout(
                "Keep it with Kof’a",
                "Keep all conversations and payments on Kof’a. We will never ask you to pay into a personal account.",
              )}
              <Link className={buttonStyles("primary")} href="/landlord">
                List a property
              </Link>
              {preview ? (
                <>
                  {link("verify-email", "Verify my email")}
                  <Button variant="subtle" onClick={() => setNotice(true)}>
                    Sign out
                  </Button>
                </>
              ) : (
                link("login", "Log in")
              )}
            </>
          )}
          <p className="auth-small">Your account details stay private.</p>
          {!staff && ["login", "register"].includes(screen) && (
            <Link className={buttonStyles("primary")} href="/landlord">
              Want to list a property? Start here
            </Link>
          )}
          {account && (
            <Link
              className={buttonStyles("primary")}
              href={preview ? "/account/overview" : href("register")}
            >
              {preview ? "Open full account" : "Create an account"}
            </Link>
          )}
        </form>
      </div>
      {!account && (
        <div className="auth-actions">
          {formScreen ? (
            <Button type="submit" form={`auth-${screen}`}>
              {data.action}
            </Button>
          ) : screen === "verify-email" ? (
            <Button onClick={() => setNotice(true)}>{data.action}</Button>
          ) : (
            <Link
              className={buttonStyles()}
              href={screen === "verified" ? returnTo : href("login")}
            >
              {data.action}
            </Link>
          )}
          <Link className={buttonStyles("subtle")} href={returnTo}>
            Back to browsing
          </Link>
        </div>
      )}
      <Modal
        open={notice}
        onClose={() => setNotice(false)}
        title="Unable to continue"
      >
        <p>
          Account services are currently unavailable. Your details have not been
          sent or saved. Please try again later.
        </p>
        <Link
          className={buttonStyles("secondary", "mt-5")}
          href="/resources/help"
          onClick={() => setNotice(false)}
        >
          Get help
        </Link>
      </Modal>
      <Modal
        open={policies}
        onClose={() => setPolicies(false)}
        title="Policies are being prepared."
      >
        <p>
          Approved Terms and Privacy Policy versions will be shown here before
          registration becomes available. No legal acceptance is recorded here.
        </p>
      </Modal>
    </div>
  );
}
