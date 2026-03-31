import { LLMS_TEXT } from "@/lib/site";

export function GET() {
  return new Response(LLMS_TEXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
