import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  PiggyBank,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from 'lucide-react-native';
import SavingsRoadmapDetails from '../../components/SavingsRoadmapDetails';
import PlanWorkbench from '../../components/PlanWorkbench';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { financialPlansService } from '../../services/financialPlans';
import type {
  CashflowPlanStatus,
  FinancialPlanOverview,
  SavingsPlanStatus,
} from '../../types/financialPlan';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';

const screenAccent = '#A95514';

type Props = NativeStackScreenProps<RootStackParamList, 'FinancialPlan'>;

const monthLabel = (month: string) => {
  const [year, value] = month.split('-');
  return `T${Number(value)}/${year}`;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const confidenceLabel = {
  HIGH: 'Cao',
  MEDIUM: 'Vừa',
  LOW: 'Thấp',
} as const;

const cashflowStatus: Record<
  CashflowPlanStatus,
  { label: string; color: string; background: string }
> = {
  STABLE: { label: 'Ổn định', color: '#217A55', background: '#E6F6EE' },
  WARNING: { label: 'Chi đang tăng', color: '#A15C00', background: '#FFF3D8' },
  RISK: { label: 'Nguy cơ âm', color: '#B3261E', background: '#FFE4DF' },
  INSUFFICIENT_DATA: {
    label: 'Chưa đủ dữ liệu',
    color: '#6F5A4A',
    background: '#F4ECE5',
  },
};

const savingsStatus: Record<
  SavingsPlanStatus,
  { label: string; color: string; background: string }
> = {
  ON_TRACK: { label: 'Đúng tiến độ', color: '#217A55', background: '#E6F6EE' },
  BEHIND: { label: 'Đang chậm', color: '#A15C00', background: '#FFF3D8' },
  OVERDUE: { label: 'Quá hạn', color: '#B3261E', background: '#FFE4DF' },
  NO_DEADLINE: {
    label: 'Chưa có hạn',
    color: '#6F5A4A',
    background: '#F4ECE5',
  },
};

const FinancialPlanScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<FinancialPlanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forecastMonths, setForecastMonths] = useState([1, 2, 3, 4].includes(route?.params?.months ?? 0) ? route.params!.months! : 4);
  const factor = [0, 0.5, 1].includes(route?.params?.reductionFactor ?? -1) ? route.params!.reductionFactor! : 1;
  const [spendingRates, setSpendingRates] = useState<Record<string, number>>(
    {},
  );
  const loadRevision = useRef(0);
  useEffect(() => {
    if (!route?.params) return;
    const requestedMonths = route.params.months;
    if (requestedMonths !== undefined && [1, 2, 3, 4].includes(requestedMonths)) {
      setForecastMonths(requestedMonths);
    }
    setSpendingRates({});
  }, [route?.params]);

  const loadData = useCallback(
    async (refresh = false) => {
      const revision = ++loadRevision.current;
      if (!token) {
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const nextOverview = await financialPlansService.getOverview(token);
        if (revision !== loadRevision.current) return;
        setOverview(nextOverview);
        setLoadError(null);
      } catch (error) {
        if (revision !== loadRevision.current) return;
        setLoadError(
          getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
        );
      } finally {
        if (revision === loadRevision.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => undefined);
      return () => {
        loadRevision.current += 1;
      };
    }, [loadData]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Kế hoạch tài chính</Text>
          <Text style={styles.subtitle}>
            4 tháng quá khứ → {forecastMonths} tháng dự báo
          </Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={screenAccent} />
          <Text style={styles.loadingText}>Đang phân tích kế hoạch...</Text>
        </View>
      ) : loadError && !overview ? (
        <View style={styles.errorState}>
          <View style={styles.errorIcon}>
            <CircleAlert size={30} color="#B3261E" />
          </View>
          <Text style={styles.errorTitle}>Chưa tải được kế hoạch</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadData().catch(() => undefined)}
            accessibilityRole="button"
            accessibilityLabel="Thử tải lại kế hoạch"
          >
            <RefreshCcw size={17} color={Colors.white} />
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true).catch(() => undefined)}
              colors={[screenAccent]}
              tintColor={screenAccent}
            />
          }
        >
          {loadError ? (
            <TouchableOpacity
              style={styles.inlineError}
              onPress={() => loadData(true).catch(() => undefined)}
            >
              <CircleAlert size={18} color="#B3261E" />
              <Text style={styles.inlineErrorText} numberOfLines={2}>
                Dữ liệu mới chưa tải được. Chạm để thử lại.
              </Text>
              <RefreshCcw size={16} color="#B3261E" />
            </TouchableOpacity>
          ) : null}

          <View style={styles.monthOptions}>
            {[1, 2, 3, 4].map(months => (
              <TouchableOpacity
                key={months}
                accessibilityRole="button"
                accessibilityLabel={`Dự báo ${months} tháng`}
                accessibilityState={{ selected: forecastMonths === months }}
                onPress={() => setForecastMonths(months)}
                style={[
                  styles.monthOption,
                  forecastMonths === months && styles.monthOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.monthOptionText,
                    forecastMonths === months && styles.monthOptionTextSelected,
                  ]}
                >
                  {months} tháng
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.explainCard}>
            <ShieldCheck size={21} color="#5C7441" />
            <Text style={styles.explainText}>
              Chuyển tiền giữa ví và đóng góp tiết kiệm không được tính là thu
              hoặc chi. Dự báo chỉ là ước tính từ dữ liệu đã ghi nhận.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <TrendingUp size={21} color={screenAccent} />
              <Text style={styles.sectionTitle}>Dự báo thu – chi</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Budgets')}>
              <Text style={styles.sectionLink}>Ngân sách</Text>
            </TouchableOpacity>
          </View>

          {overview?.cashflow_plans.length ? (
            overview.cashflow_plans.map(plan => {
              const forecast = plan.forecast.slice(0, forecastMonths);
              const totalNet = forecast.reduce(
                (sum, point) => sum + point.projected_net,
                0,
              );
              const averageNet = totalNet / Math.max(1, forecast.length);
              const averageExpense =
                forecast.reduce(
                  (sum, point) => sum + point.projected_expense,
                  0,
                ) / Math.max(1, forecast.length);
              const status =
                plan.summary.status === 'INSUFFICIENT_DATA'
                  ? 'INSUFFICIENT_DATA'
                  : averageNet < 0
                  ? 'RISK'
                  : plan.summary.history_average_expense > 0 &&
                    averageExpense > plan.summary.history_average_expense * 1.15
                  ? 'WARNING'
                  : 'STABLE';
              const meta = cashflowStatus[status];
              const actions = (plan.spending_actions ?? []).map(action => {
                const requestedPercent =
                  spendingRates[`${plan.currency}:${action.category_id}`] ??
                  action.reduction_percent * factor;
                const allowedRates = [
                  0,
                  action.reduction_percent / 2,
                  action.reduction_percent,
                ];
                const percent = allowedRates.includes(requestedPercent)
                  ? requestedPercent
                  : action.reduction_percent;
                const reduction =
                  Math.floor(action.monthly_baseline * percent) / 100;
                return {
                  ...action,
                  suggested_percent: action.reduction_percent,
                  reduction_percent: percent,
                  monthly_reduction: reduction,
                  monthly_target:
                    Math.round((action.monthly_baseline - reduction) * 100) /
                    100,
                };
              });
              const monthlyReduction = actions.reduce(
                (sum, action) => sum + action.monthly_reduction,
                0,
              );
              return (
                <View key={plan.currency} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={styles.planHeadingCopy}>
                      <Text style={styles.planName}>
                        Dòng tiền · {plan.currency}
                      </Text>
                      <Text style={styles.planMeta}>
                        {plan.summary.transaction_count} giao dịch · Tin cậy{' '}
                        {confidenceLabel[plan.summary.confidence]}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: meta.background },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.periodTitle}>4 tháng đã qua</Text>
                  <View style={styles.columnHeader}>
                    <Text style={[styles.columnText, styles.monthColumn]}>
                      Tháng
                    </Text>
                    <Text style={styles.columnText}>Thu</Text>
                    <Text style={styles.columnText}>Chi</Text>
                  </View>
                  {plan.history.map(point => (
                    <View key={point.month} style={styles.cashflowRow}>
                      <Text style={[styles.monthText, styles.monthColumn]}>
                        {monthLabel(point.month)}
                      </Text>
                      <Text
                        style={styles.incomeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        +{formatCurrency(point.income, plan.currency)}
                      </Text>
                      <Text
                        style={styles.expenseText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        −{formatCurrency(point.expense, plan.currency)}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.periodTitle}>
                    {forecastMonths} tháng dự báo (từ tháng hiện tại)
                  </Text>
                  <View style={styles.columnHeader}>
                    <Text style={[styles.columnText, styles.monthColumn]}>
                      Tháng
                    </Text>
                    <Text style={styles.columnText}>Thu dự kiến</Text>
                    <Text style={styles.columnText}>Chi dự kiến</Text>
                  </View>
                  {forecast.map(point => (
                    <View
                      key={point.month}
                      style={[styles.cashflowRow, styles.forecastRow]}
                    >
                      <Text style={[styles.monthText, styles.monthColumn]}>
                        {monthLabel(point.month)}
                      </Text>
                      <Text
                        style={styles.incomeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        +{formatCurrency(point.projected_income, plan.currency)}
                      </Text>
                      <Text
                        style={styles.expenseText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        −
                        {formatCurrency(point.projected_expense, plan.currency)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.netSummary}>
                    <Text style={styles.netLabel}>
                      Còn lại trung bình dự kiến
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={
                        averageNet < 0 ? styles.netNegative : styles.netPositive
                      }
                    >
                      {formatCurrency(averageNet, plan.currency)}
                      /tháng
                    </Text>
                  </View>
                  <Text style={styles.actionBody}>
                    Tổng chênh lệch thu – chi trong {forecastMonths} tháng:{' '}
                    {formatCurrency(totalNet, plan.currency)}. Chưa trừ đóng góp
                    tiết kiệm và trả nợ.
                  </Text>
                  <Text style={styles.periodTitle}>
                    Cắt giảm chi tiêu như thế nào?
                  </Text>
                  <Text style={styles.actionBody}>
                    Mức thử nghiệm so với trung bình 4 tháng đã hoàn tất; tháng
                    không có giao dịch tính bằng 0. Hãy kiểm tra dữ liệu đã ghi
                    đủ trước khi áp dụng.
                  </Text>
                  {actions.length ? (
                    actions.map(action => (
                      <View key={action.category_id} style={styles.actionCard}>
                        <Text style={styles.planName}>{action.category}</Text>
                        <Text style={styles.actionBody}>
                          Trung bình:{' '}
                          {formatCurrency(
                            action.monthly_baseline,
                            plan.currency,
                          )}
                          /tháng
                        </Text>
                        <Text style={styles.actionTarget}>
                          {action.monthly_reduction > 0
                            ? `Thử giảm ${
                                action.reduction_percent
                              }% → giới hạn ${formatCurrency(
                                action.monthly_target,
                                plan.currency,
                              )}/tháng`
                            : action.suggested_percent > 0
                            ? 'Giữ mức chi trung bình hiện tại'
                            : 'Rà soát trước khi đặt mức giảm'}
                        </Text>
                        {action.suggested_percent > 0 ? (
                          <View>
                            <Text style={styles.actionBody}>
                              Chọn mức giảm để thử:
                            </Text>
                            <View style={styles.reductionOptions}>
                              {[
                                0,
                                action.suggested_percent / 2,
                                action.suggested_percent,
                              ].map(percent => (
                                <TouchableOpacity
                                  key={percent}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Giảm ${percent}% cho ${action.category} (${plan.currency})`}
                                  accessibilityState={{
                                    selected:
                                      action.reduction_percent === percent,
                                  }}
                                  onPress={() =>
                                    setSpendingRates(previous => ({
                                      ...previous,
                                      [`${plan.currency}:${action.category_id}`]:
                                        percent,
                                    }))
                                  }
                                  style={[
                                    styles.reductionOption,
                                    action.reduction_percent === percent &&
                                      styles.monthOptionSelected,
                                  ]}
                                >
                                  <Text style={styles.actionTarget}>
                                    {percent}%
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null}
                        {action.steps.map((step, index) => (
                          <Text key={step} style={styles.actionBody}>
                            {index + 1}. {step}
                          </Text>
                        ))}
                        {action.monthly_reduction > 0 ? (
                          <Text style={styles.actionTarget}>
                            Nếu đạt mức này: giảm{' '}
                            {formatCurrency(
                              action.monthly_reduction,
                              plan.currency,
                            )}
                            /tháng.
                          </Text>
                        ) : null}
                        {action.monthly_target > 0 ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Lập ngân sách cho ${action.category}`}
                            style={styles.reductionOption}
                            onPress={() =>
                              navigation.navigate('Budgets', {
                                draft: {
                                  categoryId: action.category_id,
                                  categoryName: action.category,
                                  currency: plan.currency,
                                  monthlyLimit: action.monthly_target,
                                },
                              })
                            }
                          >
                            <Text style={styles.sectionLink}>
                              Lập ngân sách với mức này
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.actionBody}>
                      Chưa có chi tiêu theo danh mục để đề xuất mức giảm. Ghi
                      nhận và phân loại giao dịch, sau đó quay lại xem kế hoạch.
                    </Text>
                  )}
                  {monthlyReduction > 0 ? (
                    <Text style={styles.actionTarget}>
                      Nếu duy trì các mức giảm trên trong {forecastMonths}{' '}
                      tháng: có thể giảm{' '}
                      {formatCurrency(
                        monthlyReduction * forecastMonths,
                        plan.currency,
                      )}{' '}
                      so với mức chi trung bình cũ. Đây là kịch bản, chưa phải
                      tiền đã tiết kiệm.
                    </Text>
                  ) : null}
                  {actions.some(action => action.suggested_percent > 0) ? (
                    <Text style={styles.actionBody}>
                      Lựa chọn trên chỉ cập nhật bản tính thử. Khi phù hợp, bạn
                      có thể đặt ngân sách theo giới hạn đã chọn.
                    </Text>
                  ) : null}
                  {averageNet < 0 ? (
                    <Text style={styles.savingsWarning}>
                      Dự báo đang thiếu trung bình{' '}
                      {formatCurrency(-averageNet, plan.currency)}/tháng. Ưu
                      tiên khoản thiết yếu; rà soát khoản có thể hoãn và nguồn
                      thu trước khi cam kết tiết kiệm.
                    </Text>
                  ) : null}
                  <Text style={styles.actionBody}>
                    Cuối mỗi tuần, mở ngân sách để so sánh thực chi với giới
                    hạn; điều chỉnh nếu nhu cầu thiết yếu thay đổi.
                  </Text>
                  <PlanWorkbench plan={plan} goals={overview.savings_plans} months={forecastMonths} reduction={monthlyReduction} />
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Budgets')}
                    accessibilityRole="button"
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>
                      Xem các ngân sách hiện có
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCashflow}>
              <TrendingUp size={26} color={screenAccent} />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>Chưa có dữ liệu để dự báo</Text>
                <Text style={styles.emptyText}>
                  Hãy ghi nhận thu và chi hằng ngày. Dự báo sẽ rõ hơn sau mỗi
                  tháng có giao dịch.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <PiggyBank size={21} color={screenAccent} />
              <Text style={styles.sectionTitle}>Kế hoạch tiết kiệm</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('SavingsGoals')}
              accessibilityRole="button"
              accessibilityLabel="Quản lý mục tiêu tiết kiệm"
            >
              <Text style={styles.sectionLink}>Quản lý</Text>
            </TouchableOpacity>
          </View>

          {overview?.cashflow_plans.map(cashflow => {
            const goals = overview.savings_plans.filter(
              goal => goal.currency === cashflow.currency,
            );
            if (!goals.length) return null;
            const planned = goals.reduce(
              (sum, goal) => sum + (goal.roadmap?.next_contribution ?? 0),
              0,
            );
            const firstNet = cashflow.forecast[0]?.projected_net ?? 0;
            const difference = firstNet - planned;
            const unknown = cashflow.summary.status === 'INSUFFICIENT_DATA';
            return (
              <View
                key={`capacity-${cashflow.currency}`}
                style={styles.capacityCard}
              >
                <Text style={styles.planName}>
                  Khả năng góp kỳ này · {cashflow.currency}
                </Text>
                <Text style={styles.actionBody}>
                  Các mục tiêu có lịch cần góp thêm{' '}
                  {formatCurrency(planned, cashflow.currency)} trong kỳ đầu.
                </Text>
                <Text style={styles.actionBody}>
                  {unknown
                    ? 'Chưa đủ dữ liệu thu chi để đánh giá khả năng góp.'
                    : `Phần dư dự báo tháng hiện tại: ${formatCurrency(
                        firstNet,
                        cashflow.currency,
                      )}.`}
                </Text>
                {!unknown ? (
                  <Text
                    style={
                      difference < 0 ? styles.savingsWarning : styles.actionBody
                    }
                  >
                    {difference < 0
                      ? `Thiếu khoảng ${formatCurrency(
                          -difference,
                          cashflow.currency,
                        )} so với lịch góp. Ưu tiên một mục tiêu hoặc lùi ngày hoàn thành.`
                      : `Sau các kỳ góp còn khoảng ${formatCurrency(
                          difference,
                          cashflow.currency,
                        )} theo dự báo; vẫn cần dành tiền trả nợ và chi phát sinh.`}
                  </Text>
                ) : null}
                {goals.some(goal => goal.roadmap?.next_contribution == null) ? (
                  <Text style={styles.actionBody}>
                    Mục tiêu chưa có lịch hoặc đã quá hạn chưa được cộng vào số
                    cần góp.
                  </Text>
                ) : null}
              </View>
            );
          })}
          {overview?.savings_plans.length ? (
            overview.savings_plans.map(plan => {
              const meta = savingsStatus[plan.status];
              return (
                <View key={plan.id} style={styles.savingsCard}>
                  <TouchableOpacity
                    style={styles.savingsTopRow}
                    onPress={() => navigation.navigate('SavingsGoals')}
                  >
                    <View style={styles.savingsIcon}>
                      <PiggyBank size={21} color={screenAccent} />
                    </View>
                    <View style={styles.savingsCopy}>
                      <View style={styles.savingsTitleRow}>
                        <Text style={styles.savingsName} numberOfLines={1}>
                          {plan.name}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: meta.background },
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: meta.color }]}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${clampPercent(plan.progress_percent)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.savingsMeta}>
                        Đã đạt {Math.round(clampPercent(plan.progress_percent))}
                        % · {formatCurrency(plan.current_amount, plan.currency)}
                      </Text>
                      <Text style={styles.savingsMetaSecondary}>
                        {plan.roadmap?.status === 'OVERDUE'
                          ? 'Cần cập nhật ngày hạn'
                          : plan.target_date
                          ? `Kỳ tới: ${formatCurrency(
                              plan.roadmap?.next_contribution ??
                                plan.suggested_monthly,
                              plan.currency,
                            )}`
                          : 'Thêm ngày hoàn thành để lập lịch góp'}
                      </Text>
                      {!plan.roadmap && plan.monthly_gap > 0 ? (
                        <Text style={styles.savingsWarning}>
                          Tháng này còn cần góp{' '}
                          {formatCurrency(plan.monthly_gap, plan.currency)}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronRight size={20} color="#9A765B" />
                  </TouchableOpacity>
                  <SavingsRoadmapDetails
                    roadmap={plan.roadmap}
                    currency={plan.currency}
                  />
                </View>
              );
            })
          ) : (
            <TouchableOpacity
              style={styles.emptySavings}
              onPress={() => navigation.navigate('SavingsGoals')}
            >
              <WalletCards size={24} color={screenAccent} />
              <View style={styles.savingsCopy}>
                <Text style={styles.savingsName}>
                  Chưa có kế hoạch tiết kiệm
                </Text>
                <Text style={styles.savingsMeta}>
                  Tạo mục tiêu, số tiền và ngày cần đạt.
                </Text>
              </View>
              <ChevronRight size={20} color="#9A765B" />
            </TouchableOpacity>
          )}

          <View style={styles.warningCard}>
            <CircleAlert size={19} color="#A15C00" />
            <Text style={styles.warningText}>
              {overview?.methodology.note ??
                'Dự báo mang tính tham khảo và sẽ thay đổi khi có dữ liệu mới.'}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  reductionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  reductionOption: {
    minWidth: 60,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DAD6D0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  capacityCard: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthOptions: { flexDirection: 'row', gap: 8 },
  monthOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E4BD99',
  },
  monthOptionSelected: {
    backgroundColor: screenAccent,
    borderColor: screenAccent,
  },
  monthOptionText: { color: '#667085', fontWeight: '600' },
  monthOptionTextSelected: { color: Colors.white },
  actionCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF8F1',
    gap: 4,
  },
  actionBody: { color: '#667085', fontSize: 12, lineHeight: 19, marginTop: 6 },
  actionTarget: {
    color: '#217A55',
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 6,
  },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerPlaceholder: { width: 42 },
  title: { color: '#20262D', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#667085', fontSize: 12, fontWeight: '700', marginTop: 3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#667085', fontWeight: '700' },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  errorIcon: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#FFE9E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    color: '#20262D',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
  },
  errorText: {
    color: '#667085',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  retryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: screenAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    marginTop: 18,
  },
  retryText: { color: Colors.white, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 60, gap: 16 },
  inlineError: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFE9E5',
    borderWidth: 1,
    borderColor: '#F2B8B0',
  },
  inlineErrorText: { flex: 1, color: '#8D2B23', fontWeight: '600' },
  explainCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#EEF7E9',
    borderWidth: 1,
    borderColor: '#C9DDBD',
  },
  explainText: {
    flex: 1,
    color: '#586D42',
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#20262D', fontSize: 18, fontWeight: '700' },
  sectionLink: { color: screenAccent, fontSize: 12, fontWeight: '700' },
  planCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  planHeadingCopy: { flex: 1, minWidth: 0 },
  planName: { color: '#20262D', fontSize: 16, fontWeight: '700' },
  planMeta: { color: '#667085', fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusBadge: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  periodTitle: {
    color: '#6F4B32',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 5,
  },
  cashflowRow: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5E5D7',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
  },
  columnText: {
    flex: 1,
    color: '#A07B60',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  forecastRow: {
    backgroundColor: '#FFF8F1',
    paddingHorizontal: 7,
    borderRadius: 8,
    marginBottom: 3,
    borderBottomWidth: 0,
  },
  monthColumn: { flex: 0, width: 66, textAlign: 'left' },
  monthText: { color: '#6F4B32', fontSize: 11, fontWeight: '700' },
  incomeText: {
    flex: 1,
    color: '#217A55',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  expenseText: {
    flex: 1,
    color: '#B84A3A',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  netSummary: {
    marginTop: 11,
    borderRadius: 14,
    padding: 11,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  netLabel: { flex: 1, color: '#667085', fontSize: 11, fontWeight: '600' },
  netPositive: { color: '#217A55', fontSize: 12, fontWeight: '700' },
  netNegative: { color: '#B3261E', fontSize: 12, fontWeight: '700' },
  emptyCashflow: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E4BD99',
    backgroundColor: '#FFF9F3',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#20262D', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#667085', lineHeight: 19, marginTop: 5 },
  savingsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  savingsCard: {
    gap: 11,
    padding: 13,
    borderRadius: 18,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  savingsIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingsCopy: { flex: 1, minWidth: 0 },
  savingsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savingsName: { flex: 1, color: '#20262D', fontSize: 14, fontWeight: '700' },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    overflow: 'hidden',
    marginTop: 9,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: screenAccent,
  },
  savingsMeta: {
    color: '#667085',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 7,
  },
  savingsMetaSecondary: {
    color: '#667085',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 1,
  },
  savingsWarning: {
    color: '#A15C00',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  emptySavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E4BD99',
    backgroundColor: '#FFF9F3',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  warningText: {
    flex: 1,
    color: '#667085',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },
});

export default FinancialPlanScreen;
