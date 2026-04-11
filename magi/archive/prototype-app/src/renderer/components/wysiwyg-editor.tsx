import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: markdownToHtml(value),
    onUpdate: ({ editor }) => {
      onChange(htmlToMarkdown(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
  });

  // Sync external value changes (e.g. from AI tool calls)
  useEffect(() => {
    if (!editor) return;
    const current = htmlToMarkdown(editor.getHTML());
    if (current !== value) {
      editor.commands.setContent(markdownToHtml(value), false);
    }
  }, [value, editor]);

  return <EditorContent editor={editor} className={className} />;
}

// Minimal markdown → HTML (covers common cases)
function markdownToHtml(md: string): string {
  if (!md) return "";
  return md
    .split("\n\n")
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      // Headings
      if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.startsWith("# ")) return `<h1>${inline(block.slice(2))}</h1>`;
      // Task list (checkboxes)
      if (/^\[[ x]\] /.test(block)) {
        const items = block.split(/\n/).map((l) => {
          const checked = l.startsWith("[x] ");
          const text = l.replace(/^\[[ x]\] /, "");
          return `<li data-type="taskItem" data-checked="${checked}">${inline(text)}</li>`;
        });
        return `<ul data-type="taskList">${items.join("")}</ul>`;
      }
      // Unordered list
      if (/^[-*] /.test(block)) {
        const items = block.split(/\n/).map((l) => `<li>${inline(l.replace(/^[-*] /, ""))}</li>`);
        return `<ul>${items.join("")}</ul>`;
      }
      // Ordered list
      if (/^\d+\. /.test(block)) {
        const items = block.split(/\n/).map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`);
        return `<ol>${items.join("")}</ol>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join("");
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

// HTML → markdown
function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return nodeToMd(div).trim();
}

function nodeToMd(node: Node): string {
  let result = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent ?? "";
    } else if (child instanceof HTMLElement) {
      const tag = child.tagName.toLowerCase();
      const inner = nodeToMd(child);
      switch (tag) {
        case "p":
          result += inner + "\n\n";
          break;
        case "h1":
          result += `# ${inner}\n\n`;
          break;
        case "h2":
          result += `## ${inner}\n\n`;
          break;
        case "h3":
          result += `### ${inner}\n\n`;
          break;
        case "strong":
        case "b":
          result += `**${inner}**`;
          break;
        case "em":
        case "i":
          result += `*${inner}*`;
          break;
        case "code":
          result += `\`${inner}\``;
          break;
        case "ul":
          if (child.getAttribute("data-type") === "taskList") {
            for (const li of Array.from(child.children)) {
              const checked = (li as HTMLElement).getAttribute("data-checked") === "true";
              result += `[${checked ? "x" : " "}] ${nodeToMd(li).trim()}\n`;
            }
          } else {
            for (const li of Array.from(child.children)) {
              result += `- ${nodeToMd(li).trim()}\n`;
            }
          }
          result += "\n";
          break;
        case "ol": {
          let i = 1;
          for (const li of Array.from(child.children)) {
            result += `${i}. ${nodeToMd(li).trim()}\n`;
            i++;
          }
          result += "\n";
          break;
        }
        case "li":
        case "div":
        case "label":
        case "span":
          result += inner;
          break;
        case "br":
          result += "\n";
          break;
        case "input":
          break;
        default:
          result += inner;
      }
    }
  }
  return result;
}
