// Account deletion request for the Partner app (review → OTP → lock → admin).
//
// Nothing here deletes anything: confirming locks the account, suspends the
// shop and files a request the Paasora team reviews. The server decides what
// blocks a request; the app only renders it.

import { http } from '../httpClient';

// GET /owner/account-deletion/review → { can_submit, summary, items: [...] }
export const getReview = () => http.get('/owner/account-deletion/review');

// The OTP and the submit happen on the public website (config DELETE_ACCOUNT_URL),
// not in the app — the app shows this review and hands off.
