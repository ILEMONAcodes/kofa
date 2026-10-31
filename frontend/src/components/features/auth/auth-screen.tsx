"use client";
/* eslint-disable @next/next/no-img-element -- Exact exported SVG assets at intrinsic size. */
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import {
  useLocalAccess,
} from "@/components/access/local-access";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Modal } from "@/components/common/modal";
import {currentPolicies,requestPasswordReset,confirmPasswordReset,verifyEmail,resendVerification} from "@/lib/auth/client";
import {ApiError} from "@/lib/api/error";
import type {CurrentPolicies} from "@/types/auth";
import { reviewDestination } from "@/lib/review-routing";
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
  const params = useSearchParams();
  const router = useRouter();
  const access = useLocalAccess();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [info,setInfo]=useState("");
  const [policyVersions,setPolicyVersions]=useState<CurrentPolicies|null>(null);
  useEffect(()=>{if(!preview && screen==="register") currentPolicies().then(setPolicyVersions).catch(()=>{});},[preview,screen]);
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
  async function submit(event: FormEvent<HTMLFormElement>) {
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
    if (!preview) {
      setError("");setInfo("");setBusy(true);
      const data=new FormData(form);
      const email=String(data.get("email") ?? "");
      try {
        if(screen==="login" || screen==="register") {
          const policies=screen==="register" ? policyVersions : null;
          if(screen==="register" && !policies) throw new Error("Policy versions could not be loaded. Reload and try again.");
          const registration=policies ? {email,password:password!.value,full_name:String(data.get("full_name") ?? ""),phone:String(data.get("phone") ?? ""),accepted_policies:policies.policies.map(({type,version})=>({type,version}))} : undefined;
          const role=await access.enter(email,password!.value,screen,registration);
          form.reset();
          window.location.replace(reviewDestination(role,params.get("returnTo")));
        } else if(screen==="forgot-password") {
          await requestPasswordReset(email);form.reset();router.push(href("reset-link-sent"));
        } else if(screen==="reset-password") {
          const token=new URLSearchParams(window.location.hash.slice(1)).get("token") ?? params.get("token") ?? "";
          await confirmPasswordReset(token,password!.value);form.reset();window.history.replaceState(null,"",window.location.pathname);router.push(href("password-updated"));
        }
      } catch(issue) {
        setError(issue instanceof ApiError && issue.status>=500 ? `Account services are unavailable. Please try again.${issue.requestId ? ` Reference: ${issue.requestId}` : ""}` : issue instanceof Error ? issue.message : "Unable to continue. Please try again.");
        if(issue instanceof ApiError) for(const detail of issue.details) {
          const input=form.elements.namedItem(detail.field);
          if(input instanceof HTMLInputElement) {input.setCustomValidity(detail.message);input.reportValidity();break;}
        }
      } finally {setBusy(false);}
      return;
    }
    // No backend authentication or credential persistence.

    form.reset();
    setNotice(true);
  }
  async function verificationAction(resend:boolean) {
    if(preview) {setNotice(true);return;}
    setError("");setInfo("");setBusy(true);
    try {
      const token=new URLSearchParams(window.location.hash.slice(1)).get("token") ?? params.get("token") ?? "";
      if(resend || !token) {await resendVerification();setInfo("A verification link has been requested. Please check your inbox.");}
      else {await verifyEmail(token);window.history.replaceState(null,"",window.location.pathname);router.push(href("verified"));}
    } catch(issue) {setError(issue instanceof Error ? issue.message : "Unable to verify your email. Please try again.");}
    finally {setBusy(false);}
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
      minLength={name === "full_name" ? 2 : type === "password" ? 8 : undefined}
      maxLength={
        name === "full_name" ? 150 : type === "password" ? 128 : undefined
      }
      pattern={name === "phone" ? "\\+[1-9][0-9]{7,14}" : undefined}
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
          <h1>{data.title}</h1>
          {error && <p role="alert" className="text-danger">{error}</p>}
          {info && <p role="status">{info}</p>}
          {!preview && screen==="register" && policyVersions && <p className="auth-small">{policyVersions.policies.map(policy=>`${policy.type === "terms" ? "Terms" : "Privacy"}: ${policy.version}`).join(" · ")}</p>}
          {!preview && screen==="register" && policyVersions && !policyVersions.approved && <p className="auth-small">Terms and Privacy Policy are draft versions for internal testing.</p>}
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
                Use at least 8 characters and a password you don’t use elsewhere.
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
                  : "Open the verification link in your email, or request a new one below.",
              )}
              <Button variant="subtle" loading={busy} onClick={() => verificationAction(true)}>
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
            <Button type="submit" loading={busy} disabled={!preview && screen==="register" && !policyVersions} form={`auth-${screen}`}>
              {data.action}
            </Button>
          ) : screen === "verify-email" ? (
            <Button loading={busy} onClick={() => verificationAction(false)}>{data.action}</Button>
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
          Review the Terms and Privacy Policy versions shown on the form. Draft versions are for internal testing; approved policies are required before public registration goes live.
        </p>
      </Modal>
    </div>
  );
}
