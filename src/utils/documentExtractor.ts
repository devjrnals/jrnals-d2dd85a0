import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker
// Use jsdelivr CDN which is more reliable for worker files
if (typeof window !== 'undefined') {
  const version = pdfjsLib.version || '5.4.530';
  // Use .js format which is more widely available
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`;
}

/**
 * Extract text from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Ensure worker is configured (fallback if not set at module level)
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const version = pdfjsLib.version || '5.4.530';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`;
    }
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0, // Suppress console warnings
    });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0)
        .join(' ');
      if (pageText.trim()) {
        fullText += pageText + '\n\n';
      }
    }
    
    const result = fullText.trim();
    if (!result) {
      throw new Error('No text content found in PDF');
    }
    
    return result;
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    throw new Error(`Failed to extract text from PDF file: ${errorMessage}`);
  }
}

/**
 * Extract text from a Word document (.docx)
 */
export async function extractTextFromWord(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

/**
 * Extract text from a PowerPoint presentation (.pptx)
 * PPTX files are ZIP archives containing XML files
 */
export async function extractTextFromPowerPoint(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let fullText = '';
    
    // Read slide XML files (they're in ppt/slides/slide*.xml)
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort((a, b) => {
        // Sort by slide number
        const aNum = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return aNum - bNum;
      });
    
    for (let i = 0; i < slideFiles.length; i++) {
      const slideXml = await zip.files[slideFiles[i]].async('string');
      fullText += `--- Slide ${i + 1} ---\n\n`;
      
      // Extract text from XML using regex
      // PowerPoint XML uses <a:t> tags for text content
      const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
      if (textMatches) {
        textMatches.forEach((match: string) => {
          const textMatch = match.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
          if (textMatch && textMatch[1]) {
            const text = textMatch[1].trim();
            if (text) {
              fullText += text + '\n';
            }
          }
        });
      }
      
      fullText += '\n';
    }
    
    return fullText.trim() || 'No text content found in presentation';
  } catch (error) {
    console.error('Error extracting text from PowerPoint:', error);
    throw new Error('Failed to extract text from PowerPoint presentation');
  }
}

/**
 * Extract text from various document types
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  // PDF files
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    return await extractTextFromPDF(file);
  }
  
  // Word documents (.docx only - .doc is binary and not supported)
  if (
    fileName.endsWith('.docx') ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractTextFromWord(file);
  }
  
  // Old Word format (.doc) - not supported, suggest conversion
  if (fileName.endsWith('.doc') || fileType === 'application/msword') {
    throw new Error('Old Word format (.doc) is not supported. Please convert to .docx format first.');
  }
  
  // PowerPoint presentations (.pptx only - .ppt is binary and not supported)
  if (
    fileName.endsWith('.pptx') ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return await extractTextFromPowerPoint(file);
  }
  
  // Old PowerPoint format (.ppt) - not supported, suggest conversion
  if (fileName.endsWith('.ppt') || fileType === 'application/vnd.ms-powerpoint') {
    throw new Error('Old PowerPoint format (.ppt) is not supported. Please convert to .pptx format first.');
  }
  
  // Fallback to text reading for other files
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

