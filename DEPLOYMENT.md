# Deployment Instructions

## Deploy to Vercel (Recommended - Free)

### Prerequisites
- GitHub account
- Vercel account (sign up at vercel.com - free)

### Step 1: Push to GitHub

1. **Initialize git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - ready for Vercel deployment"
   ```

2. **Create a GitHub repository**:
   - Go to github.com
   - Click "New repository"
   - Name it (e.g., "camp-chatbot")
   - DON'T initialize with README (you already have code)
   - Click "Create repository"

3. **Push your code**:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Go to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Click "Sign Up" (use GitHub to sign in)

2. **Import Project**:
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find your repository and click "Import"

3. **Configure Project**:
   - **Framework Preset**: Vite (should auto-detect)
   - **Build Command**: `npm run build` (should auto-fill)
   - **Output Directory**: `dist` (should auto-fill)
   - Click "Deploy"

4. **Add Environment Variable**:
   - While deployment is running (or after), go to "Settings" → "Environment Variables"
   - Add variable:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: Your OpenAI API key
   - Click "Add"
   - If already deployed, redeploy: "Deployments" → "..." → "Redeploy"

### Step 3: You're Live! 🎉

Your app will be live at: `https://your-project-name.vercel.app`

### Updating Your App

Every time you push to GitHub, Vercel automatically redeploys:

```bash
git add .
git commit -m "Your changes"
git push
```

Wait ~30 seconds and your changes are live!

### Custom Domain (Optional - Free)

1. In Vercel dashboard → "Settings" → "Domains"
2. Add your domain (e.g., `camps.yourdomain.com`)
3. Follow DNS instructions
4. Free SSL certificate included automatically

---

## Alternative: Vercel CLI (Quick Deploy)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project directory)
vercel

# Follow prompts, set OPENAI_API_KEY when asked

# To deploy updates
vercel --prod
```

---

## Security Features Included

✅ **API Key Protected**: OpenAI key stays on server (never exposed to browser)
✅ **HTTPS Only**: Automatic SSL certificates
✅ **CORS Handled**: Vercel handles cross-origin requests
✅ **Rate Limiting**: Built into Vercel free tier
✅ **DDoS Protection**: Cloudflare-level protection included

---

## Troubleshooting

### Build fails
- Check that `npm run build` works locally first
- Ensure all dependencies are in `package.json`

### API routes not working
- Verify environment variable `OPENAI_API_KEY` is set in Vercel dashboard
- Check function logs in Vercel dashboard → "Functions" tab

### Chat not streaming
- Check browser console for errors
- Verify vector stores exist in your OpenAI account
- Check Vercel function logs for API errors

---

## Cost Estimate

**Vercel Free Tier**:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ 100GB-hrs serverless function execution/month
- ✅ Free SSL & custom domains

**Typical Usage**: For a small camp (100-500 users), you'll stay well within the free tier.

**OpenAI Costs**: Pay-as-you-go based on usage. Estimate ~$0.001-0.01 per chat interaction.
