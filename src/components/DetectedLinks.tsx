import { LinkPreview } from "./LinkPreview";

interface DetectedLinksProps {
  text: string;
}

export function DetectedLinks({ text }: DetectedLinksProps) {
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s\)\]\>\"\'\,]+)/gi;
  
  const links: string[] = [];
  let match;
  urlRegex.lastIndex = 0;
  
  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[1].trim();
    // Remove trailing punctuation
    url = url.replace(/[.,;!?]+$/, '');
    url = url.replace(/[\)\]\>\"\']+$/, '');
    
    if (url && !links.includes(url)) {
      try {
        new URL(url); // Validate URL
        links.push(url);
      } catch {
        // Invalid URL, skip
      }
    }
  }

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {links.map((url, index) => {
        try {
          const urlObj = new URL(url);
          const displayText = urlObj.hostname.replace(/^www\./, '');
          return (
            <LinkPreview key={index} url={url}>
              {displayText}
            </LinkPreview>
          );
        } catch {
          return (
            <LinkPreview key={index} url={url}>
              {url.length > 30 ? url.substring(0, 30) + '...' : url}
            </LinkPreview>
          );
        }
      })}
    </div>
  );
}

