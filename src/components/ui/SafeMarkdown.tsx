"use client";

// SafeMarkdown — sanitizes AI-generated markdown before rendering.
//
// DOMPurify strips any HTML that could carry XSS payloads before ReactMarkdown
// parses the content. The typeof window guard is required because DOMPurify
// needs the browser DOM API — during SSR the raw string is passed through
// (server-side rendering is not a XSS vector for the end user).

import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "code", "pre", "blockquote",
  "a", "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export function SafeMarkdown({
  content,
  components,
}: {
  content:     string;
  components?: Components;
}) {
  const clean =
    typeof window !== "undefined"
      ? DOMPurify.sanitize(content, { ALLOWED_TAGS, ALLOWED_ATTR })
      : content;

  return <ReactMarkdown components={components}>{clean}</ReactMarkdown>;
}
