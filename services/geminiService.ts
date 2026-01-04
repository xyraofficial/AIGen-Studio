import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

/**
 * Creates a chat session and returns a generator for streaming responses.
 */
export const streamChatResponse = async function* (
  modelId: string,
  history: { role: string; content: string; isError?: boolean }[],
  newMessage: string
) {
  // Per guidelines: The API key must be obtained exclusively from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
};

/**
 * Generates content for the Builder mode (Script generation) with streaming.
 */
export const streamBuilderResponse = async function* (
  modelId: string,
  prompt: string,
  format: 'markdown' | 'json' | 'text' = 'markdown'
) {
  // Per guidelines: The API key must be obtained exclusively from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
};
