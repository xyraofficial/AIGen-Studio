import { ModelConfig } from './types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash',
    description: 'Ultra-fast, low latency, great for general tasks and quick chats.',
    category: 'fast',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Reasoning expert. Best for complex coding, math, and logic.',
    category: 'coding',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Latest)',
    description: 'Balanced performance for high-volume tasks.',
    category: 'general',
  }
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;

export const BUILDER_TEMPLATES = [
  {
    id: 'react-component',
    label: 'React Component',
    prompt: 'Create a reusable React component for a [Feature Name] using Tailwind CSS. Include props for customization and ensure it is accessible.'
  },
  {
    id: 'api-endpoint',
    label: 'Node.js API Endpoint',
    prompt: 'Write an Express.js API route handler for [Functionality]. Include input validation using Zod, error handling, and TypeScript types.'
  },
  {
    id: 'sql-query',
    label: 'Complex SQL Query',
    prompt: 'Write a SQL query to select [Data] from [Table] where [Condition]. Include joins with [Related Table] and optimize for performance.'
  },
  {
    id: 'python-script',
    label: 'Python Data Processing',
    prompt: 'Write a Python script using Pandas to read a CSV file, clean the data by removing nulls, and calculate the average of [Column].'
  },
  {
    id: 'unit-test',
    label: 'Unit Tests',
    prompt: 'Write comprehensive unit tests for the following code using Jest and React Testing Library: \n\n[Paste Code Here]'
  },
  {
    id: 'regex-generator',
    label: 'Regex Generator',
    prompt: 'Create a Regular Expression to match [Pattern Description, e.g., Email, Date]. Explain how each part of the regex works.'
  }
];