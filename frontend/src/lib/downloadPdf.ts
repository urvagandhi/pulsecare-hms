import api from './api';
import toast from 'react-hot-toast';

/**
 * Downloads a PDF via authenticated axios request and triggers browser download.
 */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  try {
    const response = await api.get(path, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  } catch (err) {
    const errorMsg =
      (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
      'Failed to download PDF';
    toast.error(errorMsg);
  }
}
