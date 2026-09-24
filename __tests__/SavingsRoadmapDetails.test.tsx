import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import SavingsRoadmapDetails from '../src/components/SavingsRoadmapDetails';
import type { SavingsRoadmap } from '../src/types/savingsRoadmap';

const roadmap: SavingsRoadmap = {
  status: 'SCHEDULED',
  remaining_amount: 600,
  remaining_months: 3,
  contributed_this_month: 100,
  next_contribution: 200,
  next_due_date: '2026-09-30',
  weekly_amount: 60,
  recent_monthly_contribution: 100,
  recent_history_months: 3,
  months_at_current_pace: 6,
  monthly_pace_gap: 100,
  schedule: [{ due_date: '2026-09-30', amount: 200, target_balance: 600 }],
  schedule_truncated: false,
};
it('reveals the contribution schedule only when expanded', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SavingsRoadmapDetails roadmap={roadmap} currency="VND" />,
    );
  });
  expect(renderer!.root.findAllByProps({ children: 'Hạn góp' })).toHaveLength(
    0,
  );
  await act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Xem hoặc thu gọn lịch góp' })
      .props.onPress(),
  );
  expect(
    renderer!.root.findAllByProps({ children: 'Hạn góp' }).length,
  ).toBeGreaterThan(0);
  await act(async () => renderer!.unmount());
});
it('does not display a made-up schedule without a deadline', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SavingsRoadmapDetails
        roadmap={{
          ...roadmap,
          status: 'NO_DEADLINE',
          schedule: [],
          next_contribution: null,
        }}
        currency="USD"
      />,
    );
  });
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Xem hoặc thu gọn lịch góp',
    }),
  ).toHaveLength(0);
  await act(async () => renderer!.unmount());
});

it('compares the remaining amount across horizons without changing the stored schedule', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SavingsRoadmapDetails roadmap={roadmap} currency="VND" />,
    );
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'So sánh phương án tiết kiệm' })
      .props.onPress();
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Tích lũy trong 2 tháng' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Tích lũy trong 2 tháng' })
      .props.accessibilityState.selected,
  ).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('300');
  expect(roadmap.remaining_months).toBe(3);
  await act(async () => renderer.unmount());
});
