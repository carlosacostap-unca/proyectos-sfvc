'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill-new/dist/quill.snow.css';

// Dynamic import to avoid SSR issues with Quill
const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false,
  loading: () => <div className="h-32 w-full bg-gray-50 dark:bg-zinc-800 animate-pulse rounded-lg" />
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ],
  }), []);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list',
    'link'
  ];

  return (
    <div className={`rich-text-editor ${className || ''}`}>
      <style jsx global>{`
        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          border-color: #e5e7eb !important;
          background-color: #f9fafb;
        }
        .dark .ql-toolbar {
          border-color: #27272a !important;
          background-color: #27272a;
        }
        .dark .ql-stroke {
          stroke: #a1a1aa !important;
        }
        .dark .ql-fill {
          fill: #a1a1aa !important;
        }
        .dark .ql-picker {
          color: #a1a1aa !important;
        }
        
        .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: #e5e7eb !important;
          font-family: inherit !important;
          font-size: 0.875rem !important;
        }
        .dark .ql-container {
          border-color: #27272a !important;
          background-color: #18181b; /* zinc-900 */
          color: #e4e4e7; /* zinc-200 */
        }
        
        .ql-editor {
          min-height: 100px;
        }
        .ql-editor.ql-blank::before {
          color: #9ca3af !important;
          font-style: normal !important;
        }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}