# Quick Fix: Running Streamlit Admin Interface

## Issue
The `streamlit` command isn't recognized in PowerShell.

## Solution
Use Python module syntax instead:

### Option 1: Use Python Module (Recommended)
```powershell
python -m streamlit run admin/streamlit_app.py
```

### Option 2: Use Helper Script
```powershell
python run_admin.py
```

## Steps to Run Admin Interface

1. **Make sure you're in the project directory:**
   ```powershell
   cd "E:\NPC\06 AERIS"
   ```

2. **Activate virtual environment (if using one):**
   ```powershell
   .venv\Scripts\activate
   ```

3. **Run Streamlit:**
   ```powershell
   python -m streamlit run admin/streamlit_app.py
   ```

4. **The interface will open in your browser** at `http://localhost:8501`

5. **Enter admin password:** `6666` (from your .env file)

## Troubleshooting

**If it still doesn't work:**
- Make sure Streamlit is installed: `pip install streamlit`
- Check Python path: `python --version`
- Try: `python -m pip install streamlit`

**If port 8501 is already in use:**
- Streamlit will automatically use the next available port
- Check the terminal output for the actual URL

## Quick Test

Run this command:
```powershell
python -m streamlit run admin/streamlit_app.py
```

You should see:
```
You can now view your Streamlit app in your browser.
Local URL: http://localhost:8501
```

Then open that URL in your browser!

