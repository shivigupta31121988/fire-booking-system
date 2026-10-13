# Building fire insurance, Ireland

Angular + Node.js + MongoDB. Read `PLAN.md` for the design.

## Run
1. MongoDB: `docker compose up -d` (or use your own and set `MONGO_URI`).
2. Backend: `cd backend && npm install && npm start`  (http://localhost:3000)
3. Frontend: `cd frontend && npm install && npm start`  (http://localhost:4200)

Open http://localhost:4200.

## Try it
- Page 1: any valid values. Eircode example `D02 X285`, phone `087 123 4567`, sum insured `6000000` for 2500 m2.
- Page 2: pick a few files. Each shows live seconds and "Uploaded in N seconds". Go back to page 1 while they upload.
- Choose "Yes" for claims to see the conditional fields and required documents.
- Submit and watch the 7 jobs run, then the approval.
- To get a REFERRED result: say 4 claims, or no smoke detection / alarm.

## Settings (environment variables, backend)
| Variable | Default | Meaning |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/ie_insurance` | Database |
| `UPLOAD_SIM_KBPS` | `1024` | Simulated upload speed, `0` = real speed |
| `UW_JOB_MIN_MS` / `UW_JOB_MAX_MS` | `2000` / `5000` | Time each job takes |
| `IE_LEVY_RATE` | `0.03` | Demo levy on premium |
| `PORT` | `3000` | API port |

## Change the form
Edit `backend/src/schema/form-schema.json` and restart the backend. Both pages and the server validation change together.
