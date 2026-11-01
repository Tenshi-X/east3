package com.atlas.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Calendar;
import java.util.TimeZone;

public class HydrationScheduleTest {
    private final TimeZone zone = TimeZone.getTimeZone("Asia/Jakarta");

    private long time(int day, int hour, int minute) {
        Calendar clock = Calendar.getInstance(zone);
        clock.clear();
        clock.set(2026, Calendar.OCTOBER, day, hour, minute);
        return clock.getTimeInMillis();
    }

    @Test public void dailyWindowDoesNotIncludeBedtime() {
        assertEquals(Arrays.asList(480, 600, 720, 840, 960, 1080, 1200), HydrationSchedule.slots(480, 1320, 120));
        assertTrue(HydrationSchedule.isActive(480, 1320, time(31, 8, 0), zone));
        assertFalse(HydrationSchedule.isActive(480, 1320, time(31, 22, 0), zone));
        assertEquals(time(32, 8, 0), HydrationSchedule.next(480, 1320, 120, time(31, 20, 0), zone));
    }

    @Test public void overnightWindowCrossesTheMonthBoundary() {
        assertEquals(Arrays.asList(1350, 30, 150, 270), HydrationSchedule.slots(1350, 360, 120));
        assertTrue(HydrationSchedule.isActive(1350, 360, time(32, 1, 0), zone));
        assertFalse(HydrationSchedule.isActive(1350, 360, time(32, 6, 0), zone));
        assertEquals(time(32, 0, 30), HydrationSchedule.next(1350, 360, 120, time(31, 23, 0), zone));
    }

    @Test public void invalidInputCannotCreateAnEndlessAlarmLoop() {
        assertFalse(HydrationSchedule.valid(480, 480, 60));
        assertFalse(HydrationSchedule.valid(-1, 1320, 60));
        assertFalse(HydrationSchedule.valid(480, 1440, 60));
        assertFalse(HydrationSchedule.valid(480, 1320, 0));
    }

    @Test public void timezoneChangesUseTheCurrentLocalClock() {
        long now = time(31, 9, 0);
        TimeZone utc = TimeZone.getTimeZone("UTC");
        Calendar next = Calendar.getInstance(utc);
        next.setTimeInMillis(HydrationSchedule.next(480, 1320, 120, now, utc));
        assertEquals(8, next.get(Calendar.HOUR_OF_DAY));
        assertTrue(next.getTimeInMillis() > now);
    }

    @Test public void automaticWindowsFollowNightWorkAndRecoveryWithoutResettingAtMidnight() {
        long from = time(31, 0, 0), until = time(34, 0, 0);
        long[][] windows = { { time(31, 21, 0), time(32, 7, 0) }, { time(32, 15, 0), time(32, 23, 0) } };
        assertEquals(time(32, 1, 0), HydrationSchedule.nextAutomatic(windows, from, until, 120, time(32, 0, 1)));
        assertEquals(time(32, 15, 0), HydrationSchedule.nextAutomatic(windows, from, until, 120, time(32, 8, 0)));
        assertTrue(HydrationSchedule.automaticDue(windows, from, until, time(32, 1, 0), time(32, 1, 5), 120));
        assertFalse(HydrationSchedule.automaticDue(windows, from, until, time(32, 5, 0), time(32, 8, 0), 120));
        assertFalse(HydrationSchedule.automaticDue(windows, from, until, time(32, 5, 0), time(32, 15, 0), 120));
    }

    @Test public void expiredAndInvalidAutomaticSchedulesCannotFallBackToDaytimeAlarms() {
        long from = time(31, 0, 0), until = time(32, 0, 0);
        long[][] windows = { { time(31, 7, 0), time(31, 23, 0) } };
        assertEquals(Long.MAX_VALUE, HydrationSchedule.nextAutomatic(windows, from, until, 120, until));
        assertFalse(HydrationSchedule.automaticDue(windows, from, until, time(31, 21, 0), until, 120));
        assertFalse(HydrationSchedule.validWindows(new long[][] { { 2, 1 } }, from, until));
        assertFalse(HydrationSchedule.validWindows(new long[][] { { time(31, 8, 0), time(31, 10, 0) }, { time(31, 9, 0), time(31, 11, 0) } }, from, until));
    }
}
