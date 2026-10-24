# Lexicon

Terminology specific to Happy House Bills. All team members and AI agents should use this
as the canonical reference for domain terms.

| Term | Meaning | Notes |
|------|---------|-------|
| Household | A shared expense group — one Clerk organisation with exactly two members | Users "belong to" one household |
| Partner | The other member of a household | There is always exactly one |
| Expense | A bill or purchase logged by a user | Has a status: pending, approved, rejected |
| Pending | An expense that has been entered but not yet confirmed by the partner | The partner sees it with Confirm/Reject buttons |
| Approved | An expense that the partner has confirmed | Counts towards the balance |
| Rejected | An expense that the partner has rejected | Does not count towards the balance; has a reject reason |
| Settlement | A payment between partners to settle the balance | Recorded manually; e.g. "Sam paid Alex $50" |
| Balance | The net amount one partner owes another | Computed from approved expenses + settlements |
| Receipt | An image of a paper receipt uploaded by the user | Stored in R2; used for OCR and duplicate detection |
| dHash | Perceptual hash of a receipt image | 64-bit hex string for near-duplicate detection |
| Fingerprint | `${store}|${date}|${total}` string for receipt matching | Computed on receipt creation |
| OCR | Optical character recognition | Tesseract.js client-side (v1); Google Document AI (v1.1, future) |
| Entered by | The Clerk user ID of the person who created the expense | |
| Paid by | The Clerk user ID of the person who paid for the expense | |
| Approved by | The Clerk user ID of the partner who approved the expense | |
