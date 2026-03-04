export type ContentType = 'text' | 'image';

export interface ClipboardItem {
  id: string;
  content_type: ContentType;
  text_content: string | null;
  image_data: string | null;
  preview: string;
  is_favorite: boolean;
  created_at: number;
  updated_at: number;
}

export interface ClipboardItemPreview {
  id: string;
  content_type: ContentType;
  preview: string;
  created_at: number;
  updated_at: number;
  is_favorite: boolean;
}