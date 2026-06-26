export type Category = '식비' | '교통' | '쇼핑' | '의료' | '생활' | '여가' | '기타';
export type TransactionType = '지출' | '입금';
export type PaymentMethod = '현금' | '카드' | '계좌이체' | '기타';

export interface Transaction {
  id: string;
  date: string;           // 'YYYY-MM-DD'
  category: Category;
  content: string;
  amount: number;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  createdAt: number;
}

export interface AppSettings {
  claudeApiKey: string;
}

export interface ExtractedFields {
  date?: string | null;
  category?: Category | null;
  content?: string | null;
  amount?: number | null;
  type?: TransactionType | null;
  paymentMethod?: PaymentMethod | null;
}

export type View = 'list' | 'add' | 'settings';
