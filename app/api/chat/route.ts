import { handleChat } from '@/lib/ask-ai';

export function POST(req: Request) {
  return handleChat(req);
}
