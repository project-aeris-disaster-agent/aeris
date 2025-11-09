"""Verify setup before running bot."""
import sys
import os
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict') if hasattr(sys.stdout, 'buffer') else sys.stdout

print("=" * 60)
print("AERIS Bot Setup Verification")
print("=" * 60)

# Check directory
current_dir = Path.cwd()
print(f"\n📁 Current Directory: {current_dir}")
print(f"   Expected: E:\\NPC\\06 AERIS")
if "06 AERIS" in str(current_dir):
    print("   ✅ Correct directory")
else:
    print("   ⚠️  Wrong directory! Please cd to E:\\NPC\\06 AERIS")

# Check Python
print(f"\n🐍 Python Executable: {sys.executable}")
if ".venv" in sys.executable or "venv" in sys.executable:
    print("   ✅ Using virtual environment")
else:
    print("   ⚠️  Not using virtual environment!")
    print("   Please activate: .venv\\Scripts\\Activate.ps1")

# Check required modules
required_modules = {
    "telethon": "Telegram client",
    "openai": "OpenAI/LLM client",
    "streamlit": "Admin interface",
    "supabase": "Database"
}

print(f"\n📦 Checking Dependencies:")
all_ok = True
for module, description in required_modules.items():
    try:
        mod = __import__(module)
        version = getattr(mod, "__version__", "unknown")
        print(f"   ✅ {module} ({version}) - {description}")
    except ImportError:
        print(f"   ❌ {module} - MISSING - {description}")
        all_ok = False

# Check key files
print(f"\n📄 Checking Key Files:")
key_files = ["main.py", "requirements.txt", ".env", "bot/message_handler.py"]
for file in key_files:
    if Path(file).exists():
        print(f"   ✅ {file}")
    else:
        print(f"   ❌ {file} - NOT FOUND")

# Check .env variables
print(f"\n🔐 Checking Environment Variables:")
env_vars = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_API_ID", "OPENAI_API_KEY"]
for var in env_vars:
    value = os.getenv(var)
    if value:
        masked = value[:10] + "..." if len(value) > 10 else "***"
        print(f"   ✅ {var} = {masked}")
    else:
        print(f"   ❌ {var} - NOT SET")

print("\n" + "=" * 60)
if all_ok:
    print("✅ Setup looks good! You can run: python main.py")
else:
    print("⚠️  Some issues found. Please fix them before running the bot.")
print("=" * 60)

