import { readBooks, writeBooks, type Book } from "../lib/db";

export async function handleBooks(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // GET /api/books
  if (req.method === "GET" && url.pathname === "/api/books") {
    const books = await readBooks();
    return Response.json(books);
  }

  // POST /api/books — add a book (auto-assign next id)
  if (req.method === "POST" && url.pathname === "/api/books") {
    const body = (await req.json()) as Omit<Book, "id">;
    const books = await readBooks();
    const nextId = books.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const newBook: Book = { id: nextId, ...body };
    books.push(newBook);
    await writeBooks(books);
    return Response.json(newBook, { status: 201 });
  }

  // PUT /api/books/:id — update a book by id
  const putMatch = url.pathname.match(/^\/api\/books\/(\d+)$/);
  if (req.method === "PUT" && putMatch) {
    const id = parseInt(putMatch[1]!, 10);
    const books = await readBooks();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });
    const update = (await req.json()) as Partial<Book>;
    books[idx] = { ...books[idx]!, ...update, id }; // id is immutable
    await writeBooks(books);
    return Response.json(books[idx]);
  }

  // DELETE /api/books/:id — remove a book by id
  const deleteMatch = url.pathname.match(/^\/api\/books\/(\d+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = parseInt(deleteMatch[1]!, 10);
    const books = await readBooks();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });
    const [removed] = books.splice(idx, 1);
    await writeBooks(books);
    return Response.json(removed);
  }

  return new Response("Not found", { status: 404 });
}