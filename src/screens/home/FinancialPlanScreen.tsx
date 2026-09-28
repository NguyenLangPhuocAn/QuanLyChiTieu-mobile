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
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { financialPlansService } from '../../services/financialPlans';
import type {
  CashflowPlanStatus,
  FinancialPlanOverview,
} from '../../types/financialPlan';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';

const screenAccent = Colors.primary;

type Props = NativeStackScreenProps<RootStackParamList, 'FinancialPlan'>;

const monthLabel = (month: string) => {
  const [year, value] = month.split('-');
  return `T${Number(value)}/${year}`;
};

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

const FinancialPlanScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<FinancialPlanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forecastMonths, setForecastMonths] = useState(
    [1, 2, 3, 4].includes(route?.params?.months ?? 0)
      ? route.params!.months!
      : 4,
  );
  const factor = [0, 0.5, 1].includes(route?.params?.reductionFactor ?? -1)
    ? route.params!.reductionFactor!
    : 1;
  const [spendingRates, setSpendingRates] = useState<Record<string, number>>(
    {},
  );
  const [showSpendingCriteria, setShowSpendingCriteria] = useState(false);
  const loadRevision = useRef(0);
  useEffect(() => {
    if (!route?.params) return;
    const requestedMonths = route.params.months;
    if (
      requestedMonths !== undefined &&
      [1, 2, 3, 4].includes(requestedMonths)
    ) {
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

          <View style={styles.comparisonCard}>
            <Text style={styles.sectionTitle}>So sánh phương án</Text>
            <Text style={styles.actionBody}>
              Chọn thời gian để xem tổng thu, chi và phần dư dự kiến.
            </Text>
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
                      forecastMonths === months &&
                        styles.monthOptionTextSelected,
                    ]}
                  >
                    {months} tháng
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
              const actions = (plan.spending_actions ?? [])
                .filter(action => action.reduction_percent > 0)
                .map(action => {
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
                  <View style={styles.cutSectionHeader}>
                    <Text style={styles.cutSectionTitle}>Gợi ý cắt giảm</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Giải thích cách chọn danh mục cắt giảm"
                      accessibilityState={{ expanded: showSpendingCriteria }}
                      onPress={() =>
                        setShowSpendingCriteria(current => !current)
                      }
                      style={[
                        styles.criteriaButton,
                        showSpendingCriteria && styles.criteriaButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.criteriaButtonText,
                          showSpendingCriteria &&
                            styles.criteriaButtonTextActive,
                        ]}
                      >
                        ?
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {showSpendingCriteria ? (
                    <View style={styles.criteriaCard}>
                      <Text style={styles.criteriaTitle}>
                        Các danh mục này xuất hiện vì
                      </Text>
                      <Text style={styles.criteriaText}>
                        1. Có chi tiêu thường trong{' '}
                        {overview?.methodology.history_months ?? 4} tháng đã hoàn
                        tất; tháng không phát sinh vẫn tính là 0.
                      </Text>
                      <Text style={styles.criteriaText}>
                        2. Thuộc nhóm có thể điều chỉnh như ăn uống, mua sắm,
                        giải trí, di chuyển hoặc dịch vụ.
                      </Text>
                      <Text style={styles.criteriaText}>
                        3. Xếp theo số tiền có thể giảm mỗi tháng và chỉ lấy tối
                        đa 3 danh mục.
                      </Text>
                      <Text style={styles.criteriaNote}>
                        Không tính chuyển ví, góp tiết kiệm, vay/nợ và các khoản
                        thiết yếu như y tế, học phí, tiền nhà hoặc bảo hiểm.
                      </Text>
                    </View>
                  ) : null}
                  {actions.length ? (
                    actions.map((action, actionIndex) => (
                      <View key={action.category_id} style={styles.actionCard}>
                        <View style={styles.actionCardHeader}>
                          <View style={styles.actionRank}>
                            <Text style={styles.actionRankText}>
                              {actionIndex + 1}
                            </Text>
                          </View>
                          <View style={styles.actionHeadingCopy}>
                            <Text style={styles.actionName}>
                              {action.category}
                            </Text>
                            <Text style={styles.actionReason}>
                              Xuất hiện vì mức chi có thể điều chỉnh khoảng{' '}
                              {action.suggested_percent}% mỗi tháng.
                            </Text>
                          </View>
                        </View>

                        <View style={styles.actionMetrics}>
                          <View style={styles.actionMetric}>
                            <Text style={styles.actionMetricLabel}>
                              Trung bình cũ
                            </Text>
                            <Text style={styles.actionMetricValue}>
                              {formatCurrency(
                                action.monthly_baseline,
                                plan.currency,
                              )}
                            </Text>
                          </View>
                          <View style={styles.actionMetricDivider} />
                          <View style={styles.actionMetric}>
                            <Text style={styles.actionMetricLabel}>
                              Giới hạn thử
                            </Text>
                            <Text style={styles.actionMetricValueStrong}>
                              {formatCurrency(
                                action.monthly_target,
                                plan.currency,
                              )}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.reductionSummary}>
                          <Text style={styles.reductionSummaryLabel}>
                            Có thể giảm
                          </Text>
                          <Text style={styles.reductionSummaryValue}>
                            {formatCurrency(
                              action.monthly_reduction,
                              plan.currency,
                            )}
                            /tháng
                          </Text>
                        </View>
                        {action.suggested_percent > 0 ? (
                          <View>
                            <Text style={styles.optionLabel}>
                              Chọn mức muốn thử
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
                                      styles.reductionOptionSelected,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.reductionOptionText,
                                      action.reduction_percent === percent &&
                                        styles.reductionOptionTextSelected,
                                    ]}
                                  >
                                    {percent}%
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null}
                        <Text style={styles.stepsTitle}>
                          Việc có thể làm tuần này
                        </Text>
                        {action.steps.map((step, index) => (
                          <View key={step} style={styles.stepRow}>
                            <View style={styles.stepBullet}>
                              <Text style={styles.stepBulletText}>
                                {index + 1}
                              </Text>
                            </View>
                            <Text style={styles.stepText}>{step}</Text>
                          </View>
                        ))}
                        {action.monthly_target > 0 ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Lập ngân sách cho ${action.category}`}
                            style={styles.budgetActionButton}
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
                            <Text style={styles.budgetActionText}>
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
                  {actions.length ? (
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

          <TouchableOpacity
            style={styles.emptySavings}
            accessibilityRole="button"
            accessibilityLabel="Quản lý mục tiêu tiết kiệm"
            onPress={() => navigation.navigate('SavingsGoals')}
          >
            <PiggyBank size={24} color={screenAccent} />
            <View style={styles.savingsCopy}>
              <Text style={styles.savingsName}>Mục tiêu tiết kiệm</Text>
              <Text style={styles.savingsMeta}>Xem mục tiêu và lịch góp</Text>
            </View>
            <ChevronRight size={20} color="#9A765B" />
          </TouchableOpacity>

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
    gap: 8,
    marginTop: 8,
  },
  reductionOption: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8CDB5',
    borderRadius: 12,
    backgroundColor: '#FFFDFB',
  },
  reductionOptionSelected: {
    backgroundColor: screenAccent,
    borderColor: screenAccent,
  },
  reductionOptionText: {
    color: '#6F4B32',
    fontSize: 13,
    fontWeight: '700',
  },
  reductionOptionTextSelected: { color: Colors.white },
  capacityCard: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0D5BE',
  },
  comparisonCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 16,
    gap: 8,
  },
  monthOptions: { flexDirection: 'row', gap: 8 },
  monthOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFF3E8',
    borderWidth: 0,
    borderColor: '#E4BD99',
  },
  monthOptionSelected: {
    backgroundColor: screenAccent,
    borderColor: screenAccent,
  },
  monthOptionText: { color: '#8A623F', fontWeight: '600' },
  monthOptionTextSelected: { color: Colors.white },
  actionCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0D5BE',
    gap: 12,
  },
  actionBody: { color: '#8A623F', fontSize: 12, lineHeight: 19, marginTop: 6 },
  actionTarget: {
    color: '#217A55',
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 6,
  },
  cutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 22,
  },
  cutSectionTitle: {
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '700',
  },
  criteriaButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E4BD99',
    backgroundColor: '#FFF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  criteriaButtonActive: {
    backgroundColor: screenAccent,
    borderColor: screenAccent,
  },
  criteriaButtonText: {
    color: screenAccent,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
  },
  criteriaButtonTextActive: { color: Colors.white },
  criteriaCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF4E8',
    borderLeftWidth: 4,
    borderLeftColor: screenAccent,
    gap: 7,
  },
  criteriaTitle: { color: '#4C2A18', fontSize: 14, fontWeight: '700' },
  criteriaText: { color: '#6F4B32', fontSize: 12, lineHeight: 18 },
  criteriaNote: {
    color: '#8A623F',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
  actionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionRank: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRankText: { color: screenAccent, fontSize: 14, fontWeight: '800' },
  actionHeadingCopy: { flex: 1, minWidth: 0 },
  actionName: { color: '#4C2A18', fontSize: 17, fontWeight: '700' },
  actionReason: {
    color: '#8A623F',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  actionMetrics: {
    minHeight: 78,
    borderRadius: 15,
    backgroundColor: '#FFF8F2',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
  },
  actionMetric: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  actionMetricDivider: { width: 1, backgroundColor: '#EFD8C5' },
  actionMetricLabel: { color: '#9A7355', fontSize: 10, fontWeight: '600' },
  actionMetricValue: {
    color: '#6F4B32',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  actionMetricValueStrong: {
    color: screenAccent,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },
  reductionSummary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EAF7F0',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reductionSummaryLabel: { color: '#41745B', fontSize: 12, fontWeight: '600' },
  reductionSummaryValue: { color: '#217A55', fontSize: 13, fontWeight: '800' },
  optionLabel: { color: '#6F4B32', fontSize: 12, fontWeight: '700' },
  stepsTitle: {
    color: '#4C2A18',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  stepBullet: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBulletText: { color: screenAccent, fontSize: 10, fontWeight: '800' },
  stepText: { flex: 1, color: '#6F4B32', fontSize: 12, lineHeight: 19 },
  budgetActionButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  budgetActionText: { color: screenAccent, fontSize: 13, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 0,
    borderBottomColor: '#F0D5BE',
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
  title: { color: '#4C2A18', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#8A623F', fontSize: 12, fontWeight: '700', marginTop: 3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#8A623F', fontWeight: '700' },
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
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
  },
  errorText: {
    color: '#8A623F',
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
    padding: 2,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: '#C9DDBD',
  },
  explainText: {
    flex: 1,
    color: '#586D42',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '400',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#4C2A18', fontSize: 18, fontWeight: '700' },
  sectionLink: { color: screenAccent, fontSize: 12, fontWeight: '700' },
  planCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    borderWidth: 0,
    borderColor: '#F0D5BE',
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  planHeadingCopy: { flex: 1, minWidth: 0 },
  planName: { color: '#4C2A18', fontSize: 16, fontWeight: '700' },
  planMeta: { color: '#8A623F', fontSize: 11, fontWeight: '700', marginTop: 4 },
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
  netLabel: { flex: 1, color: '#8A623F', fontSize: 11, fontWeight: '600' },
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
  emptyTitle: { color: '#4C2A18', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#8A623F', lineHeight: 19, marginTop: 5 },
  savingsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  savingsCard: {
    gap: 11,
    padding: 13,
    borderRadius: 18,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#F0D5BE',
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
  savingsName: { flex: 1, color: '#4C2A18', fontSize: 14, fontWeight: '700' },
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
    color: '#8A623F',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 7,
  },
  savingsMetaSecondary: {
    color: '#8A623F',
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
    color: '#8A623F',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },
});

export default FinancialPlanScreen;
