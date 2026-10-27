package com.mobile.reminders

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.YearMonth
import java.time.temporal.ChronoUnit

// No Android dependencies: the exact recurrence/deduplication logic is unit tested on the JVM.
data class ReminderBill(val id: String, val anchor: LocalDate, val cycle: String, val startDate: LocalDate = anchor)
data class ReminderEntry(val billId: String, val due: LocalDate, val lead: Int) {
  val key: String get() = "$billId|$due|$lead"
  val day: LocalDate get() = due.minusDays(lead.toLong())
}
data class ReminderBatch(val day: LocalDate, val at: Long, val entries: List<ReminderEntry>)

object BillReminderPlanner {
  val leads = listOf(3, 1, 0)

  fun due(bill: ReminderBill, index: Long): LocalDate = when (bill.cycle) {
    "WEEKLY" -> bill.anchor.plusWeeks(index)
    "MONTHLY" -> bill.anchor.plusMonths(index)
    "YEARLY" -> bill.anchor.plusYears(index)
    else -> error("Invalid bill cycle")
  }

  fun entries(
    bills: List<ReminderBill>, handled: Set<String>, from: LocalDate, to: LocalDate,
  ): List<ReminderEntry> = bills.flatMap { bill ->
    val result = mutableListOf<ReminderEntry>()
    // Domain storage supports anchors from 2000 onward; bounded even for weekly histories.
    val start = maxOf(0L, when (bill.cycle) {
      "WEEKLY" -> ChronoUnit.WEEKS.between(bill.anchor, from) - 1
      "MONTHLY" -> ChronoUnit.MONTHS.between(YearMonth.from(bill.anchor), YearMonth.from(from)) - 1
      "YEARLY" -> (from.year - bill.anchor.year).toLong() - 1
      else -> error("Invalid bill cycle")
    })
    for (index in start..11000L) {
      val date = due(bill, index)
      if (date.isAfter(to.plusDays(3))) break
      if (date.isBefore(bill.startDate)) continue
      if ("${bill.id}|$date" in handled) continue
      for (lead in leads) {
        val entry = ReminderEntry(bill.id, date, lead)
        if (!entry.day.isBefore(from) && !entry.day.isAfter(to)) result.add(entry)
      }
    }
    result
  }

  fun next(
    bills: List<ReminderBill>, handled: Set<String>, sent: Set<String>,
    now: Long, zone: ZoneId, hour: Int, minute: Int,
  ): ReminderBatch? {
    val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
    val grouped = entries(bills, handled, today, today.plusDays(370))
      .filter { it.key !in sent }.groupBy { it.day }.toSortedMap()
    val first = grouped.entries.firstOrNull() ?: return null
    val scheduled = first.key.atTime(LocalTime.of(hour, minute)).atZone(zone).toInstant().toEpochMilli()
    // At most one catch-up batch for TODAY; never replay all missed days after boot.
    return ReminderBatch(first.key, maxOf(scheduled, now + 1000), first.value)
  }
}
