import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  url: string;
  children: React.ReactNode;
}

export function LinkPreview({ url, children }: LinkPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    title?: string;
    description?: string;
    image?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showPreview && !previewData) {
      setLoading(true);
      // Always use simple preview - API keys should not be exposed in frontend
      createSimplePreview();
    }
    
    function createSimplePreview() {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        setPreviewData({
          title: hostname,
          description: url,
          image: undefined
        });
      } catch {
        setPreviewData({
          title: url.length > 50 ? url.substring(0, 50) + '...' : url,
          description: '',
          image: undefined
        });
      }
      setLoading(false);
    }
  }, [showPreview, url, previewData]);

  return (
    <span className="relative inline-block">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        {children}
        <ExternalLink className="w-3 h-3" />
      </a>
      {showPreview && (
        <div
          className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
        >
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            </div>
          ) : previewData ? (
            <>
              {previewData.image && (
                <img
                  src={previewData.image}
                  alt={previewData.title}
                  className="w-full h-40 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="p-4">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                  {previewData.title}
                </h4>
                {previewData.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {previewData.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 truncate">
                  {url}
                </p>
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{url}</p>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

