# Resend Troubleshooting For Page Quest

This guide is specific to this repository.

The most important thing to understand first is this:

- Page Quest does **not** send invitation email through the Resend SDK or a
  `RESEND_API_KEY`.
- Page Quest sends invitation email through **SMTP** using Nodemailer.
- In this app, the important production variables are:
  `PAGEQUEST_EMAIL_DELIVERY_MODE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`.

If those SMTP values are wrong, invitations can be created in the database but
email delivery will still fail.

## What The App Actually Does

When an admin creates or resends an invitation:

1. The app creates or updates the invitation record first.
2. The app then tries to send the email through SMTP.
3. If SMTP sending fails, the UI shows a generic failure message.
4. The app records an audit entry with the action
   `invitation.delivery_failed`.

That means the admin UI tells you **that delivery failed**, but it does not tell
you the exact SMTP reason.

## Before You Start

Collect these values from your production setup before changing anything:

- The production site URL
- The exact `EMAIL_FROM` value from Vercel
- The exact SMTP settings stored in Vercel
- The verified sending domain shown in Resend
- One safe recipient email address you can use for testing

For this repo, the documented production SMTP values are:

```text
PAGEQUEST_EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<your-resend-smtp-password>
EMAIL_FROM=Page Quest <noreply@your-domain>
```

## Recommended Troubleshooting Steps

Start at the top and stop as soon as you find the problem.

### 1. Confirm The Symptom In The Admin UI

Do this first so you know whether you are debugging the right thing.

1. Sign in as an admin in production.
2. Create a fresh invitation or click `Resend` on an existing pending one.
3. Look for the delivery failure message.

What this means:

- If the UI says the invitation was created or resent successfully, the app did
  not hit the known SMTP failure path.
- If the UI says the invitation record was saved but delivery failed, the app
  probably reached SMTP and the send attempt failed.

### 2. Confirm You Are Troubleshooting SMTP, Not The Resend API

This app does not look for a Resend API key.

Check your production environment variables and confirm you are using SMTP
credentials, not only a Resend API key.

You need all of these:

- `PAGEQUEST_EMAIL_DELIVERY_MODE=smtp`
- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=resend`
- `SMTP_PASSWORD=<Resend SMTP password>`
- `EMAIL_FROM=<a sender on a verified Resend domain>`

Common mistake:

- Having a valid Resend account and maybe even an API key, but never creating
  or copying the **SMTP password**.

### 3. Check The Sender Domain In Resend

This is one of the easiest places to find a real problem.

In Resend:

1. Sign in to the dashboard.
2. Open `Domains`.
3. Find the domain used by `EMAIL_FROM`.
4. Confirm the domain status is fully verified.

What to compare:

- If `EMAIL_FROM` is `Page Quest <noreply@pagequest.ing>`, then Resend must be
  set up to send from `pagequest.ing` or a matching verified subdomain.
- If `EMAIL_FROM` is `Page Quest <noreply@mail.pagequest.ing>`, then
  `mail.pagequest.ing` must be the domain you verified, or Resend must allow it
  under the parent domain setup you completed.

Easy failures here:

- You verified one domain in Resend but `EMAIL_FROM` uses another.
- DNS records were added incompletely.
- DNS changes were added recently and verification has not finished yet.

### 4. Check The Production Environment Variables In Vercel

Open the Vercel project settings and inspect the variables in the
**Production** environment, not only Preview.

Check each value exactly:

- `PAGEQUEST_EMAIL_DELIVERY_MODE` must be `smtp`
- `SMTP_HOST` must be `smtp.resend.com`
- `SMTP_PORT` must be `465`
- `SMTP_SECURE` must be `true`
- `SMTP_USER` must be `resend`
- `SMTP_PASSWORD` must be the current Resend SMTP password
- `EMAIL_FROM` must match the verified sender domain

Be careful about these copy-paste mistakes:

- Leading or trailing spaces
- Pasting the wrong password
- Updating Preview but not Production
- Using quotes around values that do not need them in Vercel
- Using an old SMTP password after rotating credentials in Resend

### 5. Redeploy After Any Production Env Change

If you changed any Vercel environment variables, redeploy the production app.

Do not assume the running deployment picked up the new values automatically.

After redeploying:

1. Open the production app.
2. Create or resend one invitation.
3. Send it to a mailbox you can check immediately.
4. Check the inbox and spam folder.

### 6. Check Whether The App Recorded A Delivery Failure

This repo records an audit entry named `invitation.delivery_failed` when the
SMTP send step throws an error.

What this tells you:

- If you see that audit event, the invitation workflow ran and the app reached
  the delivery step.
- If you do not see that audit event, the failure may be earlier in the flow.

The audit entry includes useful context such as:

- Recipient email address
- Campaign name
- Whether it failed during create or resend

Important limitation:

- The audit record does **not** include the raw SMTP error text.

### 7. Run The Built-In Environment Validation Locally

This is an easy local check that catches missing or obviously invalid values.

The app has a production validation command:

```bash
pnpm env:validate -- --target production
```

This checks that the required hosted variables exist and that the production
contract is internally consistent.

Recommended workflow:

1. Create a temporary file such as `.env.production-check`.
2. Put your production-style values in that file.
3. Load it into your shell.
4. Run the validation command.

Example:

```bash
cp .env.example .env.production-check
```

Edit `.env.production-check` so it contains real production-style values for at
least these keys:

```text
APP_URL=https://your-production-domain
NEXTAUTH_URL=https://your-production-domain
NEXTAUTH_SECRET=<32+ character secret>
PAGEQUEST_AUTH_MODE=auth0
PAGEQUEST_EMAIL_DELIVERY_MODE=smtp
AUTH0_CLIENT_ID=<value>
AUTH0_CLIENT_SECRET=<value>
AUTH0_ISSUER=https://your-tenant.us.auth0.com
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend-smtp-password>
EMAIL_FROM=Page Quest <noreply@your-domain>
DATABASE_URL=postgresql://placeholder
DIRECT_URL=postgresql://placeholder
```

Then run:

```bash
set -a
source ./.env.production-check
set +a
pnpm env:validate -- --target production
```

What success looks like:

- You should see a message like `Environment validation passed for production`.

What failure means:

- A missing or malformed environment value is already enough to block the app.

This test does **not** prove Resend is reachable. It only proves your values are
present and shaped correctly.

### 8. Send A Real Email Locally Through Resend SMTP

This is the most useful local test because it bypasses the app UI and talks to
the same SMTP server the app uses.

Use a temporary shell session and export the exact values you intend to use:

```bash
export SMTP_HOST=smtp.resend.com
export SMTP_PORT=465
export SMTP_SECURE=true
export SMTP_USER=resend
export SMTP_PASSWORD='<your-resend-smtp-password>'
export EMAIL_FROM='Page Quest <noreply@your-domain>'
export TEST_RECIPIENT='your-real-inbox@example.com'
```

Then run this direct Nodemailer test:

```bash
node --input-type=module <<'EOF'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
})

try {
    const result = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.TEST_RECIPIENT,
        subject: 'Page Quest Resend SMTP test',
        text: 'If you received this, Resend SMTP worked from this machine.',
    })

    console.log('Success')
    console.log(result.messageId ?? '(no message id)')
} catch (error) {
    console.error('Failure')
    console.error(error)
    process.exit(1)
}
EOF
```

How to interpret the result:

- If this succeeds, your Resend SMTP credentials and sender setup are probably
  valid.
- If this fails with an authentication error, your SMTP password or username is
  wrong.
- If this fails with a sender or domain error, `EMAIL_FROM` does not match a
  verified sending domain.
- If this fails with a connection or TLS error, the problem may be network,
  firewall, or TLS related.

Check the recipient inbox and spam folder after a successful send.

### 9. Run The App Locally But Point It At Real Resend SMTP

This is the closest local approximation of production.

By default, local development points email to Mailpit. For this experiment,
temporarily point the app at Resend instead.

Recommended safe procedure:

1. Back up `.env.local`.
2. Replace only the mail settings with live Resend SMTP values.
3. Keep local auth as local auth.
4. Run the app locally.
5. Send or resend an invitation from the admin UI.
6. Check the real mailbox.
7. Restore your Mailpit settings when finished.

Suggested `.env.local` values for this test:

```text
PAGEQUEST_AUTH_MODE=local
PAGEQUEST_EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend-smtp-password>
EMAIL_FROM=Page Quest <noreply@your-domain>
```

Then run:

```bash
./scripts/local-startup
./scripts/dev
```

Next:

1. Sign in with your normal local admin flow.
2. Open the admin members page.
3. Create or resend an invitation.
4. Check the recipient mailbox.

How to use the result:

- If local end-to-end sending works with live Resend, but production still does
  not, the remaining problem is probably in Vercel configuration, production
  secrets, or the production sender domain setup.
- If local end-to-end sending also fails, the problem is probably your Resend
  SMTP credentials or sender identity setup.

### 10. Rotate The Resend SMTP Password

If you suspect the password may be wrong, stale, or copied incorrectly:

1. Open Resend.
2. Create a new SMTP password or regenerate the existing credential.
3. Update `SMTP_PASSWORD` in Vercel Production.
4. Redeploy.
5. Retry one invitation.
6. If needed, rerun the direct Nodemailer test from Step 8.

This is often faster than trying to guess whether an older secret was copied
correctly.

### 11. Test With The Simplest Possible Sender Address

If your sender address is fancy or inconsistent, simplify it.

Good simple example:

```text
EMAIL_FROM=Page Quest <noreply@your-domain>
```

Avoid unusual combinations while troubleshooting, such as:

- A display name copied with odd punctuation
- A mailbox on a different domain than the verified Resend domain
- A sender address that was used before DNS verification completed

### 12. Check For Delivery On The Recipient Side

Sometimes SMTP submission works but the recipient mailbox still does not show
the message where you expect it.

Check all of these:

1. Spam or junk folder
2. Promotions or updates tabs
3. Mailbox search for the subject line
4. Any inbox rules that automatically move mail

If Resend shows the send as accepted or delivered but you still do not see the
message, the issue may be mailbox-side filtering rather than app-side delivery.

### 13. Use A TLS Handshake Test If You Suspect A Network Problem

This is a more advanced experiment.

If the direct SMTP send fails with a network or TLS-looking error, test whether
your machine can establish a TLS session to Resend at all:

```bash
openssl s_client -connect smtp.resend.com:465 -servername smtp.resend.com
```

What you want to see:

- A successful certificate handshake
- No immediate connection refusal

What failure suggests:

- Firewall issue
- Corporate proxy or network interception
- Local machine network restrictions

This does not authenticate or send email. It only proves whether TLS connection
setup is possible.

## Fast Decision Tree

Use this if you want the shortest path.

1. Check that production really has SMTP values, not only a Resend API key.
2. Check that `EMAIL_FROM` matches a verified Resend domain.
3. Check that Vercel Production has the right `SMTP_*` values.
4. Redeploy after any env change.
5. Run `pnpm env:validate -- --target production` locally with production-style
   values.
6. Run the direct Nodemailer send from Step 8.
7. Run the local end-to-end test with live Resend from Step 9.

## Most Likely Root Causes In This Repo

Based on how this app is written, the most likely causes are:

1. `SMTP_PASSWORD` is missing, stale, or incorrect.
2. `EMAIL_FROM` does not match a verified Resend domain.
3. Production variables were changed in Vercel but the app was not redeployed.
4. The variables were added in Preview but not in Production.
5. You expected the app to use a Resend API key, but the app actually uses SMTP.

## If You Want The Smallest Useful Local Test

If you only do one local experiment, do Step 8.

It is the fastest way to answer this question:

> Can this machine send a real email through Resend SMTP using the same kind of
> credentials that the app expects?

If the answer is no, fix Resend SMTP or sender setup first.
If the answer is yes, compare that working setup to Vercel Production.
