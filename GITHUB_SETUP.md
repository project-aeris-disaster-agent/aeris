# GitHub Repository Setup

## Steps to Create and Push to GitHub

### 1. Create New Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `sona-bio` (or your preferred name)
3. Description: "Create your AI Alter-Ego Instantly - Powered by ElizaOS"
4. Choose visibility (Public/Private)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 2. Connect Local Repository to GitHub

After creating the repo, GitHub will show you commands. Run these in your terminal:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sona-bio.git

# Rename current branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

### 3. Alternative: If you want to use SSH

```bash
git remote add origin git@github.com:YOUR_USERNAME/sona-bio.git
git branch -M main
git push -u origin main
```

## Current Branch Status

You're currently on branch: `v0.1.1_twitter_login_bugged`

If you want to push this branch instead of main:
```bash
git remote add origin https://github.com/YOUR_USERNAME/sona-bio.git
git push -u origin v0.1.1_twitter_login_bugged
```

## Next Steps After Pushing

1. Update repository description on GitHub
2. Add topics/tags: `react`, `typescript`, `supabase`, `elizaos`, `ai-agent`, `twitter-api`
3. Consider adding a LICENSE file
4. Set up GitHub Actions for CI/CD (optional)
5. Enable GitHub Pages if needed (optional)

