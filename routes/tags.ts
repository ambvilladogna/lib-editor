import { readConfig, writeConfig, readBooks, writeBooks, type TagMeta } from "../lib/db";

export async function handleTags(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // POST /api/tags — add a new tag
  if (req.method === "POST" && url.pathname === "/api/tags") {
    const body = (await req.json()) as { id?: string; label: string; description?: string };
    const label = body.label?.trim();
    if (!label) return new Response("label is required", { status: 400 });

    const config = await readConfig();
    const id = body.id?.trim() || _slugify(label);

    if (config.tags.some((t) => t.id === id)) {
      return new Response("tag id already exists", { status: 409 });
    }

    const newTag: TagMeta = { id, label, description: body.description?.trim() };
    config.tags.push(newTag);
    await writeConfig(config);
    return Response.json(newTag, { status: 201 });
  }

  // PUT /api/tags/:id — rename a tag label and cascade to all books
  const putMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/);
  if (req.method === "PUT" && putMatch) {
    const id = decodeURIComponent(putMatch[1]!);
    const body = (await req.json()) as { label?: string; description?: string };
    const newLabel = body.label?.trim();
    if (!newLabel) return new Response("label is required", { status: 400 });

    const config = await readConfig();
    const idx = config.tags.findIndex((t) => t.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });

    const oldLabel = config.tags[idx]!.label;
    config.tags[idx] = {
      ...config.tags[idx]!,
      label: newLabel,
      description: body.description?.trim() ?? config.tags[idx]!.description,
    };

    // Cascade: update every book that carries the old label
    let affectedCount = 0;
    if (oldLabel !== newLabel) {
      const books = await readBooks();
      for (const book of books) {
        const tagIdx = book.tags.indexOf(oldLabel);
        if (tagIdx !== -1) {
          book.tags[tagIdx] = newLabel;
          affectedCount++;
        }
      }
      await writeBooks(books);
    }

    await writeConfig(config);
    return Response.json({ tag: config.tags[idx], affectedBooks: affectedCount });
  }

  // DELETE /api/tags/:id — remove a tag and strip it from all books
  const deleteMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1]!);

    const config = await readConfig();
    const idx = config.tags.findIndex((t) => t.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });

    const [removed] = config.tags.splice(idx, 1);
    const removedLabel = removed!.label;

    // Cascade: strip the tag from every book that has it
    const books = await readBooks();
    let affectedCount = 0;
    for (const book of books) {
      const before = book.tags.length;
      book.tags = book.tags.filter((t) => t !== removedLabel);
      if (book.tags.length !== before) affectedCount++;
    }
    await writeBooks(books);
    await writeConfig(config);

    return Response.json({ removed, affectedBooks: affectedCount });
  }

  return new Response("Not found", { status: 404 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}