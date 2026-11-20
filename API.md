# BOMI Lab waitlist API

Backend: a Google Apps Script web app bound to a Google Sheet (`backend/Code.gs`).
One URL ending in `/exec` serves everything. Every response is JSON with `ok: true|false`.
On failure: `{ "ok": false, "error": "<code>" }`. Every response has HTTP status 200 (Apps Script cannot set another status), so always check `ok`.

## GET `?action=stats`

`GET <URL>?action=stats` (a GET without `action` is the same).

```json
{ "ok": true, "total": 42 }
```

`total` is the number of signups, cached for 30 seconds. An unknown `action` gives `bad_request`.
`stats` is also accepted as a POST action.

## POST

Send the body as a JSON string with `Content-Type: text/plain;charset=utf-8` and no custom headers.
Invalid JSON, a body that is not an object, or an unknown `action` gives `bad_request`.

### action `join`

```json
{
  "action": "join",
  "email": "teacher@example.com",
  "ref": "K7XQ2MA",
  "lang": "uk",
  "utm": { "source": "tg", "medium": "post", "campaign": "launch" },
  "cid": "client-id-123",
  "hp": ""
}
```

| Field | Rules |
| --- | --- |
| `email` | Required. Trimmed and lowercased; checked for format, max 254 chars (local part max 64). A leading `=`, `+` or `-` is rejected. |
| `ref` | Optional referral code of another signup. Uppercased, non-alphanumerics removed, max 8 chars. Used only if that code exists, otherwise ignored. |
| `lang` | `uk` or `en`; anything else is stored as `en`. |
| `utm` | Optional object with `source`, `medium`, `campaign` (each cleaned, max 100 chars). |
| `cid` | Optional anonymous client id (`A-Za-z0-9_-`, max 64). Used for rate limiting. |
| `hp` | Honeypot. Must be empty. |

Success:

```json
{ "ok": true, "position": 42, "total": 42, "refCode": "K7XQ2MA", "referrals": 0, "already": false }
```

- `position` is the 1-based row of the signup, `refCode` is the signup's own 7-character code, `referrals` is how many signups used that code.
- Duplicate email: `ok: true`, `already: true`, with the existing `position`, `refCode` and current `referrals`. Nothing is written.
- Honeypot filled: a fake success (`already: false`, random `refCode`) and nothing is written. The honeypot is checked before the email.

Errors:

| `error` | When |
| --- | --- |
| `invalid_email` | Email missing or not valid. |
| `rate_limited` | More than 5 join requests in 10 minutes for the same `cid` (keyed by email when `cid` is missing). |
| `server` | Unexpected failure, or the sheet lock was busy for 10 s. |
| `bad_request` | See POST above. |

### action `quiz`

```json
{ "action": "quiz", "text": "<source text, 200-3000 chars>", "lang": "uk", "count": 5, "cid": "client-id-123" }
```

| Field | Rules |
| --- | --- |
| `text` | Required. Trimmed length 200 to 3000 characters. |
| `lang` | `uk` or `en`; anything else becomes `en`. |
| `count` | Rounded and clamped to 3..7. Missing, null or not a number: 5. |
| `cid` | Optional. A missing `cid` shares one `anon` bucket. |

Success:

```json
{
  "ok": true,
  "quiz": {
    "title": "Photosynthesis",
    "questions": [
      { "q": "Where does it happen?", "options": ["A", "B", "C", "D"], "answer": 2, "explain": "One sentence." }
    ]
  }
}
```

Each question has exactly 4 distinct options and `answer` is the 0-based index of the correct one. Options are shuffled on the server, so `answer` is already adjusted.
Questions that fail validation (not 4 distinct non-empty options, bad `answer`, empty or too long fields) are dropped. If fewer than 3 valid questions remain, the response is `server`. At most `count` questions are returned.

Errors:

| `error` | When |
| --- | --- |
| `too_short` | Text under 200 characters. |
| `too_long` | Text over 3000 characters. |
| `disabled` | `ANTHROPIC_API_KEY` is not set in Script Properties. |
| `rate_limited` | Over 5 requests per hour per `cid`, 30 per minute for everyone, or 300 per day for everyone (day in Europe/Kyiv); or the limit lock was busy. |
| `server` | The model call failed, was refused, stopped early, returned bad JSON, or fewer than 3 valid questions remained. Details go to the Apps Script log only. |
| `bad_request` | See POST above. |

Model: `claude-haiku-5-5` via the Anthropic Messages API (`anthropic-version: 2026-10-21`), `max_tokens` 3000 (thinking counts toward it, and Ukrainian needs more tokens), structured JSON output. One retry on 429 or 5xx, only if the first attempt was fast.
Text length checks run before the key check, and the limits are counted only when the request is accepted.

## Optional fields (sent by the page for the experiment funnel)

| Where | Field | Rules |
| --- | --- | --- |
| action `visit` (new) | whole body | `{ "action": "visit", "cid": "...", "lang": "uk", "utm": { "source": "", "medium": "", "campaign": "" }, "ref": "K7XQ2MA" }`. Sent once per browser session on page load, fire-and-forget: the page ignores the answer and any error (a backend without this action answering `bad_request` is fine). `ref` may be `null`. |
| action `quiz` | `sample` | `"photosynthesis"`, `"printing"`, `"magi"` (the sample chip whose text was sent unchanged) or `"custom"` (the visitor's own or edited text). For analytics only; it does not change the answer. |

## CORS

Send POST as `text/plain;charset=utf-8` with no custom headers: this is a simple request, so the browser sends no preflight (Apps Script cannot answer `OPTIONS`).
Apps Script answers with a 302 redirect to `script.googleusercontent.com`. `fetch` follows it and the JSON body is readable from any origin.

```js
const res = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'join', email }),
});
const data = await res.json();
```

## Local mock and contract test

```
MOCK_OK=1 node backend/mock-server.mjs       # http://127.0.0.1:8787
node backend/test-contract.mjs               # starts its own mock and runs the checks
node backend/test-contract.mjs --target=gas  # runs Code.gs itself in a vm with stubs
```

Mock env: `PORT` (default 8787), `MOCK_QUIZ_DELAY_MS` (default 1200), `MOCK_QUIZ_DISABLED=1` (quiz answers `disabled`). `MOCK_OK=1` is needed to start it from an interactive console. The mock has no 30-second stats cache.
`BASE_URL=<url>` points the test at an already running server.
