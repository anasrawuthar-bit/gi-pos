package com.GIHOSTINGS.giposapp

import org.junit.Test
import org.junit.Assert.*
import java.time.LocalDate
import java.time.ZoneId

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
class BillingCoreTest {
    @Test
    fun money_rounds_to_minor_units() {
        assertEquals(1001L, MoneyMath.toMinor(10.005))
        assertEquals(10.01, MoneyMath.round(10.005), 0.0)
    }

    @Test
    fun inclusive_and_exclusive_tax_are_stable() {
        assertEquals(500L, MoneyMath.inclusiveTax(10500, 5.0))
        assertEquals(500L, MoneyMath.exclusiveTax(10000, 5.0))
        assertEquals(1333L, MoneyMath.percentOf(13333, 10.0))
    }

    @Test
    fun bill_period_resets_on_april_first() {
        assertEquals("2025-26", PosDatabase.financialYearKey(time("2026-03-31")))
        assertEquals("2026-27", PosDatabase.financialYearKey(time("2026-04-01")))
    }

    @Test
    fun kot_period_resets_each_day() {
        assertEquals("2026-08-14", PosDatabase.dailyKey(time("2026-08-14")))
        assertEquals("2026-08-15", PosDatabase.dailyKey(time("2026-08-15")))
    }

    private fun time(date: String): Long = LocalDate.parse(date)
        .atTime(12, 0)
        .atZone(ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli()
}
