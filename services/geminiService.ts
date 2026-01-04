
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

// Pool of API keys for rotation and fallback
const API_KEYS = [
  "AIzaSyC2tVIDKMLP3pZgwhLLUXVxqQXZRmlGW5o",
  "AIzaSyB6KGkg2a9bggeoLp9S36kacBJtZBZKyCc",
  "AIzaSyAJDk1xyqT6XgUl3KpMzpoaQHjGnPw7hQM",
  "AIzaSyC5V3qs13daQw9xr8HSL48LC1XTvjcfMnM"
];

// Simple in-memory health tracker for the admin panel
// status: 'operational' | 'limited' | 'error'
const keyHealth = new Map<number, { status: string; lastUsed: number; errors: number }>();

// Initialize health map
API_KEYS.forEach((_, idx) => {
    keyHealth.set(idx, { status: 'operational', lastUsed: 0, errors: 0 });
});

export const getKeyStatus = () => {
    return API_KEYS.map((key, index) => {
        const health = keyHealth.get(index) || { status: 'operational', lastUsed: 0, errors: 0 };
        // Mask the key for display
        const masked = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
        return {
            index,
            key: masked,
            ...health
        };
    });
};

const updateKeyHealth = (index: number, status: 'operational' | 'limited' | 'error') => {
    const current = keyHealth.get(index) || { status: 'operational', lastUsed: 0, errors: 0 };
    keyHealth.set(index, {
        status,
        lastUsed: Date.now(),
        errors: status !== 'operational' ? current.errors + 1 : current.errors
    });
};

// Helper to safely get an environment variable or fallback to the pool
const getApiKey = (index: number): string => {
  // Try process.env first (if configured in Vite/Cloudflare)
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  return API_KEYS[index % API_KEYS.length];
};

/**
 * Helper to determine if an error is a rate limit or capacity issue
 */
function isRetryableError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;
  
  return (
    status === 429 || // Too Many Requests
    status === 503 || // Service Unavailable
    msg.includes('resource exhausted') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('too many requests')
  );
}

/**
 * Creates a chat session and returns a generator for streaming responses.
 * Implements Key Rotation Logic.
 */
export const streamChatResponse = async function* (
  modelId: string,
  history: { role: string; content: string; isError?: boolean }[],
  newMessage: string
) {
  let lastError: any;

  // Try each key in the pool until one works
  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = getApiKey(i);
    
    try {
      updateKeyHealth(i, 'operational'); // Mark attempted use
      
      const ai = new GoogleGenAI({ apiKey: currentKey });

      // Filter out error messages from history
      const validHistory = history
        .filter(msg => !msg.isError && msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));

      const chat: Chat = ai.chats.create({
        model: modelId,
        history: validHistory,
        config: {
          temperature: 0.7,
          maxOutputTokens: 1000,
          systemInstruction: "You are an expert developer assistant. When asked for code or scripts (especially Bash/Shell), provide the full, clean, executable code in a single block first. Use automation flags (e.g. -y) where possible. Always format code blocks with the correct language tag. Ensure there is a newline before and after the code block content.\nDo not produce malformed markdown.",
          tools: [{ googleSearch: {} }],
        }
      });

      const result = await chat.sendMessageStream({ message: newMessage });

      // Stream content.
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        yield {
          text: c.text || '',
          groundingMetadata: c.candidates?.[0]?.groundingMetadata
        };
      }

      return; // Success, exit the loop

    } catch (error: any) {
      lastError = error;
      
      // Only retry if it's a rate limit issue
      if (isRetryableError(error)) {
        console.warn(`Key ${i + 1}/${API_KEYS.length} exhausted. Switching to next key...`);
        updateKeyHealth(i, 'limited');
        continue;
      }
      
      updateKeyHealth(i, 'error');
      // If it's a different error (e.g., bad request), throw immediately
      throw error;
    }
  }

  throw new Error(`System Busy: All AI resources are currently overloaded. (${lastError?.message || 'Unknown error'})`);
};

/**
 * Generates content for the Builder mode (Script generation) with streaming.
 * Implements Key Rotation Logic.
 */
export const streamBuilderResponse = async function* (
  modelId: string,
  prompt: string,
  format: 'markdown' | 'json' | 'text' = 'markdown'
) {
  let formatInstruction = "";
  switch (format) {
    case 'json':
      formatInstruction = "OUTPUT FORMAT: JSON. Return ONLY a valid JSON object wrapped in a markdown code block (```json).";
      break;
    case 'text':
      formatInstruction = "OUTPUT FORMAT: Plain Text. Return RAW TEXT content only. NO Markdown.";
      break;
    default: 
      formatInstruction = "OUTPUT FORMAT: Markdown. Provide the solution primarily as a SINGLE COMPLETE CODE BLOCK.";
      break;
  }

  const systemInstruction = `You are an expert Senior Software Engineer and AI Code Architect.
    Your Task: Generate high-quality, production-ready content based on the user's request.
    Rules:
    1. ${formatInstruction}
    2. CONTENT: Prioritize code/script. 
    3. FOR BASH/SHELL: Output a single, consolidated script (#!/bin/bash). Use flags (e.g., -y) to automate.
    4. ACCURACY: Ensure correct syntax.
    `;

  let lastError: any;

  // Try each key in the pool
  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = getApiKey(i);

    try {
      updateKeyHealth(i, 'operational');
      const ai = new GoogleGenAI({ apiKey: currentKey });

      const result = await ai.models.generateContentStream({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, 
          maxOutputTokens: 4000, 
        }
      });

      for await (const chunk of result) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            yield c.text;
          }
      }

      return; // Success

    } catch (error: any) {
      lastError = error;

      if (isRetryableError(error)) {
        console.warn(`Builder: Key ${i + 1}/${API_KEYS.length} exhausted. Switching...`);
        updateKeyHealth(i, 'limited');
        continue; 
      }
      updateKeyHealth(i, 'error');
      throw error;
    }
  }

  throw new Error(`System Busy: All AI resources are exhausted. (${lastError?.message})`);
};
