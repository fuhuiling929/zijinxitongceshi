export type TransactionType = 'receivable' | 'payable';
export type TransactionStatus = 'settled' | 'pending' | 'forecast';
export type TransactionCategory = 
  | 'media_bill' 
  | 'ad_revenue' 
  | 'loan_receivable' 
  | 'loan_payable' 
  | 'forecast_sales' 
  | 'forecast_admin';

export interface Transaction {
  id: string;
  source: string;
  type: TransactionType;
  status: TransactionStatus;
  category: TransactionCategory;
  amount: number;
  date: string; // ISO format YYYY-MM-DD
  description: string;
  // Optional fields for detailed view matching the reference image
  gap?: number;
  totalAmount?: number;
  repayment?: number;
  cash?: number;
  gapDays?: number;
  totalArrival?: number;
  dailyAvgConsumption?: number;
  totalCredit?: number;
  prepayment?: number;
  shortTerm?: number;
  creditTerm?: number;
  historyRecovery?: number;
  advanceRecovery?: number;
  totalConsumption?: number;
  baseCredit?: number;
  paymentGuarantee?: number;
}

export interface ForecastConfig {
  source: string;
  dailyAvgConsumption: number;
}

export interface DailySummary {
  date: string;
  totalReceivable: number;
  totalPayable: number;
  transactions: Transaction[];
}

export interface MonthlySummaryData {
  month: string; // YYYY-MM
  knownReceivable: number;
  knownPayable: number;
  forecastReceivable: number;
  forecastPayable: number;
  netFlow: number;
}
