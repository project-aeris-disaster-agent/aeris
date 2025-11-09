# Bot Connection Issue - FIXED

## Problem Found

**Error**: `database is locked` (SQLite session file)

**Root Cause**: Multiple bot processes trying to access the same session file (`disaster_response_bot.session`) simultaneously.

## Why This Happened

- Multiple `main.py` processes were running (PIDs: 12824, 23472, 26076)
- Each process tries to write to the same SQLite session file
- SQLite doesn't allow concurrent writes from multiple processes
- Result: Bot can't connect, no responses

## Solution Applied

1. **Stopped all duplicate bot processes**
2. **Updated `run_all.py`** to show bot output directly (so you can see errors)
3. **Created diagnostic script** to check for this issue

## How to Run Properly

### Option 1: Use run_all.py (Recommended)
```powershell
python run_all.py
```

This ensures only ONE bot instance runs.

### Option 2: Run Separately
```powershell
# Terminal 1: Bot
python main.py

# Terminal 2: Streamlit  
python run_admin.py
```

## Important Notes

⚠️ **NEVER run multiple `main.py` instances simultaneously**
- They will conflict over the session file
- Only ONE bot process should run at a time

✅ **Check for running processes before starting:**
```powershell
Get-Process python | Where-Object {$_.CommandLine -like "*main.py*"}
```

✅ **Stop all bot processes before restarting:**
```powershell
Get-Process python | Where-Object {$_.CommandLine -like "*main.py*"} | Stop-Process -Force
```

## Next Steps

1. Stop all current bot processes
2. Start fresh with `python run_all.py`
3. Check terminal output for connection messages
4. Test by sending `/start` to your bot

