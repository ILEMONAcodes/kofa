"use client";
/* eslint-disable @next/next/no-img-element -- Exact exported SVG assets at intrinsic size. */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Modal } from "@/components/common/modal";
import { authScreens, safeReturnPath, type AuthScreen } from "./screens";

export function AuthScreenView({
  screen,
  preview = false,
}: {
  screen: AuthScreen;
  preview?: boolean;
}) {
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get("returnTo"));
  const [notice, setNotice] = useState(false);
  const [gallery, setGallery] = useState(false);
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
    // Presentation only: never persist, log or transmit credentials; never create a fake session.
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
      required
      minLength={
        name === "full_name"
          ? 2
          : type === "password" && screen !== "login"
            ? 10
            : undefined
      }
      maxLength={
        name === "full_name" ? 150 : type === "password" ? 128 : undefined
      }
      pattern={name === "phone" ? "\\+[1-9][0-9]{6,14}" : undefined}
      title={
        name === "phone"
          ? "Use international format, for example +2348012345678"
          : undefined
      }
      onInput={(event) => {
        const input = event.currentTarget;
        input.setCustomValidity(
          name === "full_name" && input.value.trim().length < 2
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
            <span className="auth-design-label">
              Design preview · sample content
            </span>
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
        <form key={screen} id={`auth-${screen}`} className="auth-form" onSubmit={submit}>
          <h1>{data.title}</h1>
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
              {link("register", "Create an account")}
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
                  required
                />
                <label htmlFor="auth-consent">
                  I agree to the Terms and Privacy Policy.
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
                  : "Email verification is not connected yet. No verification email has been sent from this preview.",
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
              <Link className={buttonStyles("subtle")} href="/landlord">
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
          {["login", "register"].includes(screen) && (
            <Link className={buttonStyles("subtle")} href="/landlord">
              Want to list a property? Start here
            </Link>
          )}
          {account && (
            <Link
              className={buttonStyles("subtle")}
              href={preview ? "/client-preview/overview" : href("register")}
            >
              {preview ? "Open full account" : "Create an account"}
            </Link>
          )}
          <div className="auth-preview-note">
            <p>
              {preview
                ? "Design preview — sample content only. No account, verification, email delivery or password update is performed."
                : "Authentication is being connected. Please use sample details; nothing is sent or saved."}
            </p>
            <button
              type="button"
              className="auth-text-link"
              onClick={() => setGallery(true)}
            >
              Preview all authentication screens
            </button>
          </div>
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
        title="Authentication is being connected."
      >
        <p>
          No credentials were sent or saved. This action will be available when
          the authentication service is connected.
        </p>
        <Link
          className={buttonStyles("secondary", "mt-5")}
          href={`/auth-preview/${screen === "register" ? "verify-email" : screen === "forgot-password" ? "reset-link-sent" : screen === "reset-password" ? "password-updated" : screen === "verify-email" ? "verified" : "account"}?returnTo=${encodeURIComponent(returnTo)}`}
          onClick={() => setNotice(false)}
        >
          Preview the next design
        </Link>
      </Modal>
      <Modal
        open={gallery}
        onClose={() => setGallery(false)}
        title="Authentication design previews"
      >
        <nav
          aria-label="Authentication previews"
          className="auth-preview-links"
        >
          {Object.entries(authScreens).map(([key, item], index) => (
            <Link
              key={key}
              href={`/auth-preview/${key}?returnTo=${encodeURIComponent(returnTo)}`}
              onClick={() => setGallery(false)}
            >
              {String(index + 1).padStart(2, "0")} — {item.title}
            </Link>
          ))}
        </nav>
      </Modal>
      <Modal
        open={policies}
        onClose={() => setPolicies(false)}
        title="Policies are being prepared."
      >
        <p>
          Approved Terms and Privacy Policy versions will be shown here before
          registration becomes available. No legal acceptance is recorded in
          this preview.
        </p>
      </Modal>
    </div>
  );
}
