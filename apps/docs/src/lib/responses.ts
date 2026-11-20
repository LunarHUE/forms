export const markdownResponse = (body: string): Response =>
  new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });

export const textResponse = (body: string, type = "text/plain"): Response =>
  new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8` } });
