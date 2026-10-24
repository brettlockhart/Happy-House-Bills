# User Flows

Core user journey flows for Happy House Bills.

## 1. Onboarding Flow

```
User A (signs up)
  → Creates Clerk account
  → Creates household (Clerk organisation)
  → System generates invite link
  → Invite sent to User B via email (Resend)

User B (receives invite email)
  → Clicks invite link
  → Creates Clerk account (if not already)
  → Accepts invitation → joins household
  → Both users see the shared expense tracker
```

## 2. Add Expense Flow

```
User opens app
  → Clicks "Add Expense"
  → Chooses: Take photo / Upload image / Manual entry

If photo/upload:
  → Image captured/uploaded
  → Tesseract.js runs client-side OCR
  → Extracted store, date, total pre-fill the form
  → User confirms/edits fields
  → Duplicate check runs (dHash + fingerprint)
    → If duplicate found: Warning shown, user can proceed or cancel

If manual:
  → Form pre-filled with today's date, current user as "paid by"
  → User fills amount, category, notes

User submits:
  → expense:uploadReceipt action (if receipt image) → R2 upload → storage ID
  → expense:create mutation → status: "pending"
  → Email notification sent to partner: "New expense: $X at Store"
```

## 3. Approve / Reject Expense Flow

```
Partner (receives email or opens app)
  → Sees pending expense in entry list with Confirm / Reject buttons
  → Clicks Confirm → expense:approve → status: "approved"
    → Email notification to expense creator: "Confirmed"
  → Or clicks Reject → enters reason → expense:reject → status: "rejected"
    → Email notification to expense creator: "Rejected: [reason]"
```

## 4. Settle Up Flow

```
User opens app
  → Clicks "Settle Up"
  → Amount pre-filled from current balance
  → "From" / "To" auto-filled based on balance direction
  → User confirms/edits amount
  → Submits → settlements:create mutation
  → Email notification to recipient: "Settlement: $X received"
```

## 5. Real-Time Balance Updates

```
Any action that changes expenses or settlements
  → Convex mutation completes
  → Convex real-time subscription fires
  → Both users' apps update the balance header simultaneously
  → Balance reflects: approved expenses + settlements
```
