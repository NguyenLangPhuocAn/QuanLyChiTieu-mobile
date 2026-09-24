import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { financialPlansService } from '../services/financialPlans';
import type { FinancialPlanOverview } from '../types/financialPlan';
import { formatCurrency } from '../utils/format';

type Props = {
  token: string | null;
  months: number;
  onSelect: (factor: number) => void;
};
export default function ChatPlanSuggestions({
  token,
  months,
  onSelect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overview, setOverview] = useState<FinancialPlanOverview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setOverview(null);
    if (!expanded || !token) return;
    setLoading(true);
    setError(false);
    financialPlansService
      .getOverview(token)
      .then(result => {
        if (active) setOverview(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [expanded, token, retry]);
  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="So sánh phương án tài chính"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
      >
        <Text style={styles.title}>
          {expanded ? 'Thu gọn phương án' : `So sánh phương án ${months} tháng`}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <>
          {loading ? <ActivityIndicator /> : null}
          {error ? (
            <TouchableOpacity
              accessibilityLabel="Tải lại phương án chatbot"
              onPress={() => setRetry(value => value + 1)}
            >
              <Text style={styles.text}>
                Chưa tải được số liệu. Bấm để thử lại.
              </Text>
            </TouchableOpacity>
          ) : null}
          {overview?.cashflow_plans.length
            ? [
                { title: 'Giữ mức chi hiện tại', factor: 0 },
                { title: 'Giảm nhẹ', factor: 0.5 },
                { title: 'Theo mức gợi ý', factor: 1 },
              ].map(option => (
                <TouchableOpacity
                  key={option.factor}
                  accessibilityRole="button"
                  accessibilityLabel={`Chỉnh phương án ${option.title}`}
                  style={styles.option}
                  onPress={() => onSelect(option.factor)}
                >
                  <Text style={styles.title}>{option.title}</Text>
                  {overview.cashflow_plans.map(plan => {
                    const reduction = (plan.spending_actions ?? []).reduce(
                      (sum, item) =>
                        sum +
                        Math.floor(
                          item.monthly_baseline *
                            item.reduction_percent *
                            option.factor,
                        ) /
                          100,
                      0,
                    );
                    return (
                      <Text key={plan.currency} style={styles.text}>
                        {plan.summary.status === 'INSUFFICIENT_DATA'
                          ? `${plan.currency}: dữ liệu còn ít; cần bổ sung trước khi áp dụng.`
                          : `${plan.currency}: giảm thử ${formatCurrency(reduction, plan.currency)}/tháng, khoảng ${formatCurrency(reduction * Math.min(months, plan.forecast.length), plan.currency)} trong kỳ.`}
                      </Text>
                    );
                  })}
                  <Text style={styles.text}>
                    Chỉnh khoản nợ, chi thiết yếu và lưu phương án →
                  </Text>
                </TouchableOpacity>
              ))
            : null}
          <Text style={styles.text}>
            Các phương án thay thế nhau. Mức giảm là kịch bản, chưa phải tiền dư
            hay tiền đã tiết kiệm; số liệu sẽ được cập nhật khi mở kế hoạch.
          </Text>
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  title: { fontSize: 14, fontWeight: '600', color: '#593420' },
  text: { fontSize: 12, lineHeight: 18, color: '#755A47' },
  option: {
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E8D4C3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
});
