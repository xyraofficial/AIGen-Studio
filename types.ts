
export enum AppMode {
  CHAT = 'CHAT',
  BUILDER = 'BUILDER',
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'coding' | 'fast';
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
  feedback?: 'like' | 'dislike';
  groundingMetadata?: any; // To store Google Search sources
}

export interface ScriptResult {
  code: string;
  explanation: string;
}

export type StreamChunk = {
  text: string;
  groundingMetadata?: any;
};

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  role: UserRole;
  email?: string;
}
