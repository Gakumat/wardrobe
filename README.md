# Wardrobe

A private, AI-powered wardrobe PWA. Photograph each item once, and Claude tags it. From then on you get novel, weather-aware outfits with in-depth styling notes.

Stack: Next.js (App Router) · Supabase (Postgres, Storage, Auth) · Claude API · Open-Meteo · Vercel.

## One-time setup

### 1. GitHub
1. Sign up at https://github.com.
2. Create a **private** repository called `wardrobe` (New → Repository). Leave it empty: no README and no .gitignore.
3. Send Claude the repo URL. Claude adds it as the remote and pushes. The first push opens a browser window to log in to GitHub.

### 2. Supabase
1. Sign up at https://supabase.com. Create a **New project** called `wardrobe`, in the **Sydney** region.
2. Choose a strong **database password** and keep it; you'll need it in step 4.
3. When the project is ready, go to **Project Settings → API** (or **Data API**) and copy:
   - the **Project URL**
   - the **anon / publishable** key
   - the **project ref**: the `xxxx` in `https://xxxx.supabase.co`
4. Go to **Account (avatar) → Access Tokens → Generate new token** and copy it.

### 3. Anthropic
1. Sign up at https://console.anthropic.com.
2. Go to **Billing** and add some credit. $10 goes a long way.
3. Go to **API Keys → Create Key** and copy the key.

### 4. Paste the secrets locally
Copy `.env.example` to `.env.local` and fill in every value. `.env.local` is git-ignored and never leaves your machine.

### 5. Vercel
1. Sign up at https://vercel.com **with your GitHub account**.
2. Click **Add New → Project** and import the `wardrobe` repo.
3. Before deploying, open **Environment Variables** and add the first four values from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_EMAIL`
4. Click **Deploy** and send Claude the `*.vercel.app` URL.

From then on, every push to `main` deploys automatically.

## Development

Run the dev server:

```bash
npm run dev
```

Run the tests:

```bash
npm test
```

To apply database migrations, run this, which uses the `.env.local` CLI values:

```bash
npm run db:push
```
