# EV Charging Receipt Manager

Upload EV charging receipts (images or PDFs) in English, Finnish, or Swedish. The app uses the Claude AI to extract the date, amount, and vendor from each receipt, then exports a single PDF with a summary cover page and all receipts bundled.

## What it does

1. Upload receipt images (JPG/PNG) or PDFs
2. Click **Extract with AI** — Claude reads each receipt and pulls out date, amount, vendor
3. Review and edit extracted values in the table if needed
4. Click **Export PDF report** — generates a PDF with:
   - Cover page: total amount, first charging date, last charging date, itemised table
   - One page per receipt (images embedded, PDFs merged in)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set the app password

Create a `.env.local` file in the project root:

```
APP_PASSWORD=your-chosen-password
```

Replace `your-chosen-password` with whatever password you want. Share this password with your colleagues.

If you skip this step, the default password is `changeme` — make sure to set a real one before deploying.

### 3. Get a Claude API key

Go to [console.anthropic.com](https://console.anthropic.com), create an account, and generate an API key.

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Enter your API key in the field at the top of the app. It is only used server-side to call the Anthropic API and is never stored.

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

That's it. Vercel will detect Next.js automatically.

**Set your password on Vercel:** go to your project → Settings → Environment Variables → add `APP_PASSWORD` with your chosen password → redeploy.

The Claude API key does not need to be set as an environment variable — users enter it themselves in the app.

## Tech stack

- **Next.js 14** — framework
- **Anthropic SDK** — AI extraction (claude-sonnet-4)
- **pdf-lib** — PDF generation and receipt bundling
- **sharp** — image processing

## Supported receipt languages

English, Finnish, Swedish — and most other languages too, since Claude is multilingual.

## Supported file types

- JPEG / JPG
- PNG
- PDF (single or multi-page)
