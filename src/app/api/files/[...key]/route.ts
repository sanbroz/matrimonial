import { getCurrentUser } from "@/lib/auth/server";
import { readUpload } from "@/lib/storage";

// Private files (photos, kundli, logo): only signed-in staff can read them.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { key } = await params;
  let file;
  try {
    file = await readUpload(key.join("/"));
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
