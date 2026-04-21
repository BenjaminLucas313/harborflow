// Auth.js v5 catch-all route handler.
// `handlers` contains the GET and POST request handlers produced by NextAuth().
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
