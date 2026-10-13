# Plan: Building fire insurance (Ireland)

Written before the code, as agreed. The code in this folder follows it.

## 1. Scenario
A customer buys 5-year fire cover for a building in Ireland.
1. Page 1: building details (address, Eircode, height, floors, construction, protection, sum insured).
2. Page 2: claims history and a multi-file upload (files can be large).
3. Data survives Back / Continue navigation until Submit. On Submit the application is stored in MongoDB.
4. After submit, simulated jobs run for underwriters and actuaries. When all have run, an approval decision is made.

## 2. Stack and layout
| Part | Tech | Folder |
|---|---|---|
| UI | Angular 17 (standalone components, signals) | `frontend/` |
| API | Node.js 18+, Express, Mongoose, Multer | `backend/` |
| DB | MongoDB 7 | `docker-compose.yml` |

## 3. One JSON as the contract
`backend/src/schema/form-schema.json` is the only definition of the form.
- The UI fetches it from `GET /api/form-schema` and renders both pages from it (field types, labels, options, validators, conditional fields, the file field, Irish rules).
- The backend validates against the same file, so rules cannot drift between UI and server.
- The UI sends one JSON object back: `{ schemaVersion, product, country, currency, policyTermYears, draftId, answers{}, documents[{id}] }`.
- All business logic (validation, pricing, document checks, underwriting) runs in the backend from that object. The UI only collects and displays.

Irish specifics: EUR, 26 county list, Eircode regex, Irish phone format, Fire Safety Certificate question, thatch roof option, levy line on the premium (rate is configurable, `IE_LEVY_RATE`).

## 4. Keeping data across pages
- One Angular `FormGroup` covers both pages and lives in a root service, so Back / Continue never resets it.
- Values are mirrored to `localStorage`, so a refresh keeps them too.
- Cleared only after a successful submit.
- Uploads live in a root service as well: they continue while the user is on page 1, and a tray shows progress on any page.

## 5. Uploads and "seconds taken"
- One HTTP request per file, so each file has its own progress, live elapsed seconds, and final "uploaded in N seconds".
- Files are saved to `backend/uploads/` and recorded in MongoDB (`UploadedFile`) against a `draftId`. They are viewable and downloadable later (`GET /api/files/:id`, `?inline=1` to view).
- To simulate slow, large uploads the server throttles the incoming stream (`UPLOAD_SIM_KBPS`, default 1024 KB/s, `0` = off). Back-pressure reaches the browser, so progress and seconds are real for that simulated speed. A 20 MB file takes about 20 s.
- Limits from the JSON: 200 MB per file, 10 files, allowed extensions only.

## 6. Data model (MongoDB)
- `applications`: reference, draftId, status (SUBMITTED, UNDERWRITING, APPROVED, REFERRED), payload (validated JSON), quote, documents[], jobs[], decision.
- `uploadedfiles`: draftId, applicationId, originalName, size, storedName, uploadSeconds.

## 7. API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/form-schema` | The JSON that drives the UI |
| POST | `/api/uploads?draftId=` | Upload one file (multipart) |
| GET / DELETE | `/api/uploads` , `/api/uploads/:id` | List / remove draft files |
| GET | `/api/files/:id` | View or download a file |
| POST | `/api/applications/quote` | Indicative price from page 1 |
| POST | `/api/applications` | Submit: validate, price, save, start jobs |
| GET | `/api/applications/:id` | Status, jobs, decision (UI polls this) |

## 8. Underwriting and actuarial jobs (simulated)
Seven jobs run one after another in the background, each taking 2 to 5 seconds (`UW_JOB_MIN_MS`, `UW_JOB_MAX_MS`). Results are saved to MongoDB after each job. Unfinished applications resume after a server restart.

| # | Job | Owner | Fails when |
|---|---|---|---|
| 1 | Eircode and address validation | Underwriting | (warns on county / routing key mismatch) |
| 2 | Construction, age and height risk | Underwriting | height per floor is implausible |
| 3 | Fire protection adequacy | Underwriting | no detection, or over 30 m without sprinklers |
| 4 | Claims history (5 years) | Underwriting | more than 3 claims, or claims over 25% of sum insured |
| 5 | Supporting document review | Underwriting | claims declared but no documents |
| 6 | Sum insured / rebuild cost | Actuarial | under 800 EUR per m2 |
| 7 | Premium and loss-ratio validation | Actuarial | stored premium differs from recomputed |

Decision after all jobs: no FAILED -> **APPROVED** (warnings become conditions). Any FAILED -> **REFERRED** to a human underwriter.

## 9. Assumptions and limits
- Rates, thresholds and the levy are demo values, not real Irish market or tax figures.
- No login or payment; "a user logs in" is out of scope for this pass (the draft is tied to a browser `draftId`).
- Uploaded files get no real virus scan or OCR; document review is simulated.

## 10. Checks
- `cd backend && npm test`: schema validation, Eircode/phone rules, pricing and all seven rules, no database needed.
- Manual: fill page 1, go to page 2, upload large files, go back to page 1 (data and uploads stay), submit, watch the jobs finish and the decision appear.
