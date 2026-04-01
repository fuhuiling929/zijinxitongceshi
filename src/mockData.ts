import { Transaction } from './types';
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear } from 'date-fns';

const sources = [
  '头条-巨量',
  '头条-千川',
  '头条-星图',
  '快手-磁力',
  '小米',
  '支付宝',
  '其他媒体',
  '外部借款',
  '运营成本',
  '其他费用'
];

const categoryNames: Record<string, string> = {
  media_bill: '媒体待付账单',
  ad_revenue: '广告业务待收',
  loan_receivable: '外部借款待收',
  loan_payable: '外部借款待付',
  forecast_sales: '预估销售额',
  forecast_admin: '行政费用预测'
};

export const getCategoryName = (cat: string) => categoryNames[cat] || cat;

const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const startDate = startOfYear(new Date());
  const endDate = endOfYear(new Date());

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    sources.forEach(source => {
      // Probability of having a transaction for this source on this day
      if (Math.random() > 0.7) {
        const isExpense = source.includes('费用') || source.includes('待付');
        const rand = Math.random();
        let status: Transaction['status'] = 'settled';
        if (rand > 0.6) status = 'pending';
        if (rand > 0.8) status = 'forecast';

        const amount = Math.floor(Math.random() * 1000000) + 10000;

        transactions.push({
          id: Math.random().toString(36).substr(2, 9),
          source,
          type: isExpense ? 'payable' : 'receivable',
          status,
          category: status === 'forecast' ? 'forecast_sales' : 'ad_revenue',
          amount,
          date: dateStr,
          description: `${source} 业务往来`,
          // Detailed fields for the table
          gap: Math.random() * -200000000,
          totalAmount: Math.random() * -1500000000,
          repayment: Math.random() * -1200000000,
          cash: Math.random() * -300000000,
          gapDays: (Math.random() * 10) - 5,
          totalArrival: Math.random() * 1200000000,
          prepayment: Math.random() * 600000000,
          shortTerm: Math.random() * 150000000,
          creditTerm: Math.random() * 400000000,
          historyRecovery: Math.random() * 150000000,
          advanceRecovery: Math.random() * 10000000,
          dailyAvgConsumption: Math.random() * 40000000,
          totalConsumption: Math.random() * 800000000,
          totalCredit: Math.random() * 900000000,
          baseCredit: Math.random() * 200000000,
          paymentGuarantee: Math.random() * 700000000
        });
      }
    });
  });

  return transactions;
};

export const mockTransactions = generateMockTransactions();
