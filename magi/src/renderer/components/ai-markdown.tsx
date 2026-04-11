import { Streamdown } from "streamdown";

interface AiMarkdownProps {
  children: string;
  isStreaming?: boolean;
}

export function AiMarkdown({ children, isStreaming }: AiMarkdownProps) {
  return (
    <Streamdown
      className="text-[13px] leading-relaxed"
      shikiTheme={["github-dark", "github-dark"]}
      isAnimating={Boolean(isStreaming)}
      animated={{ animation: "blurIn", sep: "word" }}
      controls={{ code: true, table: false, mermaid: false }}
    >
      {children}
    </Streamdown>
  );
}
