# GitHub Authentication Setup

## Issue
Git push failed with: `Permission denied` - You need to authenticate with GitHub.

## Solutions

### Option 1: Use GitHub Personal Access Token (Recommended)

1. **Create a Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name: `sonara-repo-access`
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Update Git Remote to use token:**
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/project-aeris-disaster-agent/sonara.git
   ```
   Replace `YOUR_TOKEN` with your actual token.

3. **Push again:**
   ```bash
   git push -u origin v0.1.1_twitter_login_bugged
   ```

### Option 2: Use SSH (More Secure)

1. **Check if you have SSH keys:**
   ```bash
   ls ~/.ssh/id_rsa.pub
   ```

2. **If no SSH key exists, generate one:**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

3. **Add SSH key to GitHub:**
   - Copy your public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste your key and save

4. **Update remote to use SSH:**
   ```bash
   git remote set-url origin git@github.com:project-aeris-disaster-agent/sonara.git
   ```

5. **Push:**
   ```bash
   git push -u origin v0.1.1_twitter_login_bugged
   ```

### Option 3: Use GitHub CLI

1. **Install GitHub CLI** (if not installed):
   - Windows: `winget install GitHub.cli`
   - Or download from: https://cli.github.com/

2. **Authenticate:**
   ```bash
   gh auth login
   ```

3. **Push:**
   ```bash
   git push -u origin v0.1.1_twitter_login_bugged
   ```

## Current Status

- ✅ Database schema created and secured
- ✅ All security warnings fixed
- ✅ Code committed locally
- ⏳ Waiting for GitHub authentication to push

## After Authentication

Once you've authenticated, run:
```bash
git push -u origin v0.1.1_twitter_login_bugged
```

Or if you want to push to `main` branch:
```bash
git checkout -b main
git push -u origin main
```

