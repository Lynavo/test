// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
//
// Toggle off-by-default for any flow that has not been validated end-to-end.
// Flip to `true` only when the corresponding backend / IAP plumbing is wired,
// QA'd and ready to ship to real users.

export const FEATURES = {
  /**
   * Gate routing on subscription status (trial_expired / sub_expired ⇒
   * SubscriptionScreen) and render the paywall overlay on the activity
   * screen. Disabled until real Apple IAP + server-side receipt verification
   * are deployed — without those the user lands in a non-recoverable dead end.
   */
  SUBSCRIPTION_ENFORCEMENT: false,
} as const;
