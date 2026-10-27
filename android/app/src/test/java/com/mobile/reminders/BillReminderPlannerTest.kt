package com.mobile.reminders

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class BillReminderPlannerTest {
  @Test fun trackingStartExcludesHistoricalPeriodsButStillRemindsBeforeFirstFutureDue() {
    val b = ReminderBill("future", LocalDate.parse("2026-01-31"), "MONTHLY", LocalDate.parse("2026-11-30"))
    val entries = BillReminderPlanner.entries(listOf(b), emptySet(), LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"))
    assertTrue(entries.none { it.due.isBefore(LocalDate.parse("2026-11-30")) })
    assertTrue(entries.any { it.day == LocalDate.parse("2026-11-27") && it.lead == 3 })
    assertTrue(entries.any { it.due == LocalDate.parse("2026-12-31") })
  }
  private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
  private val day = LocalDate.parse("2026-10-27")
  private fun at(date: LocalDate = day, hour: Int = 8) = date.atTime(hour, 0).atZone(zone).toInstant().toEpochMilli()
  private fun bill(id: String, date: String = "2026-10-27", cycle: String = "MONTHLY") = ReminderBill(id, LocalDate.parse(date), cycle)

  @Test fun monthEndNeverDrifts() {
    val b = bill("rent", "2026-01-31")
    assertEquals("2026-02-28", BillReminderPlanner.due(b, 1).toString())
    assertEquals("2026-03-31", BillReminderPlanner.due(b, 2).toString())
  }
  @Test fun leapYearReturnsToFebruary29() {
    val b = bill("year", "2024-02-29", "YEARLY")
    assertEquals("2025-02-28", BillReminderPlanner.due(b, 1).toString())
    assertEquals("2028-02-29", BillReminderPlanner.due(b, 4).toString())
  }
  @Test fun groupsDifferentDueDatesOnTheSameReminderDay() {
    val bills = listOf(bill("today"), bill("tomorrow", "2026-10-28"), bill("three", "2026-10-30"))
    val batch = BillReminderPlanner.next(bills, emptySet(), emptySet(), at(), zone, 20, 0)!!
    assertEquals(day, batch.day)
    assertEquals(3, batch.entries.size)
    assertEquals(setOf(0, 1, 3), batch.entries.map { it.lead }.toSet())
    assertEquals(at(hour = 20), batch.at)
  }
  @Test fun handledPeriodsDoNotNotifyWhileFuturePeriodsRemain() {
    val b = bill("electric")
    val batch = BillReminderPlanner.next(listOf(b), setOf("electric|2026-10-27"), emptySet(), at(), zone, 20, 0)!!
    assertEquals("2026-11-24", batch.day.toString())
  }
  @Test fun durableSentKeysCannotBeSentAgain() {
    val b = bill("rent")
    val batch = BillReminderPlanner.next(listOf(b), emptySet(), setOf("rent|2026-10-27|0"), at(), zone, 20, 0)!!
    assertTrue(batch.day.isAfter(day))
  }
  @Test fun neverReplaysYesterdayAfterBoot() {
    val entries = BillReminderPlanner.entries(listOf(bill("old", "2026-10-26")), emptySet(), day, day.plusDays(40))
    assertTrue(entries.none { it.day.isBefore(day) || it.due.toString() == "2026-10-26" })
  }
  @Test fun catchesUpOnlyTodayOnce() {
    val now = at(hour = 21)
    val b = bill("today")
    val batch = BillReminderPlanner.next(listOf(b), emptySet(), emptySet(), now, zone, 20, 0)!!
    assertEquals(now + 1000, batch.at)
    assertEquals(day, batch.day)
    assertTrue(BillReminderPlanner.next(listOf(b), emptySet(), batch.entries.map { it.key }.toSet(), now, zone, 20, 0)!!.day.isAfter(day))
  }
  @Test fun timezoneUsesLocalCalendarRatherThanUtcDate() {
    val utc = ZoneId.of("UTC")
    val instant = day.atTime(0, 30).atZone(zone).toInstant().toEpochMilli()
    val b = bill("today")
    val localBatch = BillReminderPlanner.next(listOf(b), emptySet(), emptySet(), instant, zone, 8, 0)!!
    val utcBatch = BillReminderPlanner.next(listOf(b), emptySet(), emptySet(), instant, utc, 8, 0)!!
    assertEquals(day, localBatch.day)
    assertNotEquals(localBatch.at, utcBatch.at)
  }
  @Test fun emptyOrAllPausedInputHasNoAlarm() {
    assertNull(BillReminderPlanner.next(emptyList(), emptySet(), emptySet(), at(), zone, 8, 0))
  }
  @Test fun weeklyCycleAndAncientAnchorsRemainBounded() {
    val b = bill("weekly", "2000-01-04", "WEEKLY")
    val batch = BillReminderPlanner.next(listOf(b), emptySet(), emptySet(), at(), zone, 8, 0)!!
    assertEquals(day, batch.day)
    assertEquals(day, batch.entries.first().due)
  }
}
