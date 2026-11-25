# Milestone 9: AI invoice capture

Upload a supplier invoice (PDF or photo). A vision model reads it, the API checks what it read, and the user reviews a pre-filled bill form beside the document before anything is saved.

## The flow

```
POST /api/bill-extractions (file)            → 202 { id, status: "pending" }   (row + job queued)
  worker: ExtractBill
    DocumentPages      PDF → PNG pages (poppler), photos as they are
    InvoiceExtractor   OpenAI-compatible chat completions + images → raw JSON
    Normalizer         types, fils, TRN digits, cross-checks → result + warnings
    duplicate check    same supplier + number already recorded?
    → status "completed" (or "failed" with a message for the user); upload deleted
GET /api/bill-extractions/{id}  every 1.5 s  → result + warnings
Review screen → user corrects → POST /api/bills (the normal validation)
```

## Files to read

**Laravel**
1. `app/Http/Controllers/Api/BillExtractionController.php`: upload (202), polling, usage
2. `app/Jobs/ExtractBill.php`: the pipeline, failure handling, `failed()` for timeouts
3. `app/Extraction/OpenAiCompatibleExtractor.php`: one HTTP call, retries, error mapping, lenient JSON parsing
4. `app/Extraction/ExtractionPrompt.php`: the instructions (UAE day-first dates, VAT-exclusive prices, supplier vs customer TRN)
5. `app/Extraction/BillExtractionNormalizer.php`: **the important part**: how the model's answer is checked
6. `app/Extraction/ExtractionQuota.php`: daily limits
7. `app/Console/Commands/EvalExtraction.php` and `tests/Fixtures/extraction/`: the evaluation set

**React**
1. `pages/BillCapturePage.tsx`: upload → reading → review states, with the id in the URL
2. `features/bills/capture/hooks.ts`: polling with `refetchInterval` that stops itself
3. `features/bills/capture/mapping.ts`: API result → form values; warnings → fields
4. `features/bills/BillForm.tsx`: `initialValues`, `warnings` (hidden once a field is edited), and the live "total on the invoice" check
5. `components/ui/FormField.tsx`: the new amber `warning` state

## Design decisions (and the interview answers)

**Treat the model like user input.** The model's JSON goes through the same kind of checks as a form submission. Every field is type-checked and converted, and the numbers are recalculated with `InvoiceCalculator`, the code that saves real bills. Where the model and the arithmetic disagree, the user is told exactly which field to check. The model never writes to the database. The user saves through `POST /api/bills` and its normal validation, so a wrong extraction can cost a correction, never a bad record.

**Warnings, not errors.** A doubtful value still fills the field, with an amber note. Errors block saving; warnings ask for a look. Examples:
- the lines add up to a different subtotal than the one printed;
- the prices look VAT-inclusive;
- the TRN isn't 15 digits starting with 100;
- VAT is charged but there's no TRN;
- a date is in the future (probably a month/day swap);
- the currency isn't AED;
- the invoice is already recorded.

Once the user edits a field, its warning disappears.

**Why a queue, and why polling.** Vision models take 5–30 seconds. Holding an HTTP request open that long ties up one of only four PHP-FPM workers on the small server, and CloudFront's origin timeout is close. The upload returns 202 at once. A separate worker container runs the job, and the browser polls a cheap GET. TanStack Query's `refetchInterval` returns `false` once the status is final, so polling stops by itself. WebSockets would be nicer but need another moving part (Reverb/Pusher) for a single screen.

**No shared disk.** The upload is stored base64 in the extraction row until the worker has read it, then cleared. The api and worker containers need no shared volume, and no document outlives its extraction. If the worker dies mid-job, `failed()` (or the stale check when polled) marks the extraction failed and clears the file, so the browser never waits forever.

**Provider-agnostic on purpose.** The extractor speaks the OpenAI chat completions format through Laravel's HTTP client, with no SDK. Gemini, OpenAI, Groq, OpenRouter and Ollama all accept it, so changing provider means changing `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY`. PDFs are rendered to PNG first, because image input is supported everywhere and PDF input isn't. The model's JSON is parsed leniently (fenced code blocks, extra sentences around it) because even JSON mode isn't perfectly reliable across providers.

**Gemini 2.5 Flash on the free tier.** It reads documents well, costs nothing for a portfolio demo, and `reasoning_effort: low` keeps it fast. The trade-offs, stated on the upload page and in the README:
- the free tier may use uploads to improve Google's models, so no real invoices;
- it has a daily quota, hence the app's own limits.

**Limits are part of the feature.** These protect the demo's free quota from one visitor or a script:
- 5 MB per file;
- type checked from the contents;
- the first 3 PDF pages, with a warning if any were skipped;
- 5 uploads a minute (route throttle);
- 10 a day per user and 100 a day for everyone, counted from the extraction rows;
- a 429 with `Retry-After` when a limit is reached.

Each job tries once, because a retry is another call against the quota. Within a job, 429/5xx responses get one retry with back-off.

**Errors users can read.** Provider responses can contain request details. They're logged for the developer, and users see messages like "The AI service is busy or its free quota is used up. Please try again later."

**An evaluation set instead of vibes.** `generate.py` builds six fictional invoices with known answers, each testing something specific:
- mixed 5% and zero-rated lines;
- a "VAT-inclusive amount" column to ignore;
- two pages;
- a supplier with no TRN and no VAT;
- day-first dates (05/02 is 5 February);
- a tilted, compressed phone photo.

`make eval-ai` runs the production pipeline on them and prints accuracy per field. That makes a model or prompt change measurable, for example: `AI_MODEL=gemini-2.5-flash-lite make eval-ai`.

**Tests never call the AI.** `Http::fake()` stands in for the provider. The real extractor still runs, so the tests check the request it sends (system prompt, image data URI, JSON mode), retries, and error mapping. The normaliser has its own unit tests for every kind of doubt. On the frontend, MSW drives the whole flow: upload, polling, the pre-filled form, a warning disappearing on edit, and the payload saved.

## Try it

1. Rebuild the dev images once (poppler was added): `docker compose build api worker`
2. Put your Gemini key in `api/.env` as `AI_API_KEY=…` and copy the other `AI_*` lines from `.env.example`
3. `make up`, open **Bills → Upload invoice**, drop `api/tests/Fixtures/extraction/office-supplies.pdf`
4. `make eval-ai` for the accuracy table

## What I'd do next

- Remember suppliers: offer a supplier picker filled in from past bills, and flag a TRN that differs from the one on record.
- Show where each value was found (bounding boxes) so the review can highlight it on the document.
- Track how often users change each extracted field after review, as a production accuracy metric next to the evaluation set.
