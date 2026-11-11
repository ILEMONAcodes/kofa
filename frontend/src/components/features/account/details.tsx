"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocalAccess } from "@/components/access/local-access";
import { Button, buttonStyles } from "@/components/common/button";
import { Badge } from "@/components/common/badge";
import { BrandLoading } from "@/components/common/brand-loading";
import { InspectionFrame } from "@/components/features/inspections/frame";
import { useStaffResource } from "@/components/features/live-staff/data";
import { errorText } from "@/components/features/live-staff/model";
import { formatStaffDate } from "@/lib/formatters/date";
import type { AccountUser } from "@/types/auth";

export function ClientAccountDetails() {
  const account = useStaffResource<AccountUser>("/auth/me");
  const { leave } = useLocalAccess();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const user = account.data;
  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await leave();
      window.location.replace("/");
    } catch (issue) {
      setError(errorText(issue));
      setSigningOut(false);
    }
  }
  return (
    <InspectionFrame
      staff={false}
      backHref="/properties"
      helpTitle="Help with your account"
      helpText="Contact our team through your inquiries if you have questions about your account. Keep your password private."
    >
      <div className="operational-dashboard">
        <p className="inspection-eyebrow">YOUR ACCOUNT</p>
        <h1>Your Kof’a account.</h1>
        {account.loading ? <BrandLoading /> : account.error ? (
          <section className="live-staff-panel" aria-label="Account details unavailable">
            <p role="alert">Your account details could not be loaded. Please try again.</p>
            <Button onClick={account.reload}>Retry account details</Button>
            <Link href="/login?returnTo=%2Faccount%2Foverview">Sign in again</Link>
          </section>
        ) : user?.role === "client" ? (
          <>
            <p>Welcome, {user.full_name.trim().split(/\s+/)[0]}.</p>
            <div className="live-staff-grid">
              <section className="live-staff-panel" aria-labelledby="account-details-heading">
                <h2 id="account-details-heading">Account details</h2>
                <dl className="grid gap-5">
                  {[
                    ["Full name", user.full_name],
                    ["Email address", user.email],
                    ["Phone number", user.phone || "Not provided"],
                    ["Account type", "Client"],
                    ["Member since", formatStaffDate(user.created_at, "date")],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Button variant="secondary" onClick={account.reload}>Refresh account details</Button>
              </section>
              <section className="live-staff-panel" aria-labelledby="account-security-heading">
                <h2 id="account-security-heading">Account security</h2>
                <div><Badge tone={user.is_email_verified ? "success" : "warning"}>
                  {user.is_email_verified ? "Email verified" : "Email not verified"}
                </Badge></div>
                {!user.is_email_verified && (
                  <Link className={buttonStyles()} href="/verify-email?returnTo=%2Faccount%2Foverview">Verify your email</Link>
                )}
                <Link className={buttonStyles("secondary")} href="/forgot-password?returnTo=%2Faccount%2Foverview">Reset your password</Link>
                <p>Your password is never displayed here.</p>
                {error && <p role="alert">{error}</p>}
                <Button onClick={() => void signOut()} loading={signingOut}>Sign out of your account</Button>
              </section>
            </div>
            <section className="live-staff-panel" aria-labelledby="account-next-heading">
              <h2 id="account-next-heading">Your next steps</h2>
              <div className="live-staff-actions">
                <Link className={buttonStyles()} href="/account/inquiries">Your inquiries</Link>
                <Link className={buttonStyles("secondary")} href="/account/inspections">Your inspections</Link>
                <Link className={buttonStyles("secondary")} href="/account/complaints">Your complaints</Link>
                <Link className={buttonStyles("secondary")} href="/properties">Explore properties</Link>
              </div>
              <Link href="/account/general-inquiry">Questions about your account? Speak to our team.</Link>
            </section>
          </>
        ) : (
          <section className="live-staff-panel">
            <p>Sign in to open your account.</p>
            <Link className={buttonStyles()} href="/account">Continue to your account</Link>
          </section>
        )}
      </div>
    </InspectionFrame>
  );
}
