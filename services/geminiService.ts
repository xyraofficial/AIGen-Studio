
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { supabase } from '../lib/supabase';

// Fallback to env key if database fails/empty
const ENV_API_KEY = process.env.API_KEY;

/**
 * Fetches active API keys from Supabase.
 * Returns an array of key strings.
 */
async function getApiKeys(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('key_value')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
      // console.warn("Using fallback ENV key. DB Error:", error);
      return ENV_API_KEY ? [ENV_API_KEY] : [];
    }

    return data.map(k => k.key_value);
  } catch (err) {
    // console.error("Failed to fetch keys", err);
    return ENV_API_KEY ? [ENV_API_KEY] : [];
  }
}

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
 * Implements Fallback/Rotation Logic.
 */
export const streamChatResponse = async function* (
  modelId: string,
  history: { role: string; content: string; isError?: boolean }[],
  newMessage: string
) {
  const keys = await getApiKeys();
  
  if (keys.length === 0) {
    throw new Error("No API Configuration found.");
  }

  let lastError: any;

  // KEY ROTATION LOOP
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    
    try {
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

      // If we got here, connection is successful. 
      // Stream content.
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        yield {
          text: c.text || '',
          groundingMetadata: c.candidates?.[0]?.groundingMetadata
        };
      }

      // If successful completion, exit the loop
      return; 

    } catch (error: any) {
      lastError = error;
      
      // Only retry if it's a rate limit issue and we have more keys
      if (isRetryableError(error)) {
        console.warn(`Key ${i + 1}/${keys.length} exhausted. Switching to next key...`);
        continue; // Try next key
      }
      
      // If it's a prompt error or other logic error, throw immediately
      throw error;
    }
  }

  // If all keys failed
  throw new Error(`System Busy: All AI resources are currently overloaded. Please try again in a moment. (${lastError?.message || 'Unknown error'})`);
};

/**
 * Generates content for the Builder mode (Script generation) with streaming.
 * Implements Fallback/Rotation Logic.
 */
export const streamBuilderResponse = async function* (
  modelId: string,
  prompt: string,
  format: 'markdown' | 'json' | 'text' = 'markdown'
) {
  const keys = await getApiKeys();

  if (keys.length === 0) {
    throw new Error("No API Configuration found.");
  }

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

  // KEY ROTATION LOOP
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];

    try {
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
        console.warn(`Builder: Key ${i + 1}/${keys.length} exhausted. Switching...`);
        continue; 
      }
      throw error;
    }
  }

  throw new Error(`System Busy: All AI resources are exhausted. (${lastError?.message})`);
};
