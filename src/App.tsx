/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  startOfDay,
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfYear,
  eachMonthOfInterval,
  endOfYear
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Calendar as CalendarIcon,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Settings2,
  Plus,
  X,
  Save,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Transaction, TransactionType, ForecastConfig } from './types';
import { mockTransactions, getCategoryName } from './mockData';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TOOLTIPS: Record<string, string> = {
  gap: "资金缺口：到款总额-付款总额",
  totalAmount: "付款总额：还款+现金充值",
  repayment: "还款：媒体账单还款",
  cash: "现金：媒体预充值现金+其他业务付款",
  totalArrival: "到款总额：预付款+短期+后付+历史逾期回款+提前回款",
  prepayment: "预付款：已到款+近7日消耗本月剩余天数预付款比例",
  shortTerm: "短期：已到款+近7日消耗本月剩余天数短期比例",
  creditTerm: "后付：已到款+未到款后付金额上月回款比例",
  historyRecovery: "历史逾期：根据每个客户历史回款日期预估回款日期+手动标识",
  advanceRecovery: "提前回款：实际提前回款+手动标识",
  mediaArrival: "媒体到款：媒体返现+媒体退款",
  dailyAvgConsumption: "日均消耗：上月日均",
  totalConsumption: "总消耗：当月=已消耗+近7日均消耗剩余天数；后续月份=近7日消耗*天数；",
  totalCredit: "总授信：常规授信+担保授信",
  baseCredit: "常规授信：当月=已确认授信；后续月份=预估授信",
  paymentGuarantee: "担保授信：当月=已确认授信；后续月份=上月授信",
  mediaCurrentBalance: "当前余额：每日统计媒体后台代理商和投放户余额",
  availableDays: "可用天数：当前结余/剩余天数",
  gapDays: "缺口天数：资金缺口/日均消耗",
};

export default function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // State for dynamic data
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [forecastConfigs, setForecastConfigs] = useState<ForecastConfig[]>([
    { source: '头条-巨量', dailyAvgConsumption: 38000000 },
    { source: '头条-千川', dailyAvgConsumption: 23000000 },
  ]);

  // --- Data Processing ---
  
  const yearlyMonths = useMemo(() => {
    const start = startOfYear(currentMonth);
    const end = endOfYear(currentMonth);
    return eachMonthOfInterval({ start, end });
  }, [currentMonth]);

  const monthlySummaries = useMemo(() => {
    const today = new Date();
    return yearlyMonths.map(month => {
      const monthTrans = transactions.filter(t => isSameMonth(new Date(t.date), month));
      
      const settledRec = monthTrans.filter(t => t.type === 'receivable' && t.status === 'settled').reduce((sum, t) => sum + t.amount, 0);
      const settledPay = monthTrans.filter(t => t.type === 'payable' && t.status === 'settled').reduce((sum, t) => sum + t.amount, 0);
      const pendingRec = monthTrans.filter(t => t.type === 'receivable' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
      const pendingPay = monthTrans.filter(t => t.type === 'payable' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
      const forecastRec = monthTrans.filter(t => t.type === 'receivable' && t.status === 'forecast').reduce((sum, t) => sum + t.amount, 0);
      const forecastPay = monthTrans.filter(t => t.type === 'payable' && t.status === 'forecast').reduce((sum, t) => sum + t.amount, 0);

      const monthlyRec = settledRec + pendingRec;
      const monthlyPay = settledPay + pendingPay;
      
      const totalMonthlyRec = monthlyRec + forecastRec;
      const totalMonthlyPay = monthlyPay + forecastPay;

      let balance = 0;
      const isPast = month < startOfMonth(today);
      const isCurrent = isSameMonth(month, today);
      const isFuture = month > startOfMonth(today);

      if (isPast) {
        balance = monthlyRec - monthlyPay;
      } else {
        balance = totalMonthlyRec - totalMonthlyPay;
      }
      
      return {
        month,
        settledRec,
        settledPay,
        pendingRec,
        pendingPay,
        forecastRec,
        forecastPay,
        monthlyRec,
        monthlyPay,
        totalMonthlyRec,
        totalMonthlyPay,
        balance,
        isPast,
        isCurrent,
        isFuture
      };
    });
  }, [yearlyMonths, transactions]);

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth)),
      end: endOfWeek(endOfMonth(currentMonth))
    });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTransactions = transactions.filter(t => t.date === dayStr);
      const rec = dayTransactions.filter(t => t.type === 'receivable').reduce((sum, t) => sum + t.amount, 0);
      const pay = dayTransactions.filter(t => t.type === 'payable').reduce((sum, t) => sum + t.amount, 0);
      
      return {
        date: day,
        receivable: rec,
        payable: pay,
        balance: rec - pay,
        isCurrentMonth: isSameMonth(day, currentMonth),
        transactions: dayTransactions
      };
    });
  }, [currentMonth, transactions]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return transactions.filter(t => isSameDay(new Date(t.date), selectedDate));
  }, [selectedDate, transactions]);

  const today = startOfDay(new Date());
  const isPastMonth = viewMode === 'month' && currentMonth < startOfMonth(today);
  const isCurrentOrFutureMonth = viewMode === 'month' && currentMonth >= startOfMonth(today);
  const isPastDay = viewMode === 'day' && selectedDate && selectedDate < today;
  const isFutureOrCurrentDay = viewMode === 'day' && selectedDate && selectedDate >= today;

  const aggregatedDetails = useMemo(() => {
    let targetTrans: Transaction[] = [];
    if (viewMode === 'month') {
      targetTrans = transactions.filter(t => isSameMonth(new Date(t.date), currentMonth));
    } else if (selectedDate) {
      targetTrans = transactions.filter(t => isSameDay(new Date(t.date), selectedDate));
    }

    // Group by source
    const groups: Record<string, any> = {};
    targetTrans.forEach(t => {
      if (!groups[t.source]) {
        groups[t.source] = {
          source: t.source,
          gap: 0,
          totalAmount: 0,
          repayment: 0,
          cash: 0,
          gapDays: 0,
          totalArrival: 0,
          prepayment: 0,
          shortTerm: 0,
          creditTerm: 0,
          historyRecovery: 0,
          advanceRecovery: 0,
          dailyAvgConsumption: 0,
          totalConsumption: 0,
          totalCredit: 0,
          baseCredit: 0,
          paymentGuarantee: 0,
          mediaArrival: 0,
          mediaCurrentBalance: 0,
          availableDays: 0,
          count: 0
        };
      }
      const g = groups[t.source];
      g.gap += t.gap || 0;
      g.totalAmount += t.totalAmount || 0;
      g.repayment += t.repayment || 0;
      g.cash += t.cash || 0;
      g.gapDays += t.gapDays || 0;
      g.totalArrival += t.totalArrival || 0;
      g.prepayment += t.prepayment || 0;
      g.shortTerm += t.shortTerm || 0;
      g.creditTerm += t.creditTerm || 0;
      g.historyRecovery += t.historyRecovery || 0;
      g.advanceRecovery += t.advanceRecovery || 0;
      g.dailyAvgConsumption += t.dailyAvgConsumption || 0;
      g.totalConsumption += t.totalConsumption || 0;
      g.totalCredit += t.totalCredit || 0;
      g.baseCredit += t.baseCredit || 0;
      g.paymentGuarantee += t.paymentGuarantee || 0;
      g.mediaArrival += t.mediaArrival || 0;
      g.mediaCurrentBalance += t.mediaCurrentBalance || 0;
      g.availableDays += t.availableDays || 0;
      g.count += 1;
    });

    // Average gapDays and availableDays
    Object.values(groups).forEach((g: any) => {
      if (g.count > 0) {
        g.gapDays = g.gapDays / g.count;
        g.availableDays = g.availableDays / g.count;
      }
    });

    let result = Object.values(groups);

    // Apply filter
    if (sourceFilter) {
      result = result.filter(g => g.source.toLowerCase().includes(sourceFilter.toLowerCase()));
    }

    // Apply sort
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [viewMode, currentMonth, selectedDate, transactions, sourceFilter, sortConfig]);

  const totals = useMemo(() => {
    const t = {
      gap: 0,
      totalAmount: 0,
      repayment: 0,
      cash: 0,
      gapDays: 0,
      totalArrival: 0,
      prepayment: 0,
      shortTerm: 0,
      creditTerm: 0,
      historyRecovery: 0,
      advanceRecovery: 0,
      dailyAvgConsumption: 0,
      totalConsumption: 0,
      totalCredit: 0,
      baseCredit: 0,
      paymentGuarantee: 0,
      mediaArrival: 0,
      mediaCurrentBalance: 0,
      availableDays: 0,
    };
    aggregatedDetails.forEach(g => {
      t.gap += g.gap;
      t.totalAmount += g.totalAmount;
      t.repayment += g.repayment;
      t.cash += g.cash;
      t.gapDays += g.gapDays;
      t.totalArrival += g.totalArrival;
      t.prepayment += g.prepayment;
      t.shortTerm += g.shortTerm;
      t.creditTerm += g.creditTerm;
      t.historyRecovery += g.historyRecovery;
      t.advanceRecovery += g.advanceRecovery;
      t.dailyAvgConsumption += g.dailyAvgConsumption;
      t.totalConsumption += g.totalConsumption;
      t.totalCredit += g.totalCredit;
      t.baseCredit += g.baseCredit;
      t.paymentGuarantee += g.paymentGuarantee;
      t.mediaArrival += g.mediaArrival;
      t.mediaCurrentBalance += g.mediaCurrentBalance;
      t.availableDays += g.availableDays;
    });
    if (aggregatedDetails.length > 0) {
      t.gapDays = t.gapDays / aggregatedDetails.length;
      t.availableDays = t.availableDays / aggregatedDetails.length;
    }
    return t;
  }, [aggregatedDetails]);

  // --- Handlers ---

  const toggleSort = (key: string) => {
    const numericFields = [
      'gap', 'totalAmount', 'repayment', 'cash', 'gapDays', 'totalArrival', 
      'prepayment', 'shortTerm', 'creditTerm', 'historyRecovery', 'advanceRecovery',
      'dailyAvgConsumption', 'totalConsumption', 'totalCredit', 'baseCredit', 
      'paymentGuarantee', 'mediaArrival', 'mediaCurrentBalance', 'availableDays'
    ];
    if (!numericFields.includes(key)) return;

    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('zh-CN', { 
      style: 'currency', 
      currency: 'CNY', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val);
  };

  const formatWan = (val: number) => {
    return new Intl.NumberFormat('zh-CN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val / 10000) + ' 万元';
  };

  const handleAddTransaction = (newT: Partial<Transaction>) => {
    const t: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      source: newT.source || '手动新增',
      type: newT.type || 'receivable',
      status: newT.status || 'settled',
      category: newT.type === 'receivable' ? 'ad_revenue' : 'media_bill',
      amount: newT.amount || 0,
      date: newT.date || format(new Date(), 'yyyy-MM-dd'),
      description: newT.description || '手动录入款项',
    };
    setTransactions(prev => [...prev, t]);
    setIsAddItemOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <TrendingUp size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">集团资金管理系统</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Real-time Capital Monitor</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-2xl p-1 border border-gray-200">
            <button 
              onClick={() => setViewMode('month')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'month' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              按月
            </button>
            <button 
              onClick={() => setViewMode('day')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'day' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              按日
            </button>
          </div>

          <div className="flex items-center bg-gray-100 rounded-2xl p-1.5 border border-gray-200">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-600"><ChevronLeft size={20} /></button>
            <span className="px-6 font-black text-sm min-w-[120px] text-center">{format(currentMonth, 'yyyy年 MM月', { locale: zhCN })}</span>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-600"><ChevronRight size={20} /></button>
          </div>
          
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Settings2 size={18} className="text-indigo-600" />
            预估配置
          </button>
          
          <button 
            onClick={() => setIsAddItemOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={18} />
            新增款项
          </button>
        </div>
      </header>

      <main className="p-8 space-y-10">
        
        {/* Layer 1: Yearly Monthly Overview */}
        {viewMode === 'month' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                年度收支概览 ({format(currentMonth, 'yyyy')})
              </h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {monthlySummaries.map((m, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "min-w-[420px] bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col gap-4 relative overflow-hidden group transition-all hover:shadow-lg",
                    isSameMonth(m.month, currentMonth) && "ring-2 ring-indigo-600 ring-offset-4 border-transparent"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-gray-400">{format(m.month, 'MM月')}</span>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      m.balance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {m.balance >= 0 ? '盈余' : '缺口'}
                    </div>
                  </div>

                  {/* Top Row: Totals and Balance */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest" title="本月总应收">本月总应收</p>
                      <p className="text-sm font-black font-mono text-gray-900" title={formatCurrency(m.totalMonthlyRec)}>{formatWan(m.totalMonthlyRec)}</p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest" title="本月总应付">本月总应付</p>
                      <p className="text-sm font-black font-mono text-gray-900" title={formatCurrency(m.totalMonthlyPay)}>{formatWan(m.totalMonthlyPay)}</p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest" title={m.balance >= 0 ? "盈余" : "缺口"}>
                        {m.balance >= 0 ? "盈余" : "缺口"}
                      </p>
                      <p className={cn(
                        "text-sm font-black font-mono",
                        m.balance >= 0 ? "text-emerald-600" : "text-rose-600"
                      )} title={formatCurrency(m.balance)}>
                        {formatWan(m.balance)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-50">
                    {/* Details Section */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50/50">
                      <div className="space-y-2 min-w-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">实际应收明细</p>
                        <div className="space-y-1 pl-1 border-l-2 border-gray-100">
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-[9px] text-gray-400 font-bold shrink-0">已收:</span>
                            <span className="text-[10px] font-bold font-mono text-emerald-600" title={formatCurrency(m.settledRec)}>{formatWan(m.settledRec)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-[9px] text-gray-400 font-bold shrink-0">未收:</span>
                            <span className="text-[10px] font-bold font-mono text-emerald-400" title={formatCurrency(m.pendingRec)}>{formatWan(m.pendingRec)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 min-w-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">实际应付明细</p>
                        <div className="space-y-1 pl-1 border-l-2 border-gray-100">
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-[9px] text-gray-400 font-bold shrink-0">已付:</span>
                            <span className="text-[10px] font-bold font-mono text-rose-600" title={formatCurrency(m.settledPay)}>{formatWan(m.settledPay)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-[9px] text-gray-400 font-bold shrink-0">未付:</span>
                            <span className="text-[10px] font-bold font-mono text-rose-400" title={formatCurrency(m.pendingPay)}>{formatWan(m.pendingPay)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isSameMonth(m.month, currentMonth) && (
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-50 rounded-full -z-10 opacity-50"></div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {viewMode === 'day' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Layer 2: Calendar View */}
            <section className="xl:col-span-12 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  资金收支日历
                </h2>
                <div className="flex gap-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> 应收</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></span> 待付</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm"></span> 盈余/缺口</div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="py-5 text-center text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {dailyData.map((day, idx) => {
                    const balance = day.receivable - day.payable;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(day.date)}
                        className={cn(
                          "min-h-[140px] p-3 border-r border-b border-gray-50 flex flex-col items-start transition-all hover:bg-indigo-50/30 group relative",
                          !day.isCurrentMonth && "bg-gray-50/30 opacity-20",
                          selectedDate && isSameDay(day.date, selectedDate) && "bg-indigo-50/50 ring-2 ring-inset ring-indigo-500/20"
                        )}
                      >
                        <div className="w-full flex justify-start items-start">
                          <span className={cn(
                            "text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl transition-all",
                            isSameDay(day.date, new Date()) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-700 group-hover:text-indigo-600"
                          )}>
                            {format(day.date, 'd')}
                          </span>
                        </div>

                        <div className="flex-1 w-full flex items-center justify-center py-1">
                          <span className={cn(
                            "text-sm font-black font-mono",
                            balance >= 0 ? "text-indigo-600" : "text-rose-600"
                          )}>
                            {formatCurrency(balance)}
                          </span>
                        </div>
                        
                        <div className="w-full space-y-1 mt-auto">
                          <div className="text-[9px] font-black text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded-md flex justify-between items-center border border-emerald-100">
                            <span>收</span>
                            <span className="font-mono">{formatCurrency(day.receivable)}</span>
                          </div>
                          <div className="text-[9px] font-black text-rose-600 bg-rose-50/80 px-1.5 py-0.5 rounded-md flex justify-between items-center border border-rose-100">
                            <span>付</span>
                            <span className="font-mono">{formatCurrency(day.payable)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}


        {/* Detailed Table View (Common for both modes) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
              {viewMode === 'month' ? `${format(currentMonth, 'yyyy年MM月')} 资金收支详情` : `${selectedDate ? format(selectedDate, 'yyyy年MM月dd日') : '请选择日期'} 资金收支详情`}
            </h2>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="搜索资金来源..."
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-64 shadow-sm"
              />
            </div>
          </div>

          {/* Summary Cards for Month/Day View (Current/Future/Past) */}
          {(isCurrentOrFutureMonth || isPastMonth || isFutureOrCurrentDay || isPastDay) && (
            <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center space-y-2">
                <p className="text-xs font-black text-orange-800 bg-orange-200/50 inline-block px-3 py-1 rounded-md">资金缺口</p>
                <p className="text-xl font-black font-mono text-gray-900">{formatCurrency(totals.gap)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center space-y-2">
                <p className="text-xs font-black text-orange-800 bg-orange-200/50 inline-block px-3 py-1 rounded-md">
                  {viewMode === 'month' ? '本月总到款' : '本日总到款'}
                </p>
                <p className="text-xl font-black font-mono text-gray-900">{formatCurrency(totals.totalArrival)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center space-y-2">
                <p className="text-xs font-black text-orange-800 bg-orange-200/50 inline-block px-3 py-1 rounded-md">
                  {viewMode === 'month' ? '本月总支出' : '本日总支出'}
                </p>
                <p className="text-xl font-black font-mono text-gray-900">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto bg-white rounded-[2.5rem] border border-gray-200 shadow-sm no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[2200px]">
              <thead>
                {isCurrentOrFutureMonth ? (
                  <>
                    <tr className="bg-gray-100/50 text-[10px] font-black text-gray-500 border-b border-gray-200">
                      <th colSpan={2} className="p-2 border-r border-gray-200 text-center">/</th>
                      <th colSpan={5} className="p-2 border-r border-gray-200 text-center bg-blue-50/50 text-blue-700">资金统计</th>
                      <th colSpan={6} className="p-2 border-r border-gray-200 text-center bg-cyan-50/50 text-cyan-700">预估到账</th>
                      <th colSpan={8} className="p-2 text-center bg-emerald-50/50 text-emerald-700">预估消耗及媒体授信</th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 w-12 text-center">序号</th>
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 sticky left-0 bg-gray-50 z-10 w-48 text-center">资金类型</th>
                      <SortableHeader label="资金缺口" field="gap" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.gap} />
                      <SortableHeader label="付款总额" field="totalAmount" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.totalAmount} />
                      <SortableHeader label="还款" field="repayment" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.repayment} />
                      <SortableHeader label="现金" field="cash" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.cash} />
                      <SortableHeader label="到款总额" field="totalArrival" color="text-blue-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.totalArrival} />
                      
                      <SortableHeader label="预付款" field="prepayment" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.prepayment} />
                      <SortableHeader label="短期" field="shortTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.shortTerm} />
                      <SortableHeader label="后付" field="creditTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.creditTerm} />
                      <SortableHeader label="历史逾期" field="historyRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.historyRecovery} />
                      <SortableHeader label="提前回款" field="advanceRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.advanceRecovery} />
                      <SortableHeader label="媒体到款" field="mediaArrival" color="text-cyan-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.mediaArrival} />
                      
                      <SortableHeader label="日均消耗" field="dailyAvgConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.dailyAvgConsumption} />
                      <SortableHeader label="总消耗" field="totalConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalConsumption} />
                      <SortableHeader label="总授信" field="totalCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalCredit} />
                      <SortableHeader label="常规授信" field="baseCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.baseCredit} />
                      <SortableHeader label="担保授信" field="paymentGuarantee" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.paymentGuarantee} />
                      <SortableHeader label="当前余额" field="mediaCurrentBalance" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.mediaCurrentBalance} />
                      <SortableHeader label="可用天数" field="availableDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.availableDays} />
                      <SortableHeader label="缺口天数" field="gapDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.gapDays} />
                    </tr>
                  </>
                ) : isPastMonth ? (
                  <>
                    <tr className="bg-gray-100/50 text-[10px] font-black text-gray-500 border-b border-gray-200">
                      <th colSpan={2} className="p-2 border-r border-gray-200 text-center">/</th>
                      <th colSpan={5} className="p-2 border-r border-gray-200 text-center bg-blue-50/50 text-blue-700">资金统计</th>
                      <th colSpan={6} className="p-2 border-r border-gray-200 text-center bg-cyan-50/50 text-cyan-700">实际到款</th>
                      <th colSpan={8} className="p-2 text-center bg-emerald-50/50 text-emerald-700">实际消耗及媒体授信</th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 w-12 text-center">序号</th>
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 sticky left-0 bg-gray-50 z-10 w-48 text-center">资金类型</th>
                      <SortableHeader label="资金缺口" field="gap" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.gap} />
                      <SortableHeader label="付款总额" field="totalAmount" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.totalAmount} />
                      <SortableHeader label="还款" field="repayment" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.repayment} />
                      <SortableHeader label="现金" field="cash" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.cash} />
                      <SortableHeader label="到款总额" field="totalArrival" color="text-blue-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.totalArrival} />
                      
                      <SortableHeader label="预付款" field="prepayment" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.prepayment} />
                      <SortableHeader label="短期" field="shortTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.shortTerm} />
                      <SortableHeader label="后付" field="creditTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.creditTerm} />
                      <SortableHeader label="历史逾期" field="historyRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.historyRecovery} />
                      <SortableHeader label="提前回款" field="advanceRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.advanceRecovery} />
                      <SortableHeader label="媒体到款" field="mediaArrival" color="text-cyan-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.mediaArrival} />
                      
                      <SortableHeader label="日均消耗" field="dailyAvgConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.dailyAvgConsumption} />
                      <SortableHeader label="总消耗" field="totalConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalConsumption} />
                      <SortableHeader label="总授信" field="totalCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalCredit} />
                      <SortableHeader label="常规授信" field="baseCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.baseCredit} />
                      <SortableHeader label="担保授信" field="paymentGuarantee" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.paymentGuarantee} />
                      <SortableHeader label="当前余额" field="mediaCurrentBalance" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.mediaCurrentBalance} />
                      <SortableHeader label="可用天数" field="availableDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.availableDays} />
                      <SortableHeader label="缺口天数" field="gapDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.gapDays} />
                    </tr>
                  </>
                ) : (isFutureOrCurrentDay || isPastDay) ? (
                  <>
                    <tr className="bg-gray-100/50 text-[10px] font-black text-gray-500 border-b border-gray-200">
                      <th colSpan={2} className="p-2 border-r border-gray-200 text-center">/</th>
                      <th colSpan={5} className="p-2 border-r border-gray-200 text-center bg-blue-50/50 text-blue-700">资金统计</th>
                      <th colSpan={6} className="p-2 border-r border-gray-200 text-center bg-cyan-50/50 text-cyan-700">
                        {isFutureOrCurrentDay ? '预估到款' : '实际到款'}
                      </th>
                      <th colSpan={8} className="p-2 text-center bg-emerald-50/50 text-emerald-700">
                        {isFutureOrCurrentDay ? '预估消耗及媒体授信' : '实际消耗及媒体授信'}
                      </th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 w-12 text-center">序号</th>
                      <th className="p-3 text-[9px] font-black uppercase text-gray-400 border-r border-gray-100 sticky left-0 bg-gray-50 z-10 w-48 text-center">资金类型</th>
                      <SortableHeader label="资金缺口" field="gap" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.gap} />
                      <SortableHeader label="付款总额" field="totalAmount" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.totalAmount} />
                      <SortableHeader label="还款" field="repayment" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.repayment} />
                      <SortableHeader label="现金" field="cash" color="text-blue-600" onSort={toggleSort} tooltip={TOOLTIPS.cash} />
                      <SortableHeader label="到款总额" field="totalArrival" color="text-blue-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.totalArrival} />
                      
                      <SortableHeader label="预付款" field="prepayment" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.prepayment} />
                      <SortableHeader label="短期" field="shortTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.shortTerm} />
                      <SortableHeader label="后付" field="creditTerm" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.creditTerm} />
                      <SortableHeader label="历史逾期" field="historyRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.historyRecovery} />
                      <SortableHeader label="提前回款" field="advanceRecovery" color="text-cyan-600" onSort={toggleSort} tooltip={TOOLTIPS.advanceRecovery} />
                      <SortableHeader label="媒体到款" field="mediaArrival" color="text-cyan-600" onSort={toggleSort} borderRight tooltip={TOOLTIPS.mediaArrival} />
                      
                      <SortableHeader label="日均消耗" field="dailyAvgConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.dailyAvgConsumption} />
                      <SortableHeader label="总消耗" field="totalConsumption" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalConsumption} />
                      <SortableHeader label="总授信" field="totalCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.totalCredit} />
                      <SortableHeader label="常规授信" field="baseCredit" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.baseCredit} />
                      <SortableHeader label="担保授信" field="paymentGuarantee" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.paymentGuarantee} />
                      <SortableHeader label="当前余额" field="mediaCurrentBalance" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.mediaCurrentBalance} />
                      <SortableHeader label="可用天数" field="availableDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.availableDays} />
                      <SortableHeader label="缺口天数" field="gapDays" color="text-emerald-600" onSort={toggleSort} tooltip={TOOLTIPS.gapDays} />
                    </tr>
                  </>
                ) : (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-200 text-center w-16">序号</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-200 sticky left-0 bg-gray-50 z-10 w-48">资金来源</th>
                    <SortableHeader label="资金缺口" field="gap" color="text-blue-500" onSort={toggleSort} tooltip={TOOLTIPS.gap} />
                    <SortableHeader label="付款总额" field="totalAmount" color="text-blue-500" onSort={toggleSort} tooltip={TOOLTIPS.totalAmount} />
                    <SortableHeader label="还款" field="repayment" color="text-blue-500" onSort={toggleSort} tooltip={TOOLTIPS.repayment} />
                    <SortableHeader label="现金" field="cash" color="text-blue-500" onSort={toggleSort} tooltip={TOOLTIPS.cash} />
                    <SortableHeader label="到款总额" field="totalArrival" color="text-blue-500" onSort={toggleSort} borderRight tooltip={TOOLTIPS.totalArrival} />
                    
                    <SortableHeader label="预付款" field="prepayment" color="text-cyan-500" onSort={toggleSort} tooltip={TOOLTIPS.prepayment} />
                    <SortableHeader label="短期" field="shortTerm" color="text-cyan-500" onSort={toggleSort} tooltip={TOOLTIPS.shortTerm} />
                    <SortableHeader label="后付" field="creditTerm" color="text-cyan-500" onSort={toggleSort} tooltip={TOOLTIPS.creditTerm} />
                    <SortableHeader label="历史逾期" field="historyRecovery" color="text-cyan-500" onSort={toggleSort} tooltip={TOOLTIPS.historyRecovery} />
                    <SortableHeader label="提前回款" field="advanceRecovery" color="text-cyan-500" onSort={toggleSort} tooltip={TOOLTIPS.advanceRecovery} />
                    <SortableHeader label="媒体到款" field="mediaArrival" color="text-cyan-500" onSort={toggleSort} borderRight tooltip={TOOLTIPS.mediaArrival} />
                    
                    <SortableHeader label="日均消耗" field="dailyAvgConsumption" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.dailyAvgConsumption} />
                    <SortableHeader label="总消耗" field="totalConsumption" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.totalConsumption} />
                    <SortableHeader label="总授信" field="totalCredit" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.totalCredit} />
                    <SortableHeader label="常规授信" field="baseCredit" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.baseCredit} />
                    <SortableHeader label="担保授信" field="paymentGuarantee" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.paymentGuarantee} />
                    <SortableHeader label="当前余额" field="mediaCurrentBalance" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.mediaCurrentBalance} />
                    <SortableHeader label="可用天数" field="availableDays" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.availableDays} />
                    <SortableHeader label="缺口天数" field="gapDays" color="text-emerald-500" onSort={toggleSort} tooltip={TOOLTIPS.gapDays} />
                  </tr>
                )}
              </thead>
              <tbody>
                {/* Total Row */}
                <tr className="bg-rose-50/30 font-black border-b border-gray-100">
                  <td className="p-4 text-center text-xs text-gray-400 border-r border-gray-100">总计</td>
                  <td className="p-4 text-xs text-gray-900 border-r border-gray-100 sticky left-0 bg-rose-50/30 z-10">/</td>
                  
                  {isCurrentOrFutureMonth ? (
                    <>
                      <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(totals.gap)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.repayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.cash)}</td>
                      <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-100">{formatCurrency(totals.totalArrival)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.prepayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.shortTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.creditTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.historyRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.advanceRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900 border-r border-gray-100">{formatCurrency(totals.mediaArrival)}</td>
                      <td className="p-4 text-xs font-mono text-indigo-600">{formatCurrency(totals.dailyAvgConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.baseCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.paymentGuarantee)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.mediaCurrentBalance)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{totals.availableDays.toFixed(1)}</td>
                      <td className="p-4 text-xs font-mono text-rose-600">{totals.gapDays.toFixed(1)}</td>
                    </>
                  ) : isPastMonth ? (
                    <>
                      <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(totals.gap)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.repayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.cash)}</td>
                      <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-100">{formatCurrency(totals.totalArrival)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.prepayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.shortTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.creditTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.historyRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.advanceRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900 border-r border-gray-100">{formatCurrency(totals.mediaArrival)}</td>
                      <td className="p-4 text-xs font-mono text-indigo-600">{formatCurrency(totals.dailyAvgConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.baseCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.paymentGuarantee)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.mediaCurrentBalance)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{totals.availableDays.toFixed(1)}</td>
                      <td className="p-4 text-xs font-mono text-rose-600">{totals.gapDays.toFixed(1)}</td>
                    </>
                  ) : (isFutureOrCurrentDay || isPastDay) ? (
                    <>
                      <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(totals.gap)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.repayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.cash)}</td>
                      <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-100">{formatCurrency(totals.totalArrival)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.prepayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.shortTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.creditTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.historyRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.advanceRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900 border-r border-gray-100">{formatCurrency(totals.mediaArrival)}</td>
                      <td className="p-4 text-xs font-mono text-indigo-600">{formatCurrency(totals.dailyAvgConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.baseCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.paymentGuarantee)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.mediaCurrentBalance)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{totals.availableDays.toFixed(1)}</td>
                      <td className="p-4 text-xs font-mono text-rose-600">{totals.gapDays.toFixed(1)}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(totals.gap)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.repayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.cash)}</td>
                      <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-100">{formatCurrency(totals.totalArrival)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.prepayment)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.shortTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.creditTerm)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.historyRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.advanceRecovery)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900 border-r border-gray-100">{formatCurrency(totals.mediaArrival)}</td>
                      <td className="p-4 text-xs font-mono text-indigo-600">{formatCurrency(totals.dailyAvgConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalConsumption)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.totalCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.baseCredit)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.paymentGuarantee)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{formatCurrency(totals.mediaCurrentBalance)}</td>
                      <td className="p-4 text-xs font-mono text-gray-900">{totals.availableDays.toFixed(1)}</td>
                      <td className="p-4 text-xs font-mono text-rose-600">{totals.gapDays.toFixed(1)}</td>
                    </>
                  )}
                </tr>
                {/* Data Rows */}
                {aggregatedDetails.map((row, idx) => {
                  const isRestricted = ["外部借款", "运营成本", "其他费用"].includes(row.source);
                  return (
                    <tr key={row.source} className="border-b border-gray-50 hover:bg-gray-50/50 transition-all">
                      <td className="p-4 text-center text-xs text-gray-400 border-r border-gray-50">{idx + 1}</td>
                      <td className="p-4 text-xs font-bold text-gray-900 border-r border-gray-50 sticky left-0 bg-white group-hover:bg-gray-50 z-10">{row.source}</td>
                      
                      {isCurrentOrFutureMonth ? (
                        <>
                          <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(row.gap)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{formatCurrency(row.totalAmount)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.repayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.cash)}</td>
                          <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-50">{formatCurrency(row.totalArrival)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.prepayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.shortTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.creditTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.historyRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.advanceRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600 border-r border-gray-50">{isRestricted ? "-" : formatCurrency(row.mediaArrival)}</td>
                          <td className="p-4 text-xs font-mono text-indigo-600">{isRestricted ? "-" : formatCurrency(row.dailyAvgConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.baseCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.paymentGuarantee)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.mediaCurrentBalance)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : row.availableDays.toFixed(1)}</td>
                          <td className="p-4 text-xs font-mono text-rose-600">{isRestricted ? "-" : row.gapDays.toFixed(1)}</td>
                        </>
                      ) : isPastMonth ? (
                        <>
                          <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(row.gap)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{formatCurrency(row.totalAmount)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.repayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.cash)}</td>
                          <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-50">{formatCurrency(row.totalArrival)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.prepayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.shortTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.creditTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.historyRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.advanceRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600 border-r border-gray-50">{isRestricted ? "-" : formatCurrency(row.mediaArrival)}</td>
                          <td className="p-4 text-xs font-mono text-indigo-600">{isRestricted ? "-" : formatCurrency(row.dailyAvgConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.baseCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.paymentGuarantee)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.mediaCurrentBalance)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : row.availableDays.toFixed(1)}</td>
                          <td className="p-4 text-xs font-mono text-rose-600">{isRestricted ? "-" : row.gapDays.toFixed(1)}</td>
                        </>
                      ) : (isFutureOrCurrentDay || isPastDay) ? (
                        <>
                          <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(row.gap)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{formatCurrency(row.totalAmount)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.repayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.cash)}</td>
                          <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-50">{formatCurrency(row.totalArrival)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.prepayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.shortTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.creditTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.historyRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.advanceRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600 border-r border-gray-50">{isRestricted ? "-" : formatCurrency(row.mediaArrival)}</td>
                          <td className="p-4 text-xs font-mono text-indigo-600">{isRestricted ? "-" : formatCurrency(row.dailyAvgConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.baseCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.paymentGuarantee)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.mediaCurrentBalance)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : row.availableDays.toFixed(1)}</td>
                          <td className="p-4 text-xs font-mono text-rose-600">{isRestricted ? "-" : row.gapDays.toFixed(1)}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 text-xs font-mono text-rose-600">{formatCurrency(row.gap)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{formatCurrency(row.totalAmount)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.repayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.cash)}</td>
                          <td className="p-4 text-xs font-mono text-emerald-600 border-r border-gray-50">{formatCurrency(row.totalArrival)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.prepayment)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.shortTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.creditTerm)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.historyRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.advanceRecovery)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600 border-r border-gray-50">{isRestricted ? "-" : formatCurrency(row.mediaArrival)}</td>
                          <td className="p-4 text-xs font-mono text-indigo-600">{isRestricted ? "-" : formatCurrency(row.dailyAvgConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalConsumption)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.totalCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.baseCredit)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.paymentGuarantee)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : formatCurrency(row.mediaCurrentBalance)}</td>
                          <td className="p-4 text-xs font-mono text-gray-600">{isRestricted ? "-" : row.availableDays.toFixed(1)}</td>
                          <td className="p-4 text-xs font-mono text-rose-600">{isRestricted ? "-" : row.gapDays.toFixed(1)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {aggregatedDetails.length === 0 && (
                  <tr>
                    <td colSpan={18} className="p-20 text-center text-gray-400 font-bold">
                      {viewMode === 'day' && !selectedDate ? '请在日历中选择日期查看详情' : '暂无相关资金明细数据'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isConfigOpen && (
          <Modal title="预估配置管理" onClose={() => setIsConfigOpen(false)}>
            <div className="space-y-6">
              <p className="text-sm text-gray-500">您可以手动调整各业务线的日均消耗预估值，系统将自动重新计算未来的资金流向。</p>
              <div className="space-y-4">
                {forecastConfigs.map((cfg, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex-1">
                      <p className="text-xs font-black text-gray-400 uppercase mb-1">{cfg.source}</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
                        <input 
                          type="number" 
                          value={cfg.dailyAvgConsumption}
                          onChange={(e) => {
                            const newConfigs = [...forecastConfigs];
                            newConfigs[idx].dailyAvgConsumption = Number(e.target.value);
                            setForecastConfigs(newConfigs);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-8 pr-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} />
                保存配置并更新
              </button>
            </div>
          </Modal>
        )}

        {isAddItemOpen && (
          <Modal title="新增收支款项" onClose={() => setIsAddItemOpen(false)}>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddTransaction({
                source: formData.get('source') as string,
                type: formData.get('type') as TransactionType,
                status: formData.get('status') as Transaction['status'],
                amount: Number(formData.get('amount')),
                date: formData.get('date') as string,
                description: formData.get('description') as string,
              });
            }} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">业务来源</label>
                  <input name="source" required className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="如：外部借款" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">类型</label>
                  <select name="type" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="receivable">应收 (Income)</option>
                    <option value="payable">待付 (Expense)</option>
                  </select>
                </div>
              </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">状态</label>
                  <select name="status" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="settled">已结算 (Settled)</option>
                    <option value="pending">待结算 (Pending)</option>
                    <option value="forecast">预估 (Forecast)</option>
                  </select>
                </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">金额 (CNY)</label>
                <input name="amount" type="number" step="0.01" required className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">日期</label>
                <input name="date" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">备注说明</label>
                <textarea name="description" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="输入相关业务背景..." />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                确认录入
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableHeader({ label, field, color, onSort, borderRight, tooltip }: { label: string; field: string; color: string; onSort: (key: string) => void; borderRight?: boolean; tooltip?: string }) {
  return (
    <th className={cn("group p-3 text-[9px] font-black uppercase tracking-tighter border-b border-gray-100", color, borderRight && "border-r border-gray-200")}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 truncate">
          {tooltip && (
            <div className="relative flex-shrink-0">
              <Info size={10} className="text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 p-2 bg-gray-900 text-white text-[10px] font-bold rounded-lg shadow-xl leading-relaxed normal-case tracking-normal">
                {tooltip}
                <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}
          <span className="truncate">{label}</span>
        </div>
        <button onClick={() => onSort(field)} className="hover:text-indigo-600 transition-all shrink-0"><ArrowUpDown size={12} /></button>
      </div>
    </th>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: 'rose' | 'emerald' | 'indigo' }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{label}</p>
      <p className={cn(
        "text-[11px] font-black font-mono truncate",
        color === 'rose' && "text-rose-600",
        color === 'emerald' && "text-emerald-600",
        color === 'indigo' && "text-indigo-600",
        !color && "text-gray-700"
      )}>
        {value}
      </p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-black text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-all text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-8">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
