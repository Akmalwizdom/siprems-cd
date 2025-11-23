#!/usr/bin/env python3
"""
Test script to verify Gemini API connection
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    print("[ERROR] GEMINI_API_KEY not found in .env file")
    exit(1)

print(f"[OK] API Key found: {GEMINI_API_KEY[:20]}...{GEMINI_API_KEY[-4:]}")

try:
    # Configure Gemini
    genai.configure(api_key=GEMINI_API_KEY)
    
    # Test with gemini-2.5-flash
    print("\n[TEST] Testing gemini-2.5-flash model...")
    
    generation_config = {
        "temperature": 0.7,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 1024,
    }
    
    safety_settings = [
        {
            "category": "HARM_CATEGORY_HARASSMENT",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "threshold": "BLOCK_NONE"
        },
    ]
    
    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        generation_config=generation_config,
        system_instruction="You are a helpful inventory management assistant.",
        safety_settings=safety_settings
    )
    
    # Send test message
    response = model.generate_content("Say 'Hello! I am working correctly.' in a friendly way.")
    
    if response.text:
        print(f"[SUCCESS] Model response: {response.text}")
    else:
        print(f"[ERROR] No text in response")
        print(f"Response details: {response}")
        
except Exception as e:
    print(f"[ERROR] {e}")
    print(f"\nError type: {type(e).__name__}")
    
    # Check for common issues
    error_str = str(e).upper()
    if "API_KEY" in error_str or "INVALID" in error_str:
        print("\n[SOLUTION] Your API key might be invalid. Please:")
        print("   1. Go to https://makersuite.google.com/app/apikey")
        print("   2. Create a new API key")
        print("   3. Update backend/.env with: GEMINI_API_KEY=your_new_key")
    elif "PERMISSION" in error_str or "ENABLE" in error_str:
        print("\n[SOLUTION] The Gemini API might not be enabled. Please:")
        print("   1. Go to https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com")
        print("   2. Enable the Generative Language API")
    elif "404" in error_str or "NOT_FOUND" in error_str:
        print("\n[SOLUTION] The model name might be incorrect.")
        print("   Available models: gemini-1.5-flash, gemini-1.5-pro, gemini-pro")
    elif "RESOURCE_EXHAUSTED" in error_str or "QUOTA" in error_str:
        print("\n[SOLUTION] Rate limit or quota exceeded. Wait a bit and try again.")
    
    import traceback
    print("\nFull traceback:")
    traceback.print_exc()
