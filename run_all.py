"""
Helper script to run both bot and Streamlit admin interface.
"""

import subprocess
import sys
import time
import signal
import os
from pathlib import Path

def run_bot():
    """Run the Telegram bot."""
    print("Starting Telegram Bot...")
    # Use unbuffered output to see logs immediately
    return subprocess.Popen(
        [sys.executable, "-u", "main.py"],
        cwd=Path(__file__).parent,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

def run_streamlit():
    """Run Streamlit admin interface."""
    print("Starting Streamlit Admin Interface...")
    # Streamlit handles its own output
    return subprocess.Popen(
        [sys.executable, "run_admin.py"],
        cwd=Path(__file__).parent,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def main():
    """Run both services."""
    print("=" * 60)
    print("Starting AERIS Services")
    print("=" * 60)
    
    bot_process = None
    streamlit_process = None
    
    try:
        # Start bot
        bot_process = run_bot()
        print(f"✅ Bot started (PID: {bot_process.pid})")
        
        # Wait a moment
        time.sleep(2)
        
        # Start Streamlit
        streamlit_process = run_streamlit()
        print(f"✅ Streamlit started (PID: {streamlit_process.pid})")
        
        print("\n" + "=" * 60)
        print("Services Running:")
        print("=" * 60)
        print("📱 Telegram Bot: Running")
        print("🌐 Streamlit Admin: http://localhost:8501")
        print("\nPress Ctrl+C to stop both services")
        print("=" * 60)
        
        # Wait for interrupt
        while True:
            time.sleep(1)
            # Check if processes are still running
            if bot_process.poll() is not None:
                print("\n⚠️ Bot process ended unexpectedly")
            if streamlit_process.poll() is not None:
                print("\n⚠️ Streamlit process ended unexpectedly")
    
    except KeyboardInterrupt:
        print("\n\nStopping services...")
        if bot_process:
            bot_process.terminate()
            print("✅ Bot stopped")
        if streamlit_process:
            streamlit_process.terminate()
            print("✅ Streamlit stopped")
        print("\nAll services stopped.")

if __name__ == "__main__":
    main()

