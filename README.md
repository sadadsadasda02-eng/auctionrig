# Fragment Preview Backend

Render.com backend that automatically uploads preview images to GitHub.

## Setup Instructions

### 1. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Fragment Preview Backend"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

### 2. Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `fragment-previews`
3. Make it **public** (for free unlimited storage) or **private** (1GB limit)
4. ✅ Initialize with README
5. Click "Create repository"

### 3. Add Initial Files to GitHub Repo

Create these files in your `fragment-previews` repo:

**`mappings.json`:**
```json
{
  "board": 1
}
```

**`images/1.png`:**
Upload your board.png as `images/1.png`

### 4. Deploy to Render.com

1. Go to: https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect this repository (or create new one)
5. Settings:
   - **Name**: `fragment-preview-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

6. Add Environment Variables:
   ```
   GITHUB_TOKEN = ghp_your_token_here
   GITHUB_OWNER = your_github_username
   GITHUB_REPO = fragment-previews
   ```

7. Click "Create Web Service"
8. Wait 2-3 minutes for deploy

### 5. Test the Backend

Once deployed, you'll get a URL like: `https://fragment-preview-backend.onrender.com`

Test endpoints:

```bash
# Health check
curl https://your-app.onrender.com/

# Get preview URL
curl https://your-app.onrender.com/api/preview/board

# Check mappings
curl https://your-app.onrender.com/api/mappings
```

### 6. Update Admin Panel

In `admin-console.html`, change the upload URL:

```javascript
// OLD:
const response = await fetch('https://fragmentlink.netlify.app/.netlify/functions/upload-preview', {

// NEW:
const response = await fetch('https://YOUR-APP.onrender.com/api/upload-preview', {
```

### 7. Update Netlify Edge Function

In `preview.js`, fetch image URL from backend:

```javascript
// Fetch from Render backend
const apiResponse = await fetch(`https://YOUR-APP.onrender.com/api/preview/${username}`);
const { imageUrl } = await apiResponse.json();

// Use GitHub raw URL
const previewImageUrl = imageUrl;
```

## How It Works

```
Admin Panel
    ↓ POST /api/upload-preview
Render Backend
    ↓ GitHub API
GitHub Repository (fragment-previews)
    ├── images/
    │   ├── 1.png (board)
    │   ├── 2.png (testcheck)
    │   └── 3.png (carboard)
    └── mappings.json
    
Edge Function → GET /api/preview/username → Returns GitHub raw URL
```

## Image Numbering System

- Each username gets a unique number
- Images stored as `1.png`, `2.png`, `3.png`, etc.
- `mappings.json` tracks: `{"board": 1, "testcheck": 2}`
- Updating existing username replaces its image
- New usernames get next available number

## Benefits

✅ Fully automated uploads
✅ No manual downloads
✅ Persistent storage (GitHub never loses files)
✅ Version control (see image history)
✅ Free forever (Render + GitHub free tiers)
✅ Global CDN (GitHub raw URLs are cached)

## Troubleshooting

**"401 Unauthorized" error:**
- Check GitHub token has `repo` scope
- Token must be set in Render environment variables

**"404 Not Found" error:**
- Make sure repository exists and is accessible
- Check `GITHUB_OWNER` and `GITHUB_REPO` are correct

**Images not updating:**
- GitHub CDN caches for 5 minutes
- Use `?v=timestamp` in URL to bust cache
- Or wait 5 minutes

## Cost

- **Render.com**: FREE (750 hours/month = always-on)
- **GitHub**: FREE (public repo = unlimited, private = 1GB)
- **Total**: **$0/month**

## Next Steps

1. Deploy this backend to Render
2. Update admin panel upload URL
3. Update Edge Function to use backend API
4. Upload initial images to GitHub
5. Test end-to-end flow!
