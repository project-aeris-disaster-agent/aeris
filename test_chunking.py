"""Simple test script - run directly in PowerShell."""
from llm.chunking import ContentChunker

# Read the file
with open('knowledge_base/processed/TCB#1_uwan.txt', 'r', encoding='utf-8') as f:
    text = f.read()

print(f"Text length: {len(text):,} characters")

# Test chunking
chunker = ContentChunker()
print("Starting chunking...")
chunks = chunker.chunk_text(text, 'TCB#1_uwan', None)

print(f"Created {len(chunks)} chunks")
if chunks:
    print(f"First chunk preview: {chunks[0]['content'][:100]}...")
    # Save chunks
    chunker.save_chunks(chunks, 'knowledge_base/chunks/TCB#1_uwan_chunks.json')
    print("✅ Chunks saved successfully!")
else:
    print("❌ No chunks created!")
